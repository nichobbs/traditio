import { generateMeanings, meaningDistance } from '../meanings.js';
import { normalizedLevenshtein } from '../metrics.js';
import { DIMENSIONS, type Dimension } from './types.js';

const MEANINGS = generateMeanings();

export type PerDimension = Record<Dimension, number>;

function perDimension(fn: (d: Dimension) => number): PerDimension {
  return Object.fromEntries(DIMENSIONS.map((d) => [d, fn(d)])) as PerDimension;
}

// For every pair of meanings that differ only in `dimension`, the fraction
// that share an identical form. 1 means the language never distinguishes
// values of that dimension; 0 means it always does.
export function syncretismByDimension(forms: string[]): PerDimension {
  const shared = perDimension(() => 0);
  const total = perDimension(() => 0);
  for (let i = 0; i < MEANINGS.length; i++) {
    for (let j = i + 1; j < MEANINGS.length; j++) {
      const differing = DIMENSIONS.filter((d) => MEANINGS[i][d] !== MEANINGS[j][d]);
      if (differing.length !== 1) continue;
      const d = differing[0];
      total[d]++;
      if (forms[i] === forms[j]) shared[d]++;
    }
  }
  return perDimension((d) => (total[d] === 0 ? 0 : shared[d] / total[d]));
}

function groupByForm(forms: string[]): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  forms.forEach((form, i) => {
    const group = groups.get(form);
    if (group) group.push(i);
    else groups.set(form, [i]);
  });
  return groups;
}

// H(dimension | form) in bits: how much a listener who knows the form still
// does not know about that dimension. 0 means the form fully determines it.
export function conditionalEntropyByDimension(forms: string[]): PerDimension {
  const groups = groupByForm(forms);
  return perDimension((d) => {
    let entropy = 0;
    for (const members of groups.values()) {
      const counts = new Map<string, number>();
      for (const i of members) counts.set(MEANINGS[i][d], (counts.get(MEANINGS[i][d]) ?? 0) + 1);
      let h = 0;
      for (const c of counts.values()) {
        const p = c / members.length;
        h -= p * Math.log2(p);
      }
      entropy += (members.length / forms.length) * h;
    }
    return entropy;
  });
}

export interface Expressivity {
  uniqueForms: number;
  // Accuracy of an ideal listener who always guesses the most likely meaning.
  oracleAccuracy: number;
  // Entropy of the form distribution over the meaning space, divided by its
  // maximum (log2 of the number of meanings).
  normalizedFormEntropy: number;
}

export function expressivity(forms: string[]): Expressivity {
  const groups = groupByForm(forms);
  let entropy = 0;
  for (const members of groups.values()) {
    const p = members.length / forms.length;
    entropy -= p * Math.log2(p);
  }
  return {
    uniqueForms: groups.size,
    oracleAccuracy: groups.size / forms.length,
    normalizedFormEntropy: forms.length > 1 ? entropy / Math.log2(forms.length) : 0,
  };
}

function ranks(values: number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
  const out = new Array<number>(values.length);
  let start = 0;
  while (start < order.length) {
    let end = start;
    while (end + 1 < order.length && order[end + 1][0] === order[start][0]) end++;
    const rank = (start + end) / 2 + 1;
    for (let k = start; k <= end; k++) out[order[k][1]] = rank;
    start = end + 1;
  }
  return out;
}

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n;
  const my = y.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let sx = 0;
  let sy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    sx += (x[i] - mx) ** 2;
    sy += (y[i] - my) ** 2;
  }
  const den = Math.sqrt(sx * sy);
  return den === 0 ? 0 : num / den;
}

// Spearman rank correlation between meaning distance and form distance, a
// robustness check on the Pearson compositionality in src/metrics.ts.
export function topographicSimilarity(forms: string[]): number {
  const semantic: number[] = [];
  const formal: number[] = [];
  for (let i = 0; i < MEANINGS.length; i++) {
    for (let j = i + 1; j < MEANINGS.length; j++) {
      semantic.push(meaningDistance(MEANINGS[i], MEANINGS[j]));
      formal.push(normalizedLevenshtein(forms[i], forms[j]));
    }
  }
  return pearson(ranks(semantic), ranks(formal));
}

export const DROPPED_THRESHOLD = 0.9;

export function droppedDimensions(syncretism: PerDimension): Dimension[] {
  return DIMENSIONS.filter((d) => syncretism[d] >= DROPPED_THRESHOLD);
}

export interface StructureMetrics {
  syncretism: PerDimension;
  conditionalEntropy: PerDimension;
  expressivity: Expressivity;
  topographicSpearman: number;
  droppedDimensions: Dimension[];
}

export function computeStructureMetrics(forms: string[]): StructureMetrics {
  const syncretism = syncretismByDimension(forms);
  return {
    syncretism,
    conditionalEntropy: conditionalEntropyByDimension(forms),
    expressivity: expressivity(forms),
    topographicSpearman: topographicSimilarity(forms),
    droppedDimensions: droppedDimensions(syncretism),
  };
}
