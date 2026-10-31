import fs from 'fs/promises';
import path from 'path';
import { gzipSync } from 'zlib';
import { generateMeanings } from '../meanings.js';
import { generateSeedLanguage } from '../seedLanguage.js';
import { sampleTraining } from '../sampler.js';
import { computeMetrics } from '../metrics.js';
import type { ApiClient, ApiConfig, Language, Metrics, TrainingSample } from '../types.js';
import { hashString } from '../prompt.js';
import { computeStructureMetrics, type StructureMetrics } from './metrics.js';
import { parseForms, parseListening, ResponseError } from './parse.js';
import {
  MEANING_COUNT,
  canonicalIndex,
  buildLearnerPrompt,
  buildListenerPrompt,
  buildRevisionPrompt,
  createPresenter,
  type Confusion,
  type Presenter,
} from './present.js';
import { deriveSeed, shuffled } from './rng.js';
import {
  DIMENSIONS,
  type CommunicationRecord,
  type CommunicationResult,
  type Dimension,
  type ResolvedCondition,
  type Run2Config,
} from './types.js';

const MEANINGS = generateMeanings();

export interface ChainDeps {
  client: ApiClient;
  config: Run2Config;
  runsDir: string;
  log?: (message: string) => void;
  sleep?: (ms: number) => Promise<void>;
}

export type ChainStatus = 'stasis' | 'max-generations' | 'failed';

export interface ChainSummary {
  condition: string;
  chain: number;
  status: ChainStatus | 'running';
  lastGeneration: number;
  calls: number;
  error?: string;
  updatedAt: string;
}

export interface GenerationRecord extends Metrics {
  structure: StructureMetrics;
  communication?: CommunicationRecord;
}

export function chainDir(runsDir: string, condition: string, chain: number): string {
  return path.join(runsDir, condition, `chain-${String(chain).padStart(2, '0')}`);
}

function genName(gen: number): string {
  return `gen-${String(gen).padStart(3, '0')}`;
}

function toLanguage(forms: string[]): Language {
  return { pairs: forms.map((form, i) => ({ meaningId: MEANINGS[i].id, form })) };
}

async function readForms(dir: string, gen: number): Promise<string[]> {
  const text = await fs.readFile(path.join(dir, genName(gen), 'language.json'), 'utf-8');
  return (JSON.parse(text) as { forms: string[] }).forms;
}

async function latestGeneration(dir: string): Promise<number> {
  try {
    const entries = await fs.readdir(dir);
    const gens = entries.filter((e) => /^gen-\d+$/.test(e)).map((e) => parseInt(e.slice(4), 10));
    return gens.length === 0 ? -1 : Math.max(...gens);
  } catch {
    return -1;
  }
}

export async function readGenerationMetrics(dir: string, gen: number): Promise<GenerationRecord> {
  const text = await fs.readFile(path.join(dir, genName(gen), 'metrics.json'), 'utf-8');
  return JSON.parse(text) as GenerationRecord;
}

class Run {
  calls = 0;
  constructor(
    readonly deps: ChainDeps,
    readonly cond: ResolvedCondition,
    readonly chain: number,
    readonly dir: string,
    readonly presenter: Presenter
  ) {}

  log(message: string): void {
    this.deps.log?.(`[${this.cond.name}/chain-${this.chain}] ${message}`);
  }

  seed(...parts: Array<string | number>): number {
    return deriveSeed(this.deps.config.baseSeed, ...parts);
  }

