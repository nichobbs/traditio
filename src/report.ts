#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import type { Metrics } from './types.js';

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

async function buildTimeSeries(): Promise<TimeSeriesEntry[]> {
  const generations = await findGenerations();
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

async function main(): Promise<void> {
  const timeSeries = await buildTimeSeries();

  if (timeSeries.length === 0) {
    console.log('No generations with metrics found (only the seed generation may exist).');
  } else {
    console.log('');
    console.log('Generation | Compositionality | Transmission Fidelity | Compression | Unique Forms');
    console.log('-'.repeat(95));

    for (const entry of timeSeries) {
      const genStr = String(entry.generation).padStart(3, ' ');
      const compStr = entry.compositionality.toFixed(4).padStart(16, ' ');
      const tranStr = entry.transmissionFidelityOverall.toFixed(4).padStart(20, ' ');
      const compRatioStr = entry.compressionRatio.toFixed(4).padStart(11, ' ');
      const uniqueStr = String(entry.uniqueForms).padStart(12, ' ');

      console.log(`${genStr}${compStr}${tranStr}${compRatioStr}${uniqueStr}`);
    }

    console.log('');
  }

  const timeSeriesPath = path.resolve(process.cwd(), 'metrics/timeseries.json');
  await fs.mkdir(path.dirname(timeSeriesPath), { recursive: true });
  await fs.writeFile(timeSeriesPath, JSON.stringify(timeSeries, null, 2));
  console.log(`Time series saved to ${timeSeriesPath}`);
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
