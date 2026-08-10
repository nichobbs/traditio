import fs from 'fs/promises';
import path from 'path';
import { createHash } from 'crypto';
import type { Meaning, TrainingSample, LanguagePair } from './types.js';

async function readPromptTemplate(): Promise<string> {
  const templatePath = path.resolve(process.cwd(), 'prompts/learner-template.md');
  return fs.readFile(templatePath, 'utf-8');
}

export async function renderLearnerPrompt(sample: TrainingSample, allMeanings: Meaning[]): Promise<string> {
  const template = await readPromptTemplate();

  const trainingPairsJson = JSON.stringify(sample.pairs, null, 2);
  const meaningsJson = JSON.stringify(allMeanings, null, 2);

  return template
    .replace(/{{TRAINING_PAIRS}}/g, trainingPairsJson)
    .replace(/{{TARGET_MEANINGS}}/g, meaningsJson);
}

export function hashString(str: string): string {
  return createHash('sha256').update(str).digest('hex').substring(0, 8);
}

export function parseLanguageResponse(response: string): LanguagePair[] {
  let json = response.trim();

  const jsonMatch = json.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (jsonMatch) {
    json = jsonMatch[1];
  }

  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    throw new Error('Response must be a JSON array');
  }

  return parsed;
}
