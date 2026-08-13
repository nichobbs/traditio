#!/usr/bin/env node

import { runGeneration } from './runner.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  try {
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
