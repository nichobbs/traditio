import { describe, expect, it } from 'vitest';
import { generateMeanings } from '../meanings.js';
import { mulberry32 } from './rng.js';
import {
  computeStructureMetrics,
  conditionalEntropyByDimension,
  expressivity,
  syncretismByDimension,
} from './metrics.js';

const meanings = generateMeanings();
// Distinct forms with no relation to meaning order (numbered strings would
// correlate with the enumeration order of the meaning space).
const rng = mulberry32(5);
const distinct = meanings.map(() => {
  let form = '';
  for (let k = 0; k < 8; k++) form += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(rng() * 26)];
  return form;
});
const noAction = meanings.map((m) => `${m.agent}-${m.patient}-${m.tense}`);

describe('structure metrics', () => {
  it('a language with a distinct form per meaning has no syncretism or residual entropy', () => {
    expect(Object.values(syncretismByDimension(distinct)).every((v) => v === 0)).toBe(true);
    expect(Object.values(conditionalEntropyByDimension(distinct)).every((v) => v === 0)).toBe(true);
    expect(expressivity(distinct)).toMatchObject({ uniqueForms: 200, oracleAccuracy: 1 });
    expect(expressivity(distinct).normalizedFormEntropy).toBeCloseTo(1, 10);
  });

  it('detects a language that ignores the action dimension', () => {
    const s = syncretismByDimension(noAction);
    expect(s.action).toBe(1);
    expect(s.agent).toBe(0);
    expect(s.patient).toBe(0);
    expect(s.tense).toBe(0);
    expect(conditionalEntropyByDimension(noAction).action).toBeCloseTo(Math.log2(5), 10);
    expect(expressivity(noAction)).toMatchObject({ uniqueForms: 40, oracleAccuracy: 0.2 });
    expect(computeStructureMetrics(noAction).droppedDimensions).toEqual(['action']);
  });

  it('a holistic language has no structure under Spearman topographic similarity', () => {
    const holistic = computeStructureMetrics(distinct);
    expect(Math.abs(holistic.topographicSpearman)).toBeLessThan(0.1);
    expect(computeStructureMetrics(noAction).topographicSpearman).toBeGreaterThan(0.5);
  });
});
