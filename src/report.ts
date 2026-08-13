#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { generateMeanings } from './meanings.js';
import type { GenerationMeta, Language, Meaning, Metrics } from './types.js';

interface TimeSeriesEntry {
  generation: number;
  compositionality: number;
  transmissionFidelityOverall: number;
  compressionRatio: number;
  uniqueForms: number;
}

// A fixed spread of meanings tracked every report so their forms can be
// compared generation-to-generation - a concrete look at the language
// itself, not just aggregate scores.
const SENTINEL_MEANING_IDS = ['m000', 'm025', 'm050', 'm075', 'm100', 'm125', 'm150', 'm175'];

function genDirPath(genNumber: number): string {
  return path.resolve(process.cwd(), `corpus/gen-${String(genNumber).padStart(3, '0')}`);
}

async function loadMetrics(genNumber: number): Promise<Metrics | null> {
  try {
    const data = await fs.readFile(path.join(genDirPath(genNumber), 'metrics.json'), 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function loadMeta(genNumber: number): Promise<GenerationMeta | null> {
  try {
    const data = await fs.readFile(path.join(genDirPath(genNumber), 'meta.json'), 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function loadLanguagePairs(genNumber: number): Promise<Map<string, string> | null> {
  try {
    const data = await fs.readFile(path.join(genDirPath(genNumber), 'language.json'), 'utf-8');
    const language: Language = JSON.parse(data);
    return new Map(language.pairs.map((p) => [p.meaningId, p.form]));
  } catch {
    return null;
  }
}

async function findGenerations(): Promise<number[]> {
  const corpusPath = path.resolve(process.cwd(), 'corpus');
  try {
    const entries = await fs.readdir(corpusPath);
    return entries
      .filter((e) => /^gen-\d+$/.test(e))
      .sort()
      .map((e) => parseInt(e.slice(4), 10));
  } catch {
    return [];
  }
}

async function buildTimeSeries(generations: number[]): Promise<TimeSeriesEntry[]> {
  const timeSeries: TimeSeriesEntry[] = [];

  for (const gen of generations) {
    const metrics = await loadMetrics(gen);
    if (!metrics) continue;

    timeSeries.push({
      generation: gen,
      compositionality: metrics.compositionality.pearsonCorrelation,
      transmissionFidelityOverall: metrics.transmissionFidelity.overall.meanLevenshtein,
      compressionRatio: metrics.compressibility.compressionRatio,
      uniqueForms: metrics.lexiconStats.uniqueFormCount,
    });
  }

  return timeSeries;
}

function fmt(n: number): string {
  return n.toFixed(4);
}

function badgeSegment(s: string): string {
  return s.replace(/-/g, '--').replace(/ /g, '_');
}

function badge(label: string, message: string, color: string): string {
  const url = `https://img.shields.io/badge/${badgeSegment(label)}-${badgeSegment(message)}-${color}`;
  return `![${label}](${url})`;
}

function compositionalityColor(value: number): string {
  if (value >= 0.3) return 'brightgreen';
  if (value >= 0.1) return 'yellow';
  return 'lightgrey';
}

function delta(curr: number, prev: number | null): string {
  if (prev === null) return '';
  const d = curr - prev;
  if (Math.abs(d) < 0.0005) return ' (→ steady)';
  const arrow = d > 0 ? '▲' : '▼';
  const sign = d > 0 ? '+' : '';
  return ` (${arrow} ${sign}${fmt(d)})`;
}

function compositionalityCallout(curr: number, prev: number | null): string {
  if (prev === null) {
    return '> [!NOTE]\n> First measured generation — nothing to compare against yet. Check back after the next run.';
  }
  const d = curr - prev;
  if (d > 0.05) {
    return `> [!TIP]\n> 🧬 Compositionality jumped ${fmt(d)} this generation — the language is becoming more systematic (similar meanings are converging on similar forms).`;
  }
  if (d < -0.05) {
    return `> [!WARNING]\n> 🎲 Compositionality dropped ${fmt(d)} this generation — structure may be eroding back toward arbitrary forms.`;
  }
  return `> [!NOTE]\n> ➡️ Compositionality is holding roughly steady (${d >= 0 ? '+' : ''}${fmt(d)}) this generation.`;
}

function gloss(m: Meaning): string {
  return `${m.agent} ${m.action} ${m.patient} (${m.tense})`;
}

async function buildSentinelTable(latestGenNumber: number): Promise<string | null> {
  if (latestGenNumber < 1) return null;

  const meanings = new Map(generateMeanings().map((m) => [m.id, m]));
  const prevPairs = await loadLanguagePairs(latestGenNumber - 1);
  const currPairs = await loadLanguagePairs(latestGenNumber);
  if (!prevPairs || !currPairs) return null;

  const lines: string[] = [];
  lines.push(`| Meaning | Gen ${latestGenNumber - 1} form | Gen ${latestGenNumber} form | |`);
  lines.push('|---|---|---|---|');

  for (const id of SENTINEL_MEANING_IDS) {
    const meaning = meanings.get(id);
    if (!meaning) continue;
    const prevForm = prevPairs.get(id) ?? '—';
    const currForm = currPairs.get(id) ?? '—';
    const marker = prevForm === currForm ? '✅ unchanged' : '🔄 drifted';
    lines.push(`| ${gloss(meaning)} | \`${prevForm}\` | \`${currForm}\` | ${marker} |`);
  }

  return lines.join('\n');
}

function buildTrendChart(timeSeries: TimeSeriesEntry[]): string | null {
  if (timeSeries.length < 2) return null;

  const gens = timeSeries.map((e) => e.generation).join(', ');
  const comp = timeSeries.map((e) => fmt(e.compositionality)).join(', ');
  const fidelity = timeSeries.map((e) => fmt(e.transmissionFidelityOverall)).join(', ');

  return [
    '```mermaid',
    'xychart-beta',
    '    title "Compositionality & transmission fidelity across generations"',
    `    x-axis "Generation" [${gens}]`,
    '    y-axis "Score" 0 --> 1',
    `    line "Compositionality" [${comp}]`,
    `    line "Transmission Fidelity" [${fidelity}]`,
    '```',
  ].join('\n');
}

async function buildMarkdownReport(
  latestGenNumber: number,
  latestMeta: GenerationMeta | null,
  latestMetrics: Metrics | null,
  previousMetrics: Metrics | null,
  totalMeanings: number,
  timeSeries: TimeSeriesEntry[]
): Promise<string> {
  const lines: string[] = [];

  lines.push('# 🧬 Traditio Generation Report');
  lines.push('');
  lines.push(
    '_Iterated language transmission experiment: each generation only sees a sampled subset of the ' +
      'previous generation\'s language and must reconstruct the rest, testing what regularities survive ' +
      'a chain of learners._'
  );
  lines.push('');

  if (latestGenNumber === 0 || !latestMetrics) {
    lines.push(
      badge('generation', String(latestGenNumber), 'blue') +
        ' ' +
        badge('status', 'seed_only', 'lightgrey')
    );
    lines.push('');
    lines.push('## Generation 0 (seed)');
    lines.push('');
    lines.push('The seed language was generated deterministically with no learner/LLM involved. Metrics begin at generation 1.');
    lines.push('');
    return lines.join('\n');
  }

  const m = latestMetrics;
  const prevComp = previousMetrics?.compositionality.pearsonCorrelation ?? null;

  lines.push(
    [
      badge('generation', String(latestGenNumber), 'blue'),
      latestMeta ? badge('model', latestMeta.model, 'informational') : '',
      badge('unique_forms', `${m.lexiconStats.uniqueFormCount}/${totalMeanings}`, 'orange'),
      badge('compositionality', fmt(m.compositionality.pearsonCorrelation), compositionalityColor(m.compositionality.pearsonCorrelation)),
    ]
      .filter(Boolean)
      .join(' ')
  );
  lines.push('');

  lines.push(compositionalityCallout(m.compositionality.pearsonCorrelation, prevComp));
  lines.push('');

  lines.push(`## Generation ${latestGenNumber}${latestMeta ? ` (${latestMeta.model})` : ''}`);
  if (latestMeta) {
    lines.push('');
    lines.push(`Generated: ${latestMeta.timestamp}`);
  }
  lines.push('');
  lines.push('| Metric | Value | What it means |');
  lines.push('|---|---|---|');
  lines.push(
    `| Compositionality | ${fmt(m.compositionality.pearsonCorrelation)}${delta(m.compositionality.pearsonCorrelation, prevComp)} | Correlation between how different two meanings are and how different their word forms are. Closer to 1 = a systematic, rule-like language; closer to 0 = arbitrary forms. |`
  );
  lines.push(
    `| Transmission fidelity (overall) | ${fmt(m.transmissionFidelity.overall.meanLevenshtein)}${delta(m.transmissionFidelity.overall.meanLevenshtein, previousMetrics?.transmissionFidelity.overall.meanLevenshtein ?? null)} | Mean normalized edit distance between this generation's forms and the previous generation's, across all meanings (0 = identical, 1 = completely different). Lower = more faithful transmission. |`
  );
  lines.push(
    `| — in-sample | ${fmt(m.transmissionFidelity.inSample.meanLevenshtein)} | Same measure, restricted to meanings this generation actually saw during training. |`
  );
  lines.push(
    `| — held-out | ${fmt(m.transmissionFidelity.heldOut.meanLevenshtein)} | Same measure for meanings NOT shown to this generation — it had to infer these forms. Larger divergence here is expected. |`
  );
  lines.push(
    `| Compression ratio | ${fmt(m.compressibility.compressionRatio)}${delta(m.compressibility.compressionRatio, previousMetrics?.compressibility.compressionRatio ?? null)} | gzip size of the full lexicon divided by its raw size. Lower = more internal redundancy/structure in the forms. |`
  );
  lines.push(
    `| Unique forms | ${m.lexiconStats.uniqueFormCount} / ${totalMeanings} | Distinct word forms produced. Fewer than ${totalMeanings} means some meanings collapsed onto the same form. |`
  );
  lines.push('');

  const sentinelTable = await buildSentinelTable(latestGenNumber);
  if (sentinelTable) {
    lines.push('## 👀 Watch the language evolve');
    lines.push('');
    lines.push(`A fixed set of meanings, tracked every generation, so you can see actual forms drift:`);
    lines.push('');
    lines.push(sentinelTable);
    lines.push('');
  }

  const trendChart = buildTrendChart(timeSeries);
  if (trendChart) {
    lines.push('## 📈 Trend');
    lines.push('');
    lines.push(trendChart);
    lines.push('');
  }

  lines.push('## History across generations');
  lines.push('');
  lines.push('| Gen | Compositionality | Transmission Fidelity | Compression | Unique Forms |');
  lines.push('|---|---|---|---|---|');
  for (const entry of timeSeries) {
    lines.push(
      `| ${entry.generation} | ${fmt(entry.compositionality)} | ${fmt(entry.transmissionFidelityOverall)} | ${fmt(entry.compressionRatio)} | ${entry.uniqueForms}/${totalMeanings} |`
    );
  }
  lines.push('');

  return lines.join('\n');
}

async function main(): Promise<void> {
  const generations = await findGenerations();
  const timeSeries = await buildTimeSeries(generations);
  const totalMeanings = generateMeanings().length;

  const latestGenNumber = generations.length > 0 ? generations[generations.length - 1] : 0;
  const latestMeta = await loadMeta(latestGenNumber);
  const latestMetrics = await loadMetrics(latestGenNumber);
  const previousMetrics = latestGenNumber > 0 ? await loadMetrics(latestGenNumber - 1) : null;

  if (timeSeries.length === 0) {
    console.log('No generations with metrics found (only the seed generation may exist).');
  } else {
    console.log('');
    console.log('Generation | Compositionality | Transmission Fidelity | Compression | Unique Forms');
    console.log('-'.repeat(95));

    for (const entry of timeSeries) {
      const genStr = String(entry.generation).padStart(3, ' ');
      const compStr = fmt(entry.compositionality).padStart(16, ' ');
      const tranStr = fmt(entry.transmissionFidelityOverall).padStart(20, ' ');
      const compRatioStr = fmt(entry.compressionRatio).padStart(11, ' ');
      const uniqueStr = String(entry.uniqueForms).padStart(12, ' ');

      console.log(`${genStr}${compStr}${tranStr}${compRatioStr}${uniqueStr}`);
    }

    console.log('');
  }

  const timeSeriesPath = path.resolve(process.cwd(), 'metrics/timeseries.json');
  await fs.mkdir(path.dirname(timeSeriesPath), { recursive: true });
  await fs.writeFile(timeSeriesPath, JSON.stringify(timeSeries, null, 2));
  console.log(`Time series saved to ${timeSeriesPath}`);

  const markdownReport = await buildMarkdownReport(
    latestGenNumber,
    latestMeta,
    latestMetrics,
    previousMetrics,
    totalMeanings,
    timeSeries
  );

  const reportPath = path.resolve(process.cwd(), 'metrics/latest-report.md');
  await fs.writeFile(reportPath, markdownReport);
  console.log(`Report saved to ${reportPath}`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, markdownReport);
  }
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
