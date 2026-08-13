#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { generateMeanings } from './meanings.js';
import type { GenerationMeta, Metrics } from './types.js';

interface TimeSeriesEntry {
  generation: number;
  compositionality: number;
  transmissionFidelityOverall: number;
  compressionRatio: number;
  uniqueForms: number;
}

async function loadMetrics(genNumber: number): Promise<Metrics | null> {
  try {
    const metricsPath = path.resolve(process.cwd(), `corpus/gen-${String(genNumber).padStart(3, '0')}/metrics.json`);
    const data = await fs.readFile(metricsPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function loadMeta(genNumber: number): Promise<GenerationMeta | null> {
  try {
    const metaPath = path.resolve(process.cwd(), `corpus/gen-${String(genNumber).padStart(3, '0')}/meta.json`);
    const data = await fs.readFile(metaPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function findGenerations(): Promise<number[]> {
  const corpusPath = path.resolve(process.cwd(), 'corpus');
  try {
    const entries = await fs.readdir(corpusPath);
    const genDirs = entries
      .filter((e) => /^gen-\d+$/.test(e))
      .sort()
      .map((e) => parseInt(e.slice(4), 10));
    return genDirs;
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

function buildMarkdownReport(
  latestGenNumber: number,
  latestMeta: GenerationMeta | null,
  latestMetrics: Metrics | null,
  totalMeanings: number,
  timeSeries: TimeSeriesEntry[]
): string {
  const lines: string[] = [];

  lines.push('# Traditio Generation Report');
  lines.push('');
  lines.push(
    '_Iterated language transmission experiment: each generation only sees a sampled subset of the ' +
      'previous generation\'s language and must reconstruct the rest, testing what regularities survive ' +
      'a chain of learners._'
  );
  lines.push('');

  if (latestGenNumber === 0 || !latestMetrics) {
    lines.push(`## Generation 0 (seed)`);
    lines.push('');
    lines.push('The seed language was generated deterministically with no learner/LLM involved. Metrics begin at generation 1.');
  } else {
    const m = latestMetrics;
    lines.push(`## Generation ${latestGenNumber}${latestMeta ? ` (${latestMeta.model})` : ''}`);
    if (latestMeta) {
      lines.push('');
      lines.push(`Generated: ${latestMeta.timestamp}`);
    }
    lines.push('');
    lines.push('| Metric | Value | What it means |');
    lines.push('|---|---|---|');
    lines.push(
      `| Compositionality | ${fmt(m.compositionality.pearsonCorrelation)} | Correlation between how different two meanings are and how different their word forms are. Closer to 1 = a systematic, rule-like language; closer to 0 = arbitrary forms. |`
    );
    lines.push(
      `| Transmission fidelity (overall) | ${fmt(m.transmissionFidelity.overall.meanLevenshtein)} | Mean normalized edit distance between this generation's forms and the previous generation's, across all meanings (0 = identical, 1 = completely different). Lower = more faithful transmission. |`
    );
    lines.push(
      `| — in-sample | ${fmt(m.transmissionFidelity.inSample.meanLevenshtein)} | Same measure, restricted to meanings this generation actually saw during training. |`
    );
    lines.push(
      `| — held-out | ${fmt(m.transmissionFidelity.heldOut.meanLevenshtein)} | Same measure for meanings NOT shown to this generation — it had to infer these forms. Larger divergence here is expected. |`
    );
    lines.push(
      `| Compression ratio | ${fmt(m.compressibility.compressionRatio)} | gzip size of the full lexicon divided by its raw size. Lower = more internal redundancy/structure in the forms. |`
    );
    lines.push(
      `| Unique forms | ${m.lexiconStats.uniqueFormCount} / ${totalMeanings} | Distinct word forms produced. Fewer than ${totalMeanings} means some meanings collapsed onto the same form. |`
    );
  }

  lines.push('');
  lines.push('## History across generations');
  lines.push('');

  if (timeSeries.length === 0) {
    lines.push('No generations with metrics yet (only the seed generation exists).');
  } else {
    lines.push('| Gen | Compositionality | Transmission Fidelity | Compression | Unique Forms |');
    lines.push('|---|---|---|---|---|');
    for (const entry of timeSeries) {
      lines.push(
        `| ${entry.generation} | ${fmt(entry.compositionality)} | ${fmt(entry.transmissionFidelityOverall)} | ${fmt(entry.compressionRatio)} | ${entry.uniqueForms}/${totalMeanings} |`
      );
    }
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

  const markdownReport = buildMarkdownReport(latestGenNumber, latestMeta, latestMetrics, totalMeanings, timeSeries);

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
