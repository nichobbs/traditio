import fs from 'fs/promises';
import path from 'path';
import type { ApiClient } from '../types.js';
import { runChain, type ChainSummary } from './chain.js';
import {
  Run2ConfigSchema,
  resolveCondition,
  type ResolvedCondition,
  type Run2Config,
} from './types.js';

export async function loadRun2Config(file: string): Promise<Run2Config> {
  const text = await fs.readFile(path.resolve(process.cwd(), file), 'utf-8');
  return Run2ConfigSchema.parse(JSON.parse(text));
}

export interface Selection {
  phase?: number;
  condition?: string;
  chains?: number;
}

export function selectConditions(config: Run2Config, selection: Selection): ResolvedCondition[] {
  const picked = config.conditions
    .filter((c) => selection.phase === undefined || c.phase === selection.phase)
    .filter((c) => selection.condition === undefined || c.name === selection.condition)
    .map((c) => resolveCondition(config, c));
  return selection.chains === undefined ? picked : picked.map((c) => ({ ...c, chains: selection.chains as number }));
}

export interface Estimate {
  condition: string;
  chains: number;
  callsPerGeneration: [number, number];
  worstCaseCalls: number;
  expectedCalls: number;
}

// game: speaker + pre-test (+ revision when the pre-test is not perfect)
// (+ post-test when enabled)
export function estimateCalls(
  config: Run2Config,
  conds: ResolvedCondition[],
  expectedGenerations: number
): Estimate[] {
  return conds.map((c) => {
    const perGen: [number, number] =
      c.pressure === 'game'
        ? [2 + (config.defaults.postTest ? 1 : 0), 3 + (config.defaults.postTest ? 1 : 0)]
        : [1, 1];
    const gens = Math.min(expectedGenerations, c.maxGenerations);
    return {
      condition: c.name,
      chains: c.chains,
      callsPerGeneration: perGen,
      worstCaseCalls: c.chains * c.maxGenerations * perGen[1],
      expectedCalls: Math.round(c.chains * gens * ((perGen[0] + perGen[1]) / 2)),
    };
  });
}

// Runs chains with bounded concurrency. Generations inside a chain are
// sequential; separate chains run in parallel.
export async function runAll(
  config: Run2Config,
  conds: ResolvedCondition[],
  client: ApiClient,
  runsDir: string,
  log: (message: string) => void
): Promise<ChainSummary[]> {
  const tasks = conds.flatMap((cond) =>
    Array.from({ length: cond.chains }, (_, chain) => ({ cond, chain }))
  );
  const results: ChainSummary[] = [];
  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < tasks.length) {
      const { cond, chain } = tasks[next++];
      const summary = await runChain({ client, config, runsDir, log }, cond, chain);
      log(`[${cond.name}/chain-${chain}] finished: ${summary.status} at gen ${summary.lastGeneration}, ${summary.calls} calls`);
      results.push(summary);
    }
  };
  await Promise.all(Array.from({ length: config.defaults.concurrency }, worker));
  return results;
}
