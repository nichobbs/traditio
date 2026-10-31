import fs from 'fs/promises';
import { describe, expect, it } from 'vitest';
import { generateMeanings } from '../meanings.js';
import { sampleTraining } from '../sampler.js';
import type { Language } from '../types.js';
import { buildLearnerPrompt, createPresenter, MEANING_COUNT } from './present.js';
import { ResponseError, parseForms, parseListening } from './parse.js';
import { Run2ConfigSchema, type ConditionConfig } from './types.js';

function cond(overrides: Partial<ConditionConfig> = {}): ConditionConfig {
  return {
    name: 't',
    phase: 1,
    presentation: 'inline-shuffled',
    pressure: 'none',
    fieldOrder: ['agent', 'action', 'patient', 'tense'],
    ...overrides,
  };
}

const language: Language = {
  pairs: generateMeanings().map((m, i) => ({ meaningId: m.id, form: `f${i}`.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]) })),
};
const { sample } = sampleTraining(language, { sampleFraction: 0.4, maxTrainingTokens: 4000 }, 7);

describe('presenter', () => {
  it('ids presentation reproduces the run 1 prompt byte for byte', async () => {
    const dir = 'corpus/gen-210';
    let expected: string;
    let previous: Language;
    try {
      expected = await fs.readFile(`${dir}/prompt.txt`, 'utf-8');
      previous = JSON.parse(await fs.readFile('corpus/gen-209/language.json', 'utf-8'));
    } catch {
      return; // corpus not present in this checkout
    }
    const { sample: s } = sampleTraining(previous, { sampleFraction: 0.4, maxTrainingTokens: 4000 }, 42 + 210);
    const c = cond({ presentation: 'ids' });
    const presenter = createPresenter(c, 1);
    const prompt = await buildLearnerPrompt(c, presenter, s, presenter.orderFor(1));
    expect(prompt).toBe(expected);
  });

  it('inline presentation puts the meaning fields on every example', async () => {
    const c = cond({ presentation: 'inline' });
    const presenter = createPresenter(c, 1);
    const examples = presenter.examples(sample).split('\n');
    expect(examples).toHaveLength(sample.pairs.length);
    for (const line of examples) expect(line).toMatch(/^\{"agent":"\w+","action":"\w+","patient":"\w+","tense":"\w+"\} -> "[a-z]+"$/);
    expect(presenter.orderFor(5)).toEqual(Array.from({ length: MEANING_COUNT }, (_, i) => i));
  });

  it('inline-shuffled uses unique opaque ids and a shuffled order', () => {
    const presenter = createPresenter(cond(), 99);
    const ids = Array.from({ length: MEANING_COUNT }, (_, i) => presenter.idOf(i));
    expect(new Set(ids).size).toBe(MEANING_COUNT);
    expect(ids.every((id) => /^x[a-z0-9]{4}$/.test(id))).toBe(true);
    const order = presenter.orderFor(3);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: MEANING_COUNT }, (_, i) => i));
    expect(order).not.toEqual([...order].sort((a, b) => a - b));
    expect(presenter.orderFor(3)).toEqual(order);
  });

  it('applies field order and action labels', () => {
    const presenter = createPresenter(
      cond({ fieldOrder: ['action', 'agent', 'patient', 'tense'], actionLabels: ['a1', 'a2', 'a3', 'a4', 'a5'] }),
      1
    );
    expect(Object.keys(presenter.fields(0))).toEqual(['action', 'agent', 'patient', 'tense']);
    expect(presenter.fields(0).action).toBe('a1');
    expect(presenter.fields(0).agent).toBe('wolf');
  });
});

describe('response parsing', () => {
  const presenter = createPresenter(cond(), 1);
  const full = Array.from({ length: MEANING_COUNT }, (_, i) => ({ id: presenter.idOf(i), form: 'ab' }));

  it('parses a complete response, including fenced JSON', () => {
    expect(parseForms(JSON.stringify(full), presenter)).toHaveLength(MEANING_COUNT);
    expect(parseForms('```json\n' + JSON.stringify(full) + '\n```', presenter)).toHaveLength(MEANING_COUNT);
  });

  it('rejects missing, duplicate and malformed entries', () => {
    expect(() => parseForms(JSON.stringify(full.slice(1)), presenter)).toThrow(ResponseError);
    expect(() => parseForms(JSON.stringify([...full.slice(1), full[1]]), presenter)).toThrow(/more than once/);
    expect(() => parseForms(JSON.stringify([{ ...full[0], form: 'AB' }, ...full.slice(1)]), presenter)).toThrow(/lowercase/);
    expect(() => parseForms('not json', presenter)).toThrow(ResponseError);
  });

  it('parses listener answers and treats unknown ids as no answer', () => {
    const answers = parseListening(
      JSON.stringify([{ item: 1, id: presenter.idOf(5) }, { item: 2, id: 'nope' }]),
      presenter,
      2
    );
    expect(answers).toEqual([5, undefined]);
    expect(() => parseListening(JSON.stringify([{ item: 1, id: presenter.idOf(5) }]), presenter, 2)).toThrow(/missing/);
  });
});

describe('config schema', () => {
  const base = {
    baseSeed: 1,
    defaults: {
      model: 'm', maxOutputTokens: 1, temperature: 1, listenerTemperature: 0, sampleFraction: 0.4,
      maxTrainingTokens: 1, maxGenerations: 1, stasisWindow: 1, stasisEpsilon: 0, chains: 1,
      testItems: 1, confusionsShown: 1, postTest: true, concurrency: 1,
    },
  };
  it('rejects pressure with the ids presentation and duplicate names', () => {
    const bad = { ...base, conditions: [{ name: 'a', phase: 1, presentation: 'ids', pressure: 'game' }] };
    expect(() => Run2ConfigSchema.parse(bad)).toThrow();
    const dup = {
      ...base,
      conditions: [
        { name: 'a', phase: 1, presentation: 'inline', pressure: 'none' },
        { name: 'a', phase: 1, presentation: 'inline', pressure: 'none' },
      ],
    };
    expect(() => Run2ConfigSchema.parse(dup)).toThrow();
  });
  it('accepts the shipped config', async () => {
    const text = await fs.readFile('config/run2.json', 'utf-8');
    expect(() => Run2ConfigSchema.parse(JSON.parse(text))).not.toThrow();
  });
});
