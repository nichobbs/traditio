import { SeededRNG } from './random.js';
import { generateMeanings } from './meanings.js';
import type { LanguagePair, Language, TrainingSample } from './types.js';

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface SamplerOptions {
  sampleFraction: number;
  maxTrainingTokens: number;
}

export function sampleTraining(
  language: Language,
  options: SamplerOptions,
  seed: number
): { sample: TrainingSample; inSampleMeaningIds: Set<string> } {
  const rng = new SeededRNG(seed);
  const meanings = generateMeanings();
  const meaningMap = new Map(language.pairs.map((p) => [p.meaningId, p.form]));

  const targetCount = Math.ceil(meanings.length * options.sampleFraction);
  const indices = Array.from({ length: meanings.length }, (_, i) => i);

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const sampled: LanguagePair[] = [];
  let tokenCount = 0;
  const inSampleMeaningIds = new Set<string>();

  for (let i = 0; i < Math.min(targetCount, indices.length); i++) {
    const idx = indices[i];
    const meaning = meanings[idx];
    const form = meaningMap.get(meaning.id);

    if (!form) continue;

    const pair: LanguagePair = { meaningId: meaning.id, form };
    const pairJson = JSON.stringify(pair);
    const estimatedTokens = estimateTokens(pairJson);

    if (tokenCount + estimatedTokens > options.maxTrainingTokens) {
      console.warn(
        `Training sample truncated at ${tokenCount} tokens (limit: ${options.maxTrainingTokens})`
      );
      break;
    }

    sampled.push(pair);
    inSampleMeaningIds.add(meaning.id);
    tokenCount += estimatedTokens;
  }

  return {
    sample: {
      pairs: sampled,
      meanings: meanings.filter((m) => inSampleMeaningIds.has(m.id)),
    },
    inSampleMeaningIds,
  };
}
