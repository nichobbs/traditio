import fs from 'fs/promises';
import path from 'path';
import { AGENTS, ACTIONS, generateMeanings } from '../meanings.js';
import type { TrainingSample } from '../types.js';
import { mulberry32, shuffled } from './rng.js';
import type { ConditionConfig, Dimension } from './types.js';

const MEANINGS = generateMeanings();
export const MEANING_COUNT = MEANINGS.length;

export function canonicalIndex(meaningId: string): number {
  return parseInt(meaningId.slice(1), 10);
}

function canonicalId(index: number): string {
  return `m${String(index).padStart(3, '0')}`;
}

// How meanings are shown to the model. Everything the learner sees goes
// through here, so the presentation can be varied one thing at a time:
//  - ids: examples are {meaningId, form} only and the learner must join them
//    to the target list by ID. This reproduces run 1 exactly.
//  - inline: each example carries its meaning fields.
//  - inline-shuffled: as inline, but targets are shuffled per call and carry
//    opaque IDs, so neither order nor numbering encodes the meaning structure.
export interface Presenter {
  readonly presentation: ConditionConfig['presentation'];
  idOf(index: number): string;
  indexOfId(id: string): number | undefined;
  orderFor(seed: number): number[];
  fields(index: number): Record<string, string>;
  examples(sample: TrainingSample): string;
  shape(): string;
  targets(order: number[]): string;
  previousLanguage(order: number[], forms: string[]): string;
  items(forms: string[], test: number[]): string;
}

function opaqueIds(seed: number): string[] {
  const rng = mulberry32(seed);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const seen = new Set<string>();
  const ids: string[] = [];
  while (ids.length < MEANING_COUNT) {
    let id = 'x';
    for (let i = 0; i < 4; i++) id += alphabet[Math.floor(rng() * alphabet.length)];
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function createPresenter(cond: ConditionConfig, idSeed: number): Presenter {
  const ids =
    cond.presentation === 'inline-shuffled'
      ? opaqueIds(idSeed)
      : MEANINGS.map((_, i) => canonicalId(i));
  const indexById = new Map(ids.map((id, i) => [id, i]));

  const label = (dim: Dimension, value: string): string => {
    if (dim === 'action' && cond.actionLabels) {
      return cond.actionLabels[ACTIONS.indexOf(value as (typeof ACTIONS)[number])];
    }
    if ((dim === 'agent' || dim === 'patient') && cond.agentLabels) {
      return cond.agentLabels[AGENTS.indexOf(value as (typeof AGENTS)[number])];
    }
    return value;
  };

  const fields = (index: number): Record<string, string> => {
    const m = MEANINGS[index];
    const out: Record<string, string> = {};
    for (const dim of cond.fieldOrder) out[dim] = label(dim, m[dim]);
    return out;
  };

  const orderFor = (seed: number): number[] => {
    const canonical = MEANINGS.map((_, i) => i);
    return cond.presentation === 'inline-shuffled' ? shuffled(canonical, seed) : canonical;
  };

  return {
    presentation: cond.presentation,
    idOf: (index) => ids[index],
    indexOfId: (id) => indexById.get(id),
    orderFor,
    fields,
    examples(sample) {
      if (cond.presentation === 'ids') return JSON.stringify(sample.pairs, null, 2);
      return sample.pairs
        .map((p) => `${JSON.stringify(fields(canonicalIndex(p.meaningId)))} -> ${JSON.stringify(p.form)}`)
        .join('\n');
    },
    shape() {
      const placeholder = Object.fromEntries(cond.fieldOrder.map((d) => [d, '...']));
      return `${JSON.stringify(placeholder)} -> "form"`;
    },
    targets(order) {
      return JSON.stringify(
        order.map((i) => ({ id: ids[i], ...fields(i) })),
        null,
        2
      );
    },
    previousLanguage(order, forms) {
      return JSON.stringify(
        order.map((i) => ({ id: ids[i], ...fields(i), form: forms[i] })),
        null,
        2
      );
    },
    items(forms, test) {
      return JSON.stringify(
        test.map((meaningIndex, k) => ({ item: k + 1, form: forms[meaningIndex] })),
        null,
        2
      );
    },
  };
}

async function readTemplate(relative: string): Promise<string> {
  return fs.readFile(path.resolve(process.cwd(), relative), 'utf-8');
}

function fill(template: string, values: Record<string, string>): string {
  // split/join rather than replace(), so "$" sequences in values are literal.
  return Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{{${key}}}`).join(value),
    template
  );
}

export async function buildLearnerPrompt(
  cond: ConditionConfig,
  presenter: Presenter,
  sample: TrainingSample,
  order: number[]
): Promise<string> {
  if (cond.presentation === 'ids') {
    const legacy = await readTemplate('prompts/learner-template.md');
    return fill(legacy, {
      TRAINING_PAIRS: presenter.examples(sample),
      TARGET_MEANINGS: presenter.targets(order),
    });
  }
  const template = await readTemplate('prompts/run2/learner.md');
  const pressureBlock =
    cond.pressure === 'none' ? '' : await readTemplate('prompts/run2/pressure-communication.md');
  return fill(template, {
    EXAMPLES: presenter.examples(sample),
    SHAPE: presenter.shape(),
    PRESSURE_BLOCK: pressureBlock,
    TARGET_MEANINGS: presenter.targets(order),
  });
}

export async function buildListenerPrompt(
  presenter: Presenter,
  sample: TrainingSample,
  candidateOrder: number[],
  forms: string[],
  test: number[]
): Promise<string> {
  const template = await readTemplate('prompts/run2/listener.md');
  return fill(template, {
    EXAMPLES: presenter.examples(sample),
    SHAPE: presenter.shape(),
    CANDIDATES: presenter.targets(candidateOrder),
    ITEMS: presenter.items(forms, test),
  });
}

export interface Confusion {
  intended: number;
  understood: number | undefined;
  form: string;
}

export async function buildRevisionPrompt(
  presenter: Presenter,
  sample: TrainingSample,
  order: number[],
  forms: string[],
  total: number,
  correct: number,
  confusions: Confusion[]
): Promise<string> {
  const template = await readTemplate('prompts/run2/revision.md');
  const lines = confusions.map((c) => {
    const understood =
      c.understood === undefined ? 'no valid answer' : JSON.stringify(presenter.fields(c.understood));
    return `intended ${JSON.stringify(presenter.fields(c.intended))}, form "${c.form}", understood ${understood}`;
  });
  return fill(template, {
    EXAMPLES: presenter.examples(sample),
    SHAPE: presenter.shape(),
    TOTAL: String(total),
    CORRECT: String(correct),
    CONFUSIONS: lines.join('\n'),
    PREVIOUS: presenter.previousLanguage(order, forms),
  });
}
