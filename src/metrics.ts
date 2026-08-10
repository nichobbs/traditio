import { createGzip } from 'zlib';
import { generateMeanings, meaningDistance } from './meanings.js';
import type { Language, Metrics } from './types.js';

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

function normalizedLevenshtein(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 0 : distance / maxLen;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) return 0;

  const n = x.length;
  const meanX = x.reduce((a, b) => a + b) / n;
  const meanY = y.reduce((a, b) => a + b) / n;

  let numerator = 0;
  let sumSqX = 0;
  let sumSqY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    sumSqX += dx * dx;
    sumSqY += dy * dy;
  }

  const denominator = Math.sqrt(sumSqX * sumSqY);
  return denominator === 0 ? 0 : numerator / denominator;
}

function characterBigramEntropy(forms: string[]): number {
  const bigramCounts = new Map<string, number>();
  let totalBigrams = 0;

  for (const form of forms) {
    for (let i = 0; i < form.length - 1; i++) {
      const bigram = form.substring(i, i + 2);
      bigramCounts.set(bigram, (bigramCounts.get(bigram) ?? 0) + 1);
      totalBigrams++;
    }
  }

  if (totalBigrams === 0) return 0;

  let entropy = 0;
  for (const count of bigramCounts.values()) {
    const p = count / totalBigrams;
    entropy -= p * Math.log2(p);
  }

  return entropy;
}

export async function computeMetrics(
  current: Language,
  previous: Language | null,
  inSampleMeaningIds: Set<string>
): Promise<Metrics> {
  const meanings = generateMeanings();
  const currentMap = new Map(current.pairs.map((p) => [p.meaningId, p.form]));
  const previousMap = previous
    ? new Map(previous.pairs.map((p) => [p.meaningId, p.form]))
    : null;

  // Transmission fidelity
  let overallLevenshtein = 0;
  let overallExactMatch = 0;
  let inSampleLevenshtein = 0;
  let inSampleExactMatch = 0;
  let heldOutLevenshtein = 0;
  let heldOutExactMatch = 0;
  let inSampleCount = 0;
  let heldOutCount = 0;

  if (previousMap) {
    for (const pair of current.pairs) {
      const prevForm = previousMap.get(pair.meaningId);
      if (!prevForm) continue;

      const normalized = normalizedLevenshtein(pair.form, prevForm);
      const exact = pair.form === prevForm ? 1 : 0;

      overallLevenshtein += normalized;
      overallExactMatch += exact;

      if (inSampleMeaningIds.has(pair.meaningId)) {
        inSampleLevenshtein += normalized;
        inSampleExactMatch += exact;
        inSampleCount++;
      } else {
        heldOutLevenshtein += normalized;
        heldOutExactMatch += exact;
        heldOutCount++;
      }
    }
  }

  const count = current.pairs.length;

  // Compositionality: correlation between semantic distance and form distance
  const semanticDistances: number[] = [];
  const formDistances: number[] = [];

  for (let i = 0; i < meanings.length; i++) {
    for (let j = i + 1; j < meanings.length; j++) {
      const m1 = meanings[i];
      const m2 = meanings[j];
      const f1 = currentMap.get(m1.id);
      const f2 = currentMap.get(m2.id);

      if (!f1 || !f2) continue;

      semanticDistances.push(meaningDistance(m1, m2));
      formDistances.push(normalizedLevenshtein(f1, f2));
    }
  }

  const compositionality = pearsonCorrelation(semanticDistances, formDistances);

  // Compressibility
  const allForms = current.pairs.map((p) => p.form).join('');
  const gzipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const gz = createGzip();
    let chunks: Buffer[] = [];
    gz.on('data', (chunk) => chunks.push(chunk as Buffer));
    gz.on('end', () => resolve(Buffer.concat(chunks)));
    gz.on('error', reject);
    gz.write(allForms);
    gz.end();
  });

  const compressionRatio = gzipBuffer.length / allForms.length;

  // Lexicon stats
  const uniqueForms = new Set(current.pairs.map((p) => p.form));
  const meanFormLength =
    current.pairs.reduce((sum, p) => sum + p.form.length, 0) / current.pairs.length;
  const bigramEntropy = characterBigramEntropy(current.pairs.map((p) => p.form));

  return {
    transmissionFidelity: {
      overall: {
        meanLevenshtein: overallLevenshtein / count,
        exactMatchRate: overallExactMatch / count,
      },
      inSample: {
        meanLevenshtein: inSampleCount > 0 ? inSampleLevenshtein / inSampleCount : 0,
        exactMatchRate: inSampleCount > 0 ? inSampleExactMatch / inSampleCount : 0,
      },
      heldOut: {
        meanLevenshtein: heldOutCount > 0 ? heldOutLevenshtein / heldOutCount : 0,
        exactMatchRate: heldOutCount > 0 ? heldOutExactMatch / heldOutCount : 0,
      },
    },
    compositionality: {
      pearsonCorrelation: compositionality,
    },
    compressibility: {
      compressionRatio,
    },
    lexiconStats: {
      uniqueFormCount: uniqueForms.size,
      meanFormLength,
      characterBigramEntropy: bigramEntropy,
    },
  };
}
