#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { createApiClient } from '../api.js';
import { generateSeedLanguage } from '../seedLanguage.js';
import { sampleTraining } from '../sampler.js';
import type { ApiClient } from '../types.js';
import { buildLearnerPrompt, createPresenter } from './present.js';
import { buildReport, collectRows } from './report.js';
import { deriveSeed } from './rng.js';
import { MockClient } from './mock.js';
import { estimateCalls, loadRun2Config, runAll, selectConditions, type Selection } from './runner.js';

const USAGE = `Usage: node dist/run2/cli.js <command> [options]

Commands:
  run        run (or resume) chains
  estimate   print the API call budget without calling anything
  prompt     print the speaker prompt for generation 1 of chain 0
  report     summarise finished chains into runs/REPORT.md

Options:
  --config <file>      default config/run2.json
  --runs <dir>         default runs
  --phase <n>          only conditions in this phase
  --condition <name>   only this condition
  --chains <n>         override the number of chains
  --mock               use the built-in mock learner (smoke test only, no API calls)
`;

function option(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

function selection(args: string[]): Selection {
  const phase = option(args, '--phase');
  const chains = option(args, '--chains');
  return {
    ...(phase ? { phase: Number(phase) } : {}),
    ...(chains ? { chains: Number(chains) } : {}),
    ...(option(args, '--condition') ? { condition: option(args, '--condition') } : {}),
  };
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const configFile = option(args, '--config') ?? 'config/run2.json';
  const runsDir = path.resolve(process.cwd(), option(args, '--runs') ?? 'runs');
  const config = await loadRun2Config(configFile);
  const conds = selectConditions(config, selection(args));

  if (command === 'estimate') {
    const rows = estimateCalls(config, conds, 50);
    for (const r of rows) {
      console.log(
        `${r.condition.padEnd(22)} ${r.chains} chains x ${r.callsPerGeneration.join('-')} calls/gen: ` +
          `expected ~${r.expectedCalls}, worst case ${r.worstCaseCalls}`
      );
    }
    console.log(
      `TOTAL expected ~${rows.reduce((a, r) => a + r.expectedCalls, 0)}, worst case ${rows.reduce((a, r) => a + r.worstCaseCalls, 0)}`
    );
    return;
  }

  if (command === 'prompt') {
    for (const cond of conds) {
      const presenter = createPresenter(cond, deriveSeed(config.baseSeed, 'ids', 0));
      const seedLanguage = generateSeedLanguage(deriveSeed(config.baseSeed, 'seed-language', 0));
      const { sample } = sampleTraining(
        seedLanguage,
        config.defaults,
        deriveSeed(config.baseSeed, 'sample', 0, 1)
      );
      const order = presenter.orderFor(deriveSeed(config.baseSeed, 'order', 0, 1));
      console.log(`===== ${cond.name} =====\n${await buildLearnerPrompt(cond, presenter, sample, order)}\n`);
    }
    return;
  }

  if (command === 'report') {
    const table = buildReport(await collectRows(runsDir, config.defaults.stasisWindow));
    await fs.mkdir(runsDir, { recursive: true });
    await fs.writeFile(path.join(runsDir, 'REPORT.md'), `${table}\n`);
    console.log(table);
    return;
  }

  if (command === 'run') {
    if (conds.length === 0) {
      console.error('No conditions selected.');
      process.exit(1);
    }
    const client: ApiClient = args.includes('--mock') ? new MockClient() : createApiClient();
    const results = await runAll(config, conds, client, runsDir, (m) => console.log(m));
    const failed = results.filter((r) => r.status === 'failed');
    console.log(`Done. ${results.length} chains, ${failed.length} failed.`);
    process.exit(failed.length > 0 ? 1 : 0);
  }

  console.log(USAGE);
  process.exit(command ? 1 : 0);
}

main().catch((error) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exit(1);
});
