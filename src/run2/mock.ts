import type { ApiClient } from '../types.js';

type Fields = Record<string, string>;

interface Target extends Fields {
  id: string;
}

// A deterministic stand-in for the model, for smoke tests and cost dry runs
// only. It deliberately ignores the action dimension when speaking, so the
// pipeline can be exercised against a known degenerate language. Its results
// say nothing about real model behaviour.
export class MockClient implements ApiClient {
  calls = 0;

  async callLearner(prompt: string): Promise<string> {
    this.calls++;
    if (prompt.includes('Forms heard')) return this.listen(prompt);
    if (prompt.includes('Your previous language')) return this.revise(prompt);
    return this.speak(prompt);
  }

  private section<T>(prompt: string, header: string): T[] {
    const start = prompt.indexOf(`${header}\n[`);
    if (start === -1) return [];
    const open = prompt.indexOf('[', start);
    const close = prompt.indexOf('\n]', open);
    return JSON.parse(prompt.slice(open, close + 2)) as T[];
  }

  // form for each (meaning fields) example, from either presentation
  private examples(prompt: string, targets: Target[]): Array<{ fields: Fields; form: string }> {
    const inline = [...prompt.matchAll(/^(\{.*\}) -> "([a-z]+)"$/gm)];
    if (inline.length > 0) {
      return inline.map((m) => ({ fields: JSON.parse(m[1]) as Fields, form: m[2] }));
    }
    const byId = new Map(targets.map((t) => [t.id, t]));
    return this.section<{ meaningId: string; form: string }>(prompt, 'Examples').flatMap((e) => {
      const t = byId.get(e.meaningId);
      return t ? [{ fields: t, form: e.form }] : [];
    });
  }

  private key(f: Fields): string {
    return `${f.agent}|${f.patient}|${f.tense}`;
  }

  private speak(prompt: string): string {
    const targets = this.section<Target>(prompt, 'Meanings to express');
    const seen = new Map<string, Map<string, number>>();
    for (const { fields, form } of this.examples(prompt, targets)) {
      const counts = seen.get(this.key(fields)) ?? new Map<string, number>();
      counts.set(form, (counts.get(form) ?? 0) + 1);
      seen.set(this.key(fields), counts);
    }
    const idKey = prompt.includes('{"id": "..."') ? 'id' : 'meaningId';
    const out = targets.map((t) => {
      const counts = seen.get(this.key(t));
      const form = counts
        ? [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
        : `${t.agent.slice(0, 2)}${t.patient.slice(0, 2)}${t.tense.slice(0, 2)}`.replace(/[^a-z]/g, 'z');
      return { [idKey]: t.id, form };
    });
    return JSON.stringify(out);
  }

  private listen(prompt: string): string {
    const candidates = this.section<Target>(prompt, 'Candidate meanings');
    const items = this.section<{ item: number; form: string }>(prompt, 'Forms heard');
    const known = new Map<string, string>();
    for (const { fields, form } of this.examples(prompt, candidates)) {
      const match = candidates.find((c) => Object.keys(fields).every((k) => c[k] === fields[k]));
      if (match && !known.has(form)) known.set(form, match.id);
    }
    return JSON.stringify(
      items.map((it) => ({ item: it.item, id: known.get(it.form) ?? candidates[0].id }))
    );
  }

  // Keeps working forms and disambiguates shared ones by action.
  private revise(prompt: string): string {
    const previous = this.section<Target & { form: string }>(prompt, 'Your previous language');
    const sharing = new Map<string, number>();
    for (const p of previous) sharing.set(p.form, (sharing.get(p.form) ?? 0) + 1);
    const actions = [...new Set(previous.map((p) => p.action))].sort();
    return JSON.stringify(
      previous.map((p) => ({
        id: p.id,
        form:
          (sharing.get(p.form) ?? 0) > 1
            ? p.form.slice(0, 8) + String.fromCharCode(97 + actions.indexOf(p.action))
            : p.form,
      }))
    );
  }
}
