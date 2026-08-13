#!/usr/bin/env node

import fs from 'fs/promises';
import { runGeneration, prepareGeneration, collectGeneration } from './runner.js';

async function writeGithubOutputs(fields: Record<string, string>): Promise<void> {
  const lines = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  console.log(lines);

  if (process.env.GITHUB_OUTPUT) {
    await fs.appendFile(process.env.GITHUB_OUTPUT, lines + '\n');
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const prepareIndex = args.indexOf('--prepare');
  const collectIndex = args.indexOf('--collect');

  try {
    if (prepareIndex !== -1) {
      const result = await prepareGeneration();
      const genDir = `gen-${String(result.genNumber).padStart(3, '0')}`;
      await writeGithubOutputs({
        gen_number: String(result.genNumber),
        gen_dir: genDir,
        needs_llm: String(result.needsLlm),
        model: result.model,
      });
      return;
    }

    if (collectIndex !== -1) {
      const genNumberArg = args[collectIndex + 1];
      const genNumber = Number(genNumberArg);
      if (!genNumberArg || Number.isNaN(genNumber)) {
        console.error('--collect requires a generation number, e.g. --collect 3');
        process.exit(1);
      }
      await collectGeneration(genNumber);
      return;
    }

    await runGeneration({ dryRun });
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.cause) {
      console.error('Cause:', error.cause);
    }
    process.exit(1);
  }
}

main();
