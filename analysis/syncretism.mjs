// Per-dimension syncretism: for every pair of meanings that differ in exactly
// one dimension, the fraction that share an identical form.
// Usage: node analysis/syncretism.mjs [generation ...]   (run from repo root)
import fs from "node:fs";

const AGENTS = ["wolf", "bird", "child", "stone", "river"];
const ACTIONS = ["sees", "chases", "eats", "fears", "finds"];
const TENSES = ["past", "nonpast"];

// Same enumeration order as src/meanings.ts: agent, action, patient, tense.
const meanings = [];
for (const agent of AGENTS)
  for (const action of ACTIONS)
    for (const patient of AGENTS) {
      if (patient === agent) continue;
      for (const tense of TENSES) meanings.push({ agent, action, patient, tense });
    }

const loadForms = (gen) =>
  JSON.parse(
    fs.readFileSync(`corpus/gen-${String(gen).padStart(3, "0")}/language.json`, "utf8"),
  ).pairs.map((p) => p.form);

function syncretism(forms) {
  const counts = Object.fromEntries(
    ["agent", "action", "patient", "tense"].map((d) => [d, [0, 0]]),
  );
  for (let i = 0; i < meanings.length; i++)
    for (let j = i + 1; j < meanings.length; j++) {
      const differing = Object.keys(counts).filter((d) => meanings[i][d] !== meanings[j][d]);
      if (differing.length !== 1) continue;
      const c = counts[differing[0]];
      c[1]++;
      if (forms[i] === forms[j]) c[0]++;
    }
  return Object.fromEntries(
    Object.entries(counts).map(([d, [shared, total]]) => [d, +(shared / total).toFixed(2)]),
  );
}

const gens = process.argv.slice(2).map(Number);
const targets = gens.length ? gens : [0, 1, 5, 10, 15, 20, 25, 30, 35, 40, 44, 50, 100, 210];
for (const gen of targets) {
  const forms = loadForms(gen);
  console.log(gen, JSON.stringify(syncretism(forms)), `unique=${new Set(forms).size}`);
}
