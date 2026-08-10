import { describe, it, expect } from 'vitest';
import { generateMeanings, meaningDistance } from './meanings.js';

describe('meanings', () => {
  it('generates exactly 200 meanings', () => {
    const meanings = generateMeanings();
    expect(meanings.length).toBe(200);
  });

  it('generates stable, reproducible meanings', () => {
    const meanings1 = generateMeanings();
    const meanings2 = generateMeanings();
    expect(meanings1).toEqual(meanings2);
  });

  it('excludes agent == patient pairs', () => {
    const meanings = generateMeanings();
    for (const meaning of meanings) {
      expect(meaning.agent).not.toBe(meaning.patient);
    }
  });

  it('assigns unique IDs', () => {
    const meanings = generateMeanings();
    const ids = new Set(meanings.map((m) => m.id));
    expect(ids.size).toBe(meanings.length);
  });

  it('computes meaning distance correctly', () => {
    const m1 = generateMeanings()[0];
    const m2 = { ...m1, agent: 'bird' };
    expect(meaningDistance(m1, m2)).toBe(1);

    const m3 = { ...m1, agent: 'bird', action: 'eats' };
    expect(meaningDistance(m1, m3)).toBe(2);

    const m4 = { ...m1, agent: 'bird', action: 'eats', tense: 'nonpast' };
    expect(meaningDistance(m1, m4)).toBe(3);

    const m5 = { ...m1, agent: 'bird', action: 'eats', patient: 'river', tense: 'nonpast' };
    expect(meaningDistance(m1, m5)).toBe(4);
  });
});
