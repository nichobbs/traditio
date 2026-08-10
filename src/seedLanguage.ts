import { SeededRNG } from './random.js';
import { generateMeanings } from './meanings.js';
import type { LanguagePair, Language } from './types.js';

const CONSONANTS = ['p', 't', 'k', 'm', 'n', 's', 'l', 'w', 'j', 'h'];
const VOWELS = ['a', 'e', 'i', 'o', 'u'];

function generateForm(rng: SeededRNG): string {
  const syllableCount = rng.randInt(2, 4);
  let form = '';

  for (let i = 0; i < syllableCount; i++) {
    form += rng.choice(CONSONANTS);
    form += rng.choice(VOWELS);
  }

  return form;
}

export function generateSeedLanguage(seed: number): Language {
  const rng = new SeededRNG(seed);
  const meanings = generateMeanings();

  const pairs: LanguagePair[] = meanings.map((meaning) => ({
    meaningId: meaning.id,
    form: generateForm(rng),
  }));

  return { pairs };
}
