import type { CharCounts, Sample, TestResult } from './types';

export interface WordAnalysis extends CharCounts {
  /** Characters belonging to words typed without a single mistake. */
  correctWordChars: number;
  /** Separators typed after correct words. */
  correctSeparators: number;
  /** Every character typed, separators included. */
  typedChars: number;
}

/**
 * Compares what was typed with the target.
 * Words before `current` are committed (the separator was typed). The word at
 * `current` is still in progress: it counts for what has been typed so far but
 * never as "missed".
 */
export function analyze(targets: string[], typed: string[], current: number): WordAnalysis {
  const out: WordAnalysis = {
    correct: 0, incorrect: 0, extra: 0, missed: 0,
    correctWordChars: 0, correctSeparators: 0, typedChars: 0,
  };
  const last = Math.min(current, targets.length - 1);
  for (let i = 0; i <= last; i++) {
    const target = targets[i] ?? '';
    const t = typed[i] ?? '';
    const committed = i < current;
    const shared = Math.min(t.length, target.length);
    for (let j = 0; j < shared; j++) {
      if (t[j] === target[j]) out.correct++;
      else out.incorrect++;
    }
    out.extra += Math.max(0, t.length - target.length);
    if (committed) out.missed += Math.max(0, target.length - t.length);
    out.typedChars += t.length;

    if (t === target) {
      out.correctWordChars += target.length;
      if (committed) {
        out.correctSeparators++;
        out.correct++; // the separator itself
      }
    } else if (!committed && t.length > 0 && target.startsWith(t)) {
      // a clean, unfinished word still counts for what is already right
      out.correctWordChars += t.length;
    }
    if (committed) out.typedChars++;
  }
  return out;
}

const CHARS_PER_WORD = 5;

export function wpmFrom(chars: number, seconds: number): number {
  if (seconds <= 0) return 0;
  return chars / CHARS_PER_WORD / (seconds / 60);
}

export function netWpm(a: WordAnalysis, seconds: number): number {
  return wpmFrom(a.correctWordChars + a.correctSeparators, seconds);
}

export function rawWpm(a: WordAnalysis, seconds: number): number {
  return wpmFrom(a.typedChars, seconds);
}

export function accuracy(correctKeys: number, wrongKeys: number): number {
  const total = correctKeys + wrongKeys;
  return total === 0 ? 100 : (correctKeys / total) * 100;
}

/**
 * Consistency in the Monkeytype sense: 100 means a perfectly steady raw speed.
 * It maps the coefficient of variation of the per-second raw ppm through a
 * saturating curve so that mild fluctuation is not punished too harshly.
 */
export function consistency(rawSeries: number[]): number {
  if (rawSeries.length < 2) return 100;
  const mean = rawSeries.reduce((s, v) => s + v, 0) / rawSeries.length;
  if (mean === 0) return 0;
  const variance = rawSeries.reduce((s, v) => s + (v - mean) ** 2, 0) / rawSeries.length;
  const cov = Math.sqrt(variance) / mean;
  const score = 100 * (1 - Math.tanh(cov + cov ** 3 / 3 + cov ** 5 / 5));
  return Math.max(0, Math.min(100, score));
}

export function buildResult(
  analysis: WordAnalysis,
  keys: { correct: number; incorrect: number },
  seconds: number,
  samples: Sample[],
): TestResult {
  return {
    wpm: round2(netWpm(analysis, seconds)),
    raw: round2(rawWpm(analysis, seconds)),
    accuracy: round2(accuracy(keys.correct, keys.incorrect)),
    consistency: round2(consistency(samples.map((s) => s.raw))),
    chars: {
      correct: analysis.correct,
      incorrect: analysis.incorrect,
      extra: analysis.extra,
      missed: analysis.missed,
    },
    duration: round2(seconds),
    samples,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
