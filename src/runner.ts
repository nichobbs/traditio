import fs from 'fs/promises';
import path from 'path';
import { generateMeanings } from './meanings.js';
import { generateSeedLanguage } from './seedLanguage.js';
import { sampleTraining } from './sampler.js';
import { computeMetrics } from './metrics.js';
import { renderLearnerPrompt, hashString, parseLanguageResponse } from './prompt.js';
import { validateLanguageResponse } from './validation.js';
import { createApiClient } from './api.js';
import type {
  ExperimentConfig,
  GenerationOutput,
  Language,
  LanguagePair,
  ApiClient,
  GenerationMeta,
} from './types.js';

async function loadConfig(): Promise<ExperimentConfig> {
  const configPath = path.resolve(process.cwd(), 'config/experiment.json');
  const data = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(data);
}

function genDirPath(genNumber: number): string {
  return path.resolve(process.cwd(), `corpus/gen-${String(genNumber).padStart(3, '0')}`);
}

async function loadLanguage(genNumber: number): Promise<Language> {
  const data = await fs.readFile(path.join(genDirPath(genNumber), 'language.json'), 'utf-8');
  return JSON.parse(data);
}

async function findLatestGeneration(): Promise<number> {
  const corpusPath = path.resolve(process.cwd(), 'corpus');
  try {
    const entries = await fs.readdir(corpusPath);
    const genDirs = entries.filter((e) => /^gen-\d+$/.test(e)).sort();
    if (genDirs.length === 0) return -1;
    return parseInt(genDirs[genDirs.length - 1].slice(4), 10);
  } catch {
    return -1;
  }
}

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function saveGeneration(output: GenerationOutput, genNumber: number): Promise<void> {
  const genDir = genDirPath(genNumber);
  await ensureDirectory(genDir);

  const language: Language = { pairs: output.pairs };
  await fs.writeFile(path.join(genDir, 'language.json'), JSON.stringify(language, null, 2));
  await fs.writeFile(path.join(genDir, 'metrics.json'), JSON.stringify(output.metrics, null, 2));
  await fs.writeFile(path.join(genDir, 'meta.json'), JSON.stringify(output.meta, null, 2));
}

async function commitGeneration(genNumber: number, model: string): Promise<void> {
  const { execSync } = await import('child_process');
  const genDir = `corpus/gen-${String(genNumber).padStart(3, '0')}`;
  execSync(`git add ${genDir}`, { cwd: process.cwd() });
  execSync(`git commit -m "gen ${genNumber} (${model})"`, { cwd: process.cwd() });
}

// If no generation exists yet, the seed language IS generation 0 - it is
// saved directly with no learner/LLM involvement. Returns true if it created
// gen-000 (the caller should stop there; the next invocation produces gen-001).
async function ensureSeedGeneration(config: ExperimentConfig): Promise<boolean> {
  const latest = await findLatestGeneration();
  if (latest !== -1) return false;

  console.log('Generating seed language (generation 0)...');
  const seedLanguage = generateSeedLanguage(config.seed);
  const genDir = genDirPath(0);
  await ensureDirectory(genDir);
  await fs.writeFile(path.join(genDir, 'language.json'), JSON.stringify(seedLanguage, null, 2));

  const meta: GenerationMeta = {
    generationNumber: 0,
    model: 'seed',
    timestamp: new Date().toISOString(),
    configHash: hashString(JSON.stringify(config)),
    promptHash: '',
  };
  await fs.writeFile(path.join(genDir, 'meta.json'), JSON.stringify(meta, null, 2));

  await commitGeneration(0, 'seed');
  console.log('Generation 0 (seed) complete.');
  return true;
}

export interface RunOptions {
  dryRun?: boolean;
  apiClient?: ApiClient;
}

// Single-process flow: renders the prompt, calls the LLM inline via apiClient,
// validates, computes metrics, and commits - all in one invocation. Used for
// local runs and the metered-API-key path.
export async function runGeneration(options: RunOptions = {}): Promise<void> {
  const config = await loadConfig();
  const meanings = generateMeanings();

  if (!options.dryRun && (await ensureSeedGeneration(config))) {
    return;
  }

  const apiClient = options.apiClient || createApiClient();
  const currentGenNumber = await findLatestGeneration();
  const nextGenNumber = currentGenNumber + 1;

  console.log(`Loading generation ${currentGenNumber}...`);
  const currentLanguage = await loadLanguage(currentGenNumber);

  console.log(`Creating training sample for generation ${nextGenNumber}...`);
  const sampleSeed = config.seed + nextGenNumber;
  const { sample, inSampleMeaningIds } = sampleTraining(currentLanguage, config.bottleneck, sampleSeed);

  console.log(`Training sample: ${sample.pairs.length} pairs`);

  console.log('Rendering learner prompt...');
  const prompt = await renderLearnerPrompt(sample, meanings);
  const promptHash = hashString(prompt);

  if (options.dryRun) {
    console.log('\n=== DRY RUN: Rendered Prompt ===\n');
    console.log(prompt);
    console.log('\n=== END PROMPT ===\n');
    return;
  }

  console.log('Calling LLM...');
  const configHash = hashString(JSON.stringify(config));
  let response = await apiClient.callLearner(prompt, {
    model: config.model,
    maxOutputTokens: config.maxOutputTokens,
    temperature: config.temperature,
  });

  const genDir = genDirPath(nextGenNumber);
  await ensureDirectory(genDir);
  await fs.writeFile(path.join(genDir, 'training-sample.json'), JSON.stringify(sample, null, 2));
  await fs.writeFile(path.join(genDir, 'raw-response.txt'), response);

  console.log('Parsing response...');
  let pairs: LanguagePair[] = [];
  try {
    const parsed = parseLanguageResponse(response);
    pairs = validateLanguageResponse(parsed);
  } catch {
    console.error('Validation failed on first attempt. Retrying with correction note...');

    const correctionPrompt =
      prompt +
      '\n\nYour previous response failed validation. Please provide a JSON array with exactly this structure: [{"meaningId": "m000", "form": "example"}, ...]';
    response = await apiClient.callLearner(correctionPrompt, {
      model: config.model,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
    });
    await fs.writeFile(path.join(genDir, 'raw-response.txt'), response);

    try {
      const parsed = parseLanguageResponse(response);
      pairs = validateLanguageResponse(parsed);
    } catch (retryError) {
      console.error('Validation failed on retry. Aborting without commit.');
      if (retryError instanceof Error) {
        console.error(retryError.message);
      }
      process.exit(1);
    }
  }

  if (pairs.length !== meanings.length) {
    console.error(`Expected ${meanings.length} pairs, got ${pairs.length}. Aborting.`);
    process.exit(1);
  }

  const allMeaningIds = new Set(meanings.map((m) => m.id));
  const responseMeaningIds = new Set(pairs.map((p) => p.meaningId));

  if (allMeaningIds.size !== responseMeaningIds.size || ![...allMeaningIds].every((id) => responseMeaningIds.has(id))) {
    console.error('Response does not cover all meanings. Aborting.');
    process.exit(1);
  }

  console.log('Computing metrics...');
  const metrics = await computeMetrics({ pairs }, currentLanguage, inSampleMeaningIds);

  const meta: GenerationMeta = {
    generationNumber: nextGenNumber,
    model: config.model,
    timestamp: new Date().toISOString(),
    configHash,
    promptHash,
  };

  console.log('Saving generation...');
  await saveGeneration({ pairs, metrics, meta }, nextGenNumber);

  console.log('Committing to git...');
  await commitGeneration(nextGenNumber, config.model);

  console.log(`Generation ${nextGenNumber} complete.`);
}

