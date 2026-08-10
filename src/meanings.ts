import type { Agent, Action, Meaning, Tense } from './types.js';

const AGENTS: Agent[] = ['wolf', 'bird', 'child', 'stone', 'river'];
const ACTIONS: Action[] = ['sees', 'chases', 'eats', 'fears', 'finds'];
const TENSES: Tense[] = ['past', 'nonpast'];

export function generateMeanings(): Meaning[] {
  const meanings: Meaning[] = [];
  let id = 0;

  for (const agent of AGENTS) {
    for (const action of ACTIONS) {
      for (const patient of AGENTS) {
        if (agent === patient) continue;
        for (const tense of TENSES) {
          meanings.push({
            id: `m${String(id).padStart(3, '0')}`,
            agent,
            action,
            patient,
            tense,
          });
          id++;
        }
      }
    }
  }

  return meanings;
}

export function meaningToString(meaning: Meaning): string {
  return JSON.stringify(meaning);
}

export function meaningDistance(m1: Meaning, m2: Meaning): number {
  let distance = 0;
  if (m1.agent !== m2.agent) distance++;
  if (m1.action !== m2.action) distance++;
  if (m1.patient !== m2.patient) distance++;
  if (m1.tense !== m2.tense) distance++;
  return distance;
}
