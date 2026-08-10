import fs from 'fs/promises';
import path from 'path';
import { generateMeanings } from './meanings.js';
import { generateSeedLanguage } from './seedLanguage.js';
import { sampleTraining } from './sampler.js';
import { computeMetrics } from './metrics.js';
import { renderLearnerPrompt, hashString, parseLanguageResponse } from './prompt.js';
import { validateLanguageResponse } from './validation.js';
import { createApiClient } from './api.js';
import type { ExperimentConfig, GenerationOutput, Language, LanguagePair, ApiClient, GenerationMeta } from './types.js';

async function loadConfig(): Promise<ExperimentConfig> {
  const configPath = path.resolve(process.cwd(), 'config/experiment.json');
  const data = await fs.readFile(configPath, 'utf-8');
  return JSON.parse(data);
}

async function loadLanguage(genNumber: number): Promise<Language> {
  const languagePath = path.resolve(process.cwd(), `corpus/gen-${String(genNumber).padStart(3, '0')}/language.json`);
  const data = await fs.readFile(languagePath, 'utf-8');
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
  const genDir = path.resolve(process.cwd(), `corpus/gen-${String(genNumber).padStart(3, '0')}`);
  await ensureDirectory(genDir);

  const language: Language = { pairs: output.pairs };
  await fs.writeFile(path.join(genDir, 'language.json'), JSON.stringify(language, null, 2));
  await fs.writeFile(path.join(genDir, 'metrics.json'), JSON.stringify(output.metrics, null, 2));
  await fs.writeFile(path.join(genDir, 'meta.json'), JSON.stringify(output.meta, null, 2));
}

export interface RunOptions {
  dryRun?: boolean;
  apiClient?: ApiClient;
}

export async function runGeneration(options: RunOptions = {}): Promise<void> {
  const config = await loadConfig();
  const meanings = generateMeanings();
  const apiClient = options.apiClient || createApiClient();

  let currentGenNumber = await findLatestGeneration();
  const nextGenNumber = currentGenNumber + 1;

  let currentLanguage: Language;
  if (currentGenNumber === -1) {
    console.log('Generating seed language (generation 0)...');
    currentLanguage = generateSeedLanguage(config.seed);
  } else {
    console.log(`Loading generation ${currentGenNumber}...`);
    currentLanguage = await loadLanguage(currentGenNumber);
  }

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

  let rawPath = path.resolve(process.cwd(), `corpus/gen-${String(nextGenNumber).padStart(3, '0')}/raw-response.txt`);
  await ensureDirectory(path.dirname(rawPath));
  await fs.writeFile(rawPath, response);

  console.log('Parsing response...');
  let pairs: LanguagePair[] = [];
  try {
    const parsed = parseLanguageResponse(response);
    pairs = validateLanguageResponse(parsed);
  } catch (error) {
    console.error('Validation failed on first attempt. Retrying with correction note...');

    const correctionPrompt = prompt + '\n\nYour previous response failed validation. Please provide a JSON array with exactly this structure: [{"meaningId": "m000", "form": "example"}, ...]';
    response = await apiClient.callLearner(correctionPrompt, {
      model: config.model,
      maxOutputTokens: config.maxOutputTokens,
      temperature: config.temperature,
    });

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
  const previousLanguage = currentGenNumber >= 0 ? currentLanguage : null;
  const metrics = await computeMetrics(
    { pairs },
    previousLanguage,
    inSampleMeaningIds
  );

  const meta: GenerationMeta = {
    generationNumber: nextGenNumber,
    model: config.model,
    timestamp: new Date().toISOString(),
    configHash,
    promptHash,
  };

  const output: GenerationOutput = {
    pairs,
    metrics,
    meta,
  };

  console.log('Saving generation...');
  await saveGeneration(output, nextGenNumber);

  console.log('Committing to git...');
  const { execSync } = await import('child_process');
  const genDir = `corpus/gen-${String(nextGenNumber).padStart(3, '0')}`;
  execSync(`git add ${genDir}`, { cwd: process.cwd() });
  execSync(`git commit -m "gen ${nextGenNumber} (${config.model})"`, { cwd: process.cwd() });

  console.log(`Generation ${nextGenNumber} complete.`);
}