export interface PrepareResult {
  genNumber: number;
  model: string;
  needsLlm: boolean;
}

// Two-phase flow for external callers (e.g. the Claude Code GitHub Action)
// that can't be invoked as an in-process function: prepare() renders and
// writes the prompt to disk; the external tool is then responsible for
// writing corpus/gen-NNN/raw-response.txt; collect() picks that up,
// validates, computes metrics, and commits. needsLlm is false only when
// prepare() just created the seed generation (gen-000), which involves no
// learner/LLM call at all - the caller should skip straight past collect().
export async function prepareGeneration(): Promise<PrepareResult> {
  const config = await loadConfig();

  if (await ensureSeedGeneration(config)) {
    return { genNumber: 0, model: config.model, needsLlm: false };
  }

  const meanings = generateMeanings();
  const currentGenNumber = await findLatestGeneration();
  const nextGenNumber = currentGenNumber + 1;

  console.error(`Loading generation ${currentGenNumber}...`);
  const currentLanguage = await loadLanguage(currentGenNumber);

  console.error(`Creating training sample for generation ${nextGenNumber}...`);
  const sampleSeed = config.seed + nextGenNumber;
  const { sample } = sampleTraining(currentLanguage, config.bottleneck, sampleSeed);

  console.error('Rendering learner prompt...');
  const prompt = await renderLearnerPrompt(sample, meanings);

  const genDir = genDirPath(nextGenNumber);
  await ensureDirectory(genDir);
  await fs.writeFile(path.join(genDir, 'training-sample.json'), JSON.stringify(sample, null, 2));
  await fs.writeFile(path.join(genDir, 'prompt.txt'), prompt);

  return { genNumber: nextGenNumber, model: config.model, needsLlm: true };
}

export async function collectGeneration(genNumber: number): Promise<void> {
  const config = await loadConfig();
  const meanings = generateMeanings();
  const genDir = genDirPath(genNumber);

  const currentLanguage = await loadLanguage(genNumber - 1);

  const sampleSeed = config.seed + genNumber;
  const { inSampleMeaningIds } = sampleTraining(currentLanguage, config.bottleneck, sampleSeed);

  const prompt = await fs.readFile(path.join(genDir, 'prompt.txt'), 'utf-8');
  const promptHash = hashString(prompt);
  const configHash = hashString(JSON.stringify(config));

  const response = await fs.readFile(path.join(genDir, 'raw-response.txt'), 'utf-8');

  console.log('Parsing response...');
  let pairs: LanguagePair[];
  try {
    const parsed = parseLanguageResponse(response);
    pairs = validateLanguageResponse(parsed);
  } catch (error) {
    console.error('Validation failed. Aborting without commit.');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }

  if (pairs.length !== meanings.length) {
    console.error(`Expected ${meanings.length} pairs, got ${pairs.length}. Aborting.`);
    process.exit(1);
  }

  const allMeaningIds = new Set(meanings.map((m) => m.id));
  const responseMeaningIds = new Set(pairs.map((p) => p.meaningId));

  if (allMeaningIds.size !== responseMeaningIds.size || ![...allMeaningIds].every((id) => responseMeaningIds.has(id))) {
    console.error('Response does not cover all meanings. Aborting.');
    process.exit(1);
  }

  console.log('Computing metrics...');
  const metrics = await computeMetrics({ pairs }, currentLanguage, inSampleMeaningIds);

  const meta: GenerationMeta = {
    generationNumber: genNumber,
    model: config.model,
    timestamp: new Date().toISOString(),
    configHash,
    promptHash,
  };

  console.log('Saving generation...');
  await saveGeneration({ pairs, metrics, meta }, genNumber);

  console.log('Committing to git...');
  await commitGeneration(genNumber, config.model);

  console.log(`Generation ${genNumber} complete.`);
}
