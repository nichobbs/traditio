import { MEANING_COUNT, type Presenter } from './present.js';

export class ResponseError extends Error {}

function extractArray(response: string): unknown[] {
  let text = response.trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenced) text = fenced[1];
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start === -1 || end <= start) throw new ResponseError('Response is not a JSON array');
    try {
      parsed = JSON.parse(text.slice(start, end + 1));
    } catch {
      throw new ResponseError('Response is not valid JSON');
    }
  }
  if (!Array.isArray(parsed)) throw new ResponseError('Response must be a JSON array');
  return parsed;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined;
}

// Forms for every meaning, indexed by canonical meaning index. Throws a
// ResponseError whose message is suitable for a correction note.
export function parseForms(response: string, presenter: Presenter): string[] {
  const entries = extractArray(response);
  const forms = new Array<string | undefined>(MEANING_COUNT).fill(undefined);
  const problems: string[] = [];

  for (const entry of entries) {
    const obj = record(entry);
    const id = obj?.id ?? obj?.meaningId;
    const form = obj?.form;
    if (typeof id !== 'string' || typeof form !== 'string') {
      problems.push('an entry is missing a string "id" or "form"');
      continue;
    }
    const index = presenter.indexOfId(id);
    if (index === undefined) {
      problems.push(`unknown id "${id}"`);
    } else if (!/^[a-z]{1,40}$/.test(form)) {
      problems.push(`form for "${id}" must be 1 to 40 lowercase letters`);
    } else if (forms[index] !== undefined) {
      problems.push(`id "${id}" appears more than once`);
    } else {
      forms[index] = form;
    }
  }

  const missing = forms.filter((f) => f === undefined).length;
  if (missing > 0) problems.push(`${missing} meanings are missing`);
  if (problems.length > 0) {
    throw new ResponseError([...new Set(problems)].slice(0, 5).join('; '));
  }
  return forms as string[];
}

// For each test item (in order), the meaning index the listener chose, or
// undefined when the answer was not a known candidate id.
export function parseListening(
  response: string,
  presenter: Presenter,
  itemCount: number
): Array<number | undefined> {
  const entries = extractArray(response);
  const answers = new Array<number | undefined>(itemCount).fill(undefined);
  const answered = new Set<number>();

  for (const entry of entries) {
    const obj = record(entry);
    const item = obj?.item;
    const id = obj?.id;
    if (typeof item !== 'number' || !Number.isInteger(item) || item < 1 || item > itemCount) {
      throw new ResponseError(`invalid item number ${String(item)}`);
    }
    if (answered.has(item)) throw new ResponseError(`item ${item} appears more than once`);
    answered.add(item);
    answers[item - 1] = typeof id === 'string' ? presenter.indexOfId(id) : undefined;
  }

  if (answered.size !== itemCount) {
    throw new ResponseError(`${itemCount - answered.size} items are missing`);
  }
  return answers;
}