  async callWithRetry(prompt: string, config: ApiConfig): Promise<string> {
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    let lastError: unknown;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        this.calls++;
        return await this.deps.client.callLearner(prompt, config);
      } catch (error) {
        lastError = error;
        await sleep(2000 * 2 ** attempt);
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  async saveRaw(gen: number, name: string, text: string): Promise<void> {
    const rawDir = path.join(this.dir, 'raw');
    await fs.mkdir(rawDir, { recursive: true });
    await fs.writeFile(path.join(rawDir, `${genName(gen)}-${name}.txt.gz`), gzipSync(text));
  }

  // One call, plus one retry with a correction note if the response cannot
  // be parsed, mirroring run 1.
  async callAndParse<T>(
    gen: number,
    name: string,
    prompt: string,
    config: ApiConfig,
    parse: (response: string) => T
  ): Promise<T> {
    const first = await this.callWithRetry(prompt, config);
    await this.saveRaw(gen, name, first);
    try {
      return parse(first);
    } catch (error) {
      if (!(error instanceof ResponseError)) throw error;
      this.log(`gen ${gen} ${name}: ${error.message}; retrying once`);
      const retry = await this.callWithRetry(
        `${prompt}\n\nYour previous response could not be used (${error.message}). Respond again following the output format exactly.`,
        config
      );
      await this.saveRaw(gen, `${name}-retry`, retry);
      return parse(retry);
    }
  }

  apiConfig(temperature = this.cond.temperature): ApiConfig {
    return {
      model: this.cond.model,
      maxOutputTokens: this.deps.config.defaults.maxOutputTokens,
      temperature,
    };
  }
}

function scoreListening(
  test: number[],
  answers: Array<number | undefined>,
  inSample: Set<number>
): { result: CommunicationResult; confusions: Confusion[] } {
  let correct = 0;
  let heldOutTotal = 0;
  let heldOutCorrect = 0;
  const perDimension = Object.fromEntries(DIMENSIONS.map((d) => [d, 0])) as Record<Dimension, number>;
  const confusions: Confusion[] = [];
  test.forEach((intended, k) => {
    const understood = answers[k];
    const hit = understood === intended;
    if (hit) correct++;
    else confusions.push({ intended, understood, form: '' });
    if (!inSample.has(intended)) {
      heldOutTotal++;
      if (hit) heldOutCorrect++;
    }
    if (understood !== undefined) {
      for (const d of DIMENSIONS) {
        if (MEANINGS[understood][d] === MEANINGS[intended][d]) perDimension[d]++;
      }
    }
  });
  const total = test.length;
  return {
    result: {
      total,
      correct,
      accuracy: total === 0 ? 0 : correct / total,
      heldOutAccuracy: heldOutTotal === 0 ? undefined : heldOutCorrect / heldOutTotal,
      perDimension: Object.fromEntries(
        DIMENSIONS.map((d) => [d, total === 0 ? 0 : perDimension[d] / total])
      ) as Record<Dimension, number>,
    },
    confusions,
  };
}

async function listen(
  run: Run,
  gen: number,
  round: 'pre' | 'post',
  sample: TrainingSample,
  forms: string[]
): Promise<{ result: CommunicationResult; confusions: Confusion[] }> {
  const { cond, chain, presenter } = run;
  const defaults = run.deps.config.defaults;
  const test = shuffled(
    MEANINGS.map((_, i) => i),
    run.seed('test', chain, gen, round)
  ).slice(0, Math.min(defaults.testItems, MEANING_COUNT));
  const candidateOrder = presenter.orderFor(run.seed('candidates', chain, gen, round));
  const prompt = await buildListenerPrompt(presenter, sample, candidateOrder, forms, test);
  const answers = await run.callAndParse(
    gen,
    `listener-${round}`,
    prompt,
    run.apiConfig(defaults.listenerTemperature),
    (response) => parseListening(response, presenter, test.length)
  );
  const inSample = new Set(sample.pairs.map((p) => canonicalIndex(p.meaningId)));
  const scored = scoreListening(test, answers, inSample);
  const confusions = scored.confusions.map((c) => ({ ...c, form: forms[c.intended] }));
  run.log(`gen ${gen} ${cond.name} ${round}-test accuracy ${scored.result.accuracy.toFixed(2)}`);
  return { result: scored.result, confusions };
}

interface StepResult {
  forms: string[];
  communication?: CommunicationRecord;
}

async function produceLanguage(
  run: Run,
  gen: number,
  sample: TrainingSample
): Promise<StepResult> {
  const { cond, chain, presenter } = run;
  const defaults = run.deps.config.defaults;
  const order = presenter.orderFor(run.seed('order', chain, gen));
  const prompt = await buildLearnerPrompt(cond, presenter, sample, order);
  const forms = await run.callAndParse(gen, 'speaker', prompt, run.apiConfig(), (response) =>
    parseForms(response, presenter)
  );
  if (cond.pressure !== 'game') return { forms };

  const pre = await listen(run, gen, 'pre', sample, forms);
  let finalForms = forms;
  let revised = false;
  if (pre.result.correct < pre.result.total) {
    const shown = pre.confusions.slice(0, defaults.confusionsShown);
    const revisionOrder = presenter.orderFor(run.seed('revision-order', chain, gen));
    const revisionPrompt = await buildRevisionPrompt(
      presenter,
      sample,
      revisionOrder,
      forms,
      pre.result.total,
      pre.result.correct,
      shown
    );
    finalForms = await run.callAndParse(gen, 'revision', revisionPrompt, run.apiConfig(), (r) =>
      parseForms(r, presenter)
    );
    revised = true;
  }

  const communication: CommunicationRecord = { pre: pre.result, revised };
  if (defaults.postTest) {
    communication.post = (await listen(run, gen, 'post', sample, finalForms)).result;
  }
  return { forms: finalForms, communication };
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await fs.writeFile(file, JSON.stringify(value));
}

async function writeSummary(
  run: Run,
  status: ChainSummary['status'],
  last: number,
  error?: string
): Promise<ChainSummary> {
  const summary: ChainSummary = {
    condition: run.cond.name,
    chain: run.chain,
    status,
    lastGeneration: last,
    calls: run.calls,
    updatedAt: new Date().toISOString(),
    ...(error ? { error } : {}),
  };
  await fs.writeFile(path.join(run.dir, 'summary.json'), JSON.stringify(summary, null, 2));
  return summary;
}

async function priorCalls(dir: string): Promise<number> {
  try {
    const text = await fs.readFile(path.join(dir, 'summary.json'), 'utf-8');
    return (JSON.parse(text) as ChainSummary).calls;
  } catch {
    return 0;
  }
}

async function isFrozen(run: Run, last: number): Promise<boolean> {
  const { stasisWindow, stasisEpsilon } = run.deps.config.defaults;
  if (last < stasisWindow) return false;
  for (let g = last - stasisWindow + 1; g <= last; g++) {
    const m = await readGenerationMetrics(run.dir, g);
    if (m.transmissionFidelity.overall.meanLevenshtein > stasisEpsilon) return false;
  }
  return true;
}

// Runs (or resumes) one chain until its language stops changing, the
// generation cap is reached, or a generation fails.
export async function runChain(
  deps: ChainDeps,
  cond: ResolvedCondition,
  chain: number
): Promise<ChainSummary> {
  const dir = chainDir(deps.runsDir, cond.name, chain);
  await fs.mkdir(dir, { recursive: true });
  const presenter = createPresenter(cond, deriveSeed(deps.config.baseSeed, 'ids', chain));
  const run = new Run(deps, cond, chain, dir, presenter);
  run.calls = await priorCalls(dir);
  const { sampleFraction, maxTrainingTokens } = deps.config.defaults;

  let last = await latestGeneration(dir);
  if (last === -1) {
    // Same seed language for the same chain index in every condition, so
    // conditions can be compared as paired chains.
    const seedLanguage = generateSeedLanguage(deriveSeed(deps.config.baseSeed, 'seed-language', chain));
    await fs.mkdir(path.join(dir, genName(0)), { recursive: true });
    await writeJson(
      path.join(dir, genName(0), 'language.json'),
      { forms: seedLanguage.pairs.map((p) => p.form) }
    );
    last = 0;
  }

  try {
    let status: ChainStatus = 'max-generations';
    if (await isFrozen(run, last)) status = 'stasis';
    while (status !== 'stasis' && last < cond.maxGenerations) {
      const gen = last + 1;
      const previous = await readForms(dir, last);
      const { sample, inSampleMeaningIds } = sampleTraining(
        toLanguage(previous),
        { sampleFraction, maxTrainingTokens },
        run.seed('sample', chain, gen)
      );

      const step = await produceLanguage(run, gen, sample);
      const legacy = await computeMetrics(toLanguage(step.forms), toLanguage(previous), inSampleMeaningIds);
      const record: GenerationRecord = {
        ...legacy,
        structure: computeStructureMetrics(step.forms),
        ...(step.communication ? { communication: step.communication } : {}),
      };

      const genDir = path.join(dir, genName(gen));
      await fs.mkdir(genDir, { recursive: true });
      await writeJson(path.join(genDir, 'language.json'), { forms: step.forms });
      await writeJson(path.join(genDir, 'metrics.json'), record);
      await writeJson(path.join(genDir, 'meta.json'), {
        generation: gen,
        model: cond.model,
        timestamp: new Date().toISOString(),
        conditionHash: hashString(JSON.stringify(cond)),
      });
      last = gen;
      await writeSummary(run, 'running', last);
      run.log(
        `gen ${gen}: unique=${record.structure.expressivity.uniqueForms} ` +
          `lev=${record.transmissionFidelity.overall.meanLevenshtein.toFixed(3)} ` +
          `dropped=[${record.structure.droppedDimensions.join(',')}]`
      );

      if (await isFrozen(run, last)) status = 'stasis';
    }
    return await writeSummary(run, status, last);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    run.log(`failed at gen ${last + 1}: ${message}`);
    return await writeSummary(run, 'failed', last, message);
  }
}
