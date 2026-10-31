import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ApiClient } from '../types.js';
import { chainDir, readGenerationMetrics, runChain } from './chain.js';
import { MockClient } from './mock.js';
import { buildReport, collectRows } from './report.js';
import { estimateCalls } from './runner.js';
import { resolveCondition, type ConditionConfig, type Run2Config } from './types.js';

const config: Run2Config = {
  baseSeed: 11,
  defaults: {
    model: 'mock',
    maxOutputTokens: 8000,
    temperature: 1,
    listenerTemperature: 0,
    sampleFraction: 0.4,
    maxTrainingTokens: 4000,
    maxGenerations: 30,
    stasisWindow: 3,
    stasisEpsilon: 0.002,
    chains: 1,
    testItems: 40,
    confusionsShown: 10,
    postTest: true,
    concurrency: 1,
  },
  conditions: [],
};

function cond(overrides: Partial<ConditionConfig>) {
  const base: ConditionConfig = {
    name: 'c',
    phase: 1,
    presentation: 'inline-shuffled',
    pressure: 'none',
    fieldOrder: ['agent', 'action', 'patient', 'tense'],
  };
  return resolveCondition(config, { ...base, ...overrides });
}

let dir: string;
beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'run2-'));
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

describe('runChain', () => {
  it('runs a chain to stasis with the mock learner and writes per-generation files', async () => {
    const client = new MockClient();
    const summary = await runChain({ client, config, runsDir: dir, sleep: async () => {} }, cond({}), 0);
    expect(summary.status).toBe('stasis');
    const d = chainDir(dir, 'c', 0);
    const forms = JSON.parse(await fs.readFile(path.join(d, `gen-${String(summary.lastGeneration).padStart(3, '0')}`, 'language.json'), 'utf-8')).forms;
    expect(forms).toHaveLength(200);
    const last = await readGenerationMetrics(d, summary.lastGeneration);
    expect(last.structure.droppedDimensions).toEqual(['action']);
    expect(summary.calls).toBe(client.calls);
  });

  it('resumes from the last generation instead of starting over', async () => {
    const client = new MockClient();
    const short = cond({ maxGenerations: 2 });
    const first = await runChain({ client, config, runsDir: dir, sleep: async () => {} }, short, 0);
    expect(first).toMatchObject({ status: 'max-generations', lastGeneration: 2 });
    const second = await runChain({ client, config, runsDir: dir, sleep: async () => {} }, cond({ maxGenerations: 4 }), 0);
    expect(second.lastGeneration).toBeGreaterThanOrEqual(4 - 0);
    expect(second.calls).toBe(client.calls);
  });

  it('game pressure records communication and keeps the action distinction the mock would drop', async () => {
    const gameCfg = { ...config, defaults: { ...config.defaults, maxGenerations: 4 } };
    const client = new MockClient();
    const summary = await runChain(
      { client, config: gameCfg, runsDir: dir, sleep: async () => {} },
      cond({ name: 'g', pressure: 'game', maxGenerations: 4 }),
      0
    );
    expect(summary.status).not.toBe('failed');
    const m = await readGenerationMetrics(chainDir(dir, 'g', 0), 4);
    expect(m.communication?.pre.total).toBe(40);
    expect(m.communication?.post).toBeDefined();
    expect(m.structure.expressivity.uniqueForms).toBeGreaterThan(40);
  });

  it('records a failed chain instead of throwing when the model returns garbage', async () => {
    const garbage: ApiClient = { callLearner: async () => 'I cannot do that' };
    const summary = await runChain({ client: garbage, config, runsDir: dir, sleep: async () => {} }, cond({}), 0);
    expect(summary.status).toBe('failed');
    expect(summary.lastGeneration).toBe(0);
    expect(summary.error).toBeDefined();
  });

  it('retries transient API errors with backoff', async () => {
    const mock = new MockClient();
    let failures = 2;
    const flaky: ApiClient = {
      callLearner: async (p, c) => {
        if (failures-- > 0) throw new Error('overloaded');
        return mock.callLearner(p, c);
      },
    };
    const delays: number[] = [];
    const summary = await runChain(
      { client: flaky, config, runsDir: dir, sleep: async (ms) => void delays.push(ms) },
      cond({ maxGenerations: 1 }),
      0
    );
    expect(summary.status).toBe('max-generations');
    expect(delays).toEqual([2000, 4000]);
  });

  it('paired chains share a seed language across conditions', async () => {
    const client = new MockClient();
    await runChain({ client, config, runsDir: dir, sleep: async () => {} }, cond({ name: 'a', maxGenerations: 1 }), 0);
    await runChain({ client, config, runsDir: dir, sleep: async () => {} }, cond({ name: 'b', presentation: 'inline', maxGenerations: 1 }), 0);
    const read = (n: string) => fs.readFile(path.join(chainDir(dir, n, 0), 'gen-000', 'language.json'), 'utf-8');
    expect(await read('a')).toBe(await read('b'));
  });
});

describe('reporting', () => {
  it('summarises chains into a table', async () => {
    const client = new MockClient();
    await runChain({ client, config, runsDir: dir, sleep: async () => {} }, cond({}), 0);
    const table = buildReport(await collectRows(dir, config.defaults.stasisWindow));
    expect(table).toContain('| c | 1 | 1 |');
    expect(table).toContain('action 1');
  });

  it('estimates game conditions at several calls per generation', () => {
    const [plain, game] = estimateCalls(config, [cond({}), cond({ name: 'g', pressure: 'game' })], 10);
    expect(plain.callsPerGeneration).toEqual([1, 1]);
    expect(game.callsPerGeneration).toEqual([3, 4]);
  });
});
