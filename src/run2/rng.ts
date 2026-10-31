import { createHash } from 'crypto';

// Stable 31-bit seed from arbitrary parts, so that every random choice in a
// run (seed language, sample, test set, shuffle) is reproducible and
// independent of the others.
export function deriveSeed(...parts: Array<string | number>): number {
  const digest = createHash('sha256').update(parts.join('|')).digest();
  return digest.readUInt32BE(0) % 2147483647;
}

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const rng = mulberry32(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
