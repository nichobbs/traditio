import fs from 'fs/promises';
import path from 'path';
import { chainDir, readGenerationMetrics, type ChainSummary } from './chain.js';
import { DIMENSIONS, type Dimension } from './types.js';

export interface ChainRow {
  condition: string;
  chain: number;
  status: ChainSummary['status'];
  lastGeneration: number;
  calls: number;
  settleGeneration: number | undefined;
  uniqueForms: number;
  pearson: number;
  spearman: number;
  syncretism: Record<Dimension, number>;
  dropped: Dimension[];
  postAccuracy: number | undefined;
  postHeldOutAccuracy: number | undefined;
}

async function listDirs(dir: string, pattern: RegExp): Promise<string[]> {
  try {
    return (await fs.readdir(dir)).filter((e) => pattern.test(e)).sort();
  } catch {
    return [];
  }
}

export async function collectRows(runsDir: string, stasisWindow: number): Promise<ChainRow[]> {
  const rows: ChainRow[] = [];
  for (const condition of await listDirs(runsDir, /^[a-z0-9][a-z0-9-]*$/)) {
    for (const chainName of await listDirs(path.join(runsDir, condition), /^chain-\d+$/)) {
      const chain = parseInt(chainName.slice(6), 10);
      const dir = chainDir(runsDir, condition, chain);
      let summary: ChainSummary;
      try {
        summary = JSON.parse(await fs.readFile(path.join(dir, 'summary.json'), 'utf-8'));
      } catch {
        continue;
      }
      if (summary.lastGeneration < 1) continue;
      const last = await readGenerationMetrics(dir, summary.lastGeneration);

      const accuracies: number[] = [];
      const heldOut: number[] = [];
      for (let g = Math.max(1, summary.lastGeneration - 4); g <= summary.lastGeneration; g++) {
        const post = (await readGenerationMetrics(dir, g)).communication?.post;
        if (post) accuracies.push(post.accuracy);
        if (post?.heldOutAccuracy !== undefined) heldOut.push(post.heldOutAccuracy);
      }

      rows.push({
        condition,
        chain,
        status: summary.status,
        lastGeneration: summary.lastGeneration,
        calls: summary.calls,
        settleGeneration:
          summary.status === 'stasis' ? summary.lastGeneration - stasisWindow + 1 : undefined,
        uniqueForms: last.structure.expressivity.uniqueForms,
        pearson: last.compositionality.pearsonCorrelation,
        spearman: last.structure.topographicSpearman,
        syncretism: last.structure.syncretism,
        dropped: last.structure.droppedDimensions,
        postAccuracy: mean(accuracies),
        postHeldOutAccuracy: mean(heldOut),
      });
    }
  }
  return rows;
}

function mean(values: number[]): number | undefined {
  return values.length === 0 ? undefined : values.reduce((a, b) => a + b, 0) / values.length;
}

function range(values: number[], digits = 0): string {
  if (values.length === 0) return 'n/a';
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  const f = (x: number) => x.toFixed(digits);
  return `${f(mid)} [${f(sorted[0])}-${f(sorted[sorted.length - 1])}]`;
}

export function buildReport(rows: ChainRow[]): string {
  const conditions = [...new Set(rows.map((r) => r.condition))];
  const lines = [
    '| condition | chains | stasis | settle gen (median [min-max]) | final unique forms | final Pearson | final Spearman | dimension dropped | listener accuracy (all / held-out) |',
    '|---|---:|---:|---|---|---|---|---|---|',
  ];
  for (const condition of conditions) {
    const rs = rows.filter((r) => r.condition === condition);
    const settled = rs.flatMap((r) => (r.settleGeneration === undefined ? [] : [r.settleGeneration]));
    const droppedCounts = DIMENSIONS.map((d) => [d, rs.filter((r) => r.dropped.includes(d)).length] as const)
      .filter(([, n]) => n > 0)
      .map(([d, n]) => `${d} ${n}`);
    const none = rs.filter((r) => r.dropped.length === 0).length;
    if (none > 0) droppedCounts.push(`none ${none}`);
    const accuracy = rs.flatMap((r) => (r.postAccuracy === undefined ? [] : [r.postAccuracy]));
    const held = rs.flatMap((r) => (r.postHeldOutAccuracy === undefined ? [] : [r.postHeldOutAccuracy]));
    lines.push(
      `| ${condition} | ${rs.length} | ${settled.length} | ${range(settled)} | ${range(rs.map((r) => r.uniqueForms))} | ` +
        `${range(rs.map((r) => r.pearson), 2)} | ${range(rs.map((r) => r.spearman), 2)} | ${droppedCounts.join(', ')} | ` +
        `${accuracy.length ? `${range(accuracy, 2)} / ${range(held, 2)}` : 'n/a'} |`
    );
  }
  const failed = rows.filter((r) => r.status === 'failed');
  if (failed.length > 0) {
    lines.push('', `Failed chains: ${failed.map((r) => `${r.condition}/chain-${r.chain}`).join(', ')}`);
  }
  return lines.join('\n');
}
