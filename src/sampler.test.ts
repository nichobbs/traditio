import { describe, it, expect } from 'vitest';
import { sampleTraining } from './sampler.js';
import { generateSeedLanguage } from './seedLanguage.js';

describe('sampler', () => {
  it('respects sample fraction', () => {
    const language = generateSeedLanguage(42);
    const { sample } = sampleTraining(language, { sampleFraction: 0.4, maxTrainingTokens: 100000 }, 42);

    const expected = Math.ceil(200 * 0.4);
    expect(sample.pairs.length).toBeCloseTo(expected, 0);
  });

  it('respects max training tokens', () => {
    const language = generateSeedLanguage(42);
    const { sample } = sampleTraining(language, { sampleFraction: 0.5, maxTrainingTokens: 200 }, 42);

    let estimatedTokens = 0;
    for (const pair of sample.pairs) {
      estimatedTokens += Math.ceil(JSON.stringify(pair).length / 4);
    }

    expect(estimatedTokens).toBeLessThanOrEqual(200);
  });

  it('returns deterministic sample with same seed', () => {
    const language = generateSeedLanguage(42);
    const sample1 = sampleTraining(language, { sampleFraction: 0.4, maxTrainingTokens: 100000 }, 100);
    const sample2 = sampleTraining(language, { sampleFraction: 0.4, maxTrainingTokens: 100000 }, 100);

    expect(sample1.sample.pairs).toEqual(sample2.sample.pairs);
    expect(sample1.inSampleMeaningIds).toEqual(sample2.inSampleMeaningIds);
  });

  it('returns different samples with different seeds', () => {
    const language = generateSeedLanguage(42);
    const sample1 = sampleTraining(language, { sampleFraction: 0.4, maxTrainingTokens: 100000 }, 100);
    const sample2 = sampleTraining(language, { sampleFraction: 0.4, maxTrainingTokens: 100000 }, 101);

    expect(sample1.sample.pairs).not.toEqual(sample2.sample.pairs);
  });

  it('includes all sampled meanings in meanings array', () => {
    const language = generateSeedLanguage(42);
    const { sample } = sampleTraining(language, { sampleFraction: 0.4, maxTrainingTokens: 100000 }, 42);

    const meaningIds = new Set(sample.meanings.map((m) => m.id));
    const pairIds = new Set(sample.pairs.map((p) => p.meaningId));

    expect(meaningIds).toEqual(pairIds);
  });
});
