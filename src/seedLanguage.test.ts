import { describe, it, expect } from 'vitest';
import { generateSeedLanguage } from './seedLanguage.js';
import { generateMeanings } from './meanings.js';

describe('seed language', () => {
  it('generates a language with 200 pairs', () => {
    const language = generateSeedLanguage(42);
    expect(language.pairs.length).toBe(200);
  });

  it('generates stable language with same seed', () => {
    const lang1 = generateSeedLanguage(42);
    const lang2 = generateSeedLanguage(42);
    expect(lang1).toEqual(lang2);
  });

  it('generates different language with different seed', () => {
    const lang1 = generateSeedLanguage(42);
    const lang2 = generateSeedLanguage(43);
    expect(lang1).not.toEqual(lang2);
  });

  it('generates forms with valid structure', () => {
    const language = generateSeedLanguage(42);
    for (const pair of language.pairs) {
      expect(pair.form).toMatch(/^[a-z]+$/);
      expect(pair.form.length).toBeGreaterThanOrEqual(4);
      expect(pair.form.length).toBeLessThanOrEqual(8);
    }
  });

  it('covers all meanings', () => {
    const language = generateSeedLanguage(42);
    const meanings = generateMeanings();
    const meanings_set = new Set(meanings.map((m) => m.id));
    const pairs_set = new Set(language.pairs.map((p) => p.meaningId));
    expect(pairs_set).toEqual(meanings_set);
  });

  it('generates forms from correct phoneme inventory', () => {
    const consonants = new Set(['p', 't', 'k', 'm', 'n', 's', 'l', 'w', 'j', 'h']);
    const vowels = new Set(['a', 'e', 'i', 'o', 'u']);

    const language = generateSeedLanguage(42);
    for (const pair of language.pairs) {
      for (let i = 0; i < pair.form.length; i++) {
        const char = pair.form[i];
        const isConsonant = consonants.has(char);
        const isVowel = vowels.has(char);
        expect(isConsonant || isVowel).toBe(true);

        if (i % 2 === 0) {
          expect(isConsonant).toBe(true);
        } else {
          expect(isVowel).toBe(true);
        }
      }
    }
  });
});
