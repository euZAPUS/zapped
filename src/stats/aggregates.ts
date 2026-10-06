import { CODE_LANGS } from '../data/snippets';
import { LANGUAGES } from '../data/words';
import type { ResultRecord } from './history';

/** Records are comparable when they share this key. */
export function configKey(r: ResultRecord): string {
  const parts: string[] = [r.mode === 'custom' ? 'custom' : r.mode === 'code' ? `code-${r.code ?? 'c'}` : `${r.mode}-${r.limit}`];
  if (r.mode === 'time' || r.mode === 'words') {
    parts.push(r.language);
    if (r.language === 'es' && !r.accents) parts.push('sin-tildes');
    if (r.punctuation) parts.push('punt');
    if (r.numbers) parts.push('num');
  }
  if (r.stopOnError) parts.push('estricto');
  return parts.join('|');
}

export function describeConfig(r: ResultRecord): { title: string; detail: string } {
  if (r.mode === 'code') {
    return { title: 'Código', detail: [CODE_LANGS[r.code ?? 'c'].label, r.stopOnError ? 'estricto' : ''].filter(Boolean).join(' · ') };
  }
  const title =
    r.mode === 'time' ? `Tiempo · ${r.limit} s` : r.mode === 'words' ? `Palabras · ${r.limit}` : 'Texto propio';
  if (r.mode === 'custom') return { title, detail: r.stopOnError ? 'estricto' : '' };
  const detail = [
    LANGUAGES[r.language].label,
    r.language === 'es' && !r.accents ? 'sin tildes' : '',
    r.punctuation ? 'puntuación' : '',
    r.numbers ? 'números' : '',
    r.stopOnError ? 'estricto' : '',
  ]
    .filter(Boolean)
    .join(' · ');
  return { title, detail };
}

export interface Summary {
  total: number;
  best: ResultRecord | null;
  avgLast10: number | null;
  avgAccuracy: number | null;
  avgConsistency: number | null;
  totalSeconds: number;
  firstAt: number | null;
  dayStreak: number;
}

export function summarize(all: readonly ResultRecord[], now = Date.now()): Summary {
  if (all.length === 0) {
    return { total: 0, best: null, avgLast10: null, avgAccuracy: null, avgConsistency: null, totalSeconds: 0, firstAt: null, dayStreak: 0 };
  }
  let best = all[0] as ResultRecord;
  let acc = 0;
  let cons = 0;
  let seconds = 0;
  for (const r of all) {
    if (r.wpm > best.wpm) best = r;
    acc += r.acc;
    cons += r.cons;
    seconds += r.duration;
  }
  const last10 = all.slice(-10);
  return {
    total: all.length,
    best,
    avgLast10: last10.reduce((s, r) => s + r.wpm, 0) / last10.length,
    avgAccuracy: acc / all.length,
    avgConsistency: cons / all.length,
    totalSeconds: seconds,
    firstAt: Math.min(...all.map((r) => r.at)),
    dayStreak: dayStreak(all, now),
  };
}

export interface RecordRow {
  key: string;
  best: ResultRecord;
  count: number;
}

/** Best result of each configuration, strongest first. */
export function recordsByConfig(all: readonly ResultRecord[]): RecordRow[] {
  const map = new Map<string, RecordRow>();
  for (const r of all) {
    const key = configKey(r);
    const row = map.get(key);
    if (!row) map.set(key, { key, best: r, count: 1 });
    else {
      row.count++;
      if (r.wpm > row.best.wpm) row.best = r;
    }
  }
  return [...map.values()].sort((a, b) => b.best.wpm - a.best.wpm);
}

/** Best ppm for a configuration among results before `at`. */
export function previousBest(all: readonly ResultRecord[], like: ResultRecord): number | null {
  const key = configKey(like);
  let best: number | null = null;
  for (const r of all) {
    if (r.id === like.id || configKey(r) !== key) continue;
    if (best === null || r.wpm > best) best = r.wpm;
  }
  return best;
}

export function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function activityByDay(all: readonly ResultRecord[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const r of all) {
    const k = dayKey(r.at);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

/** Consecutive days with at least one test, counting back from today (or yesterday). */
export function dayStreak(all: readonly ResultRecord[], now = Date.now()): number {
  const days = activityByDay(all);
  let streak = 0;
  const cursor = new Date(now);
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor.getTime()))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export interface Rank {
  name: string;
  min: number;
}

/** Speed titles, because every profile deserves a little lightning. */
export const RANKS: Rank[] = [
  { name: 'Chispa', min: 0 },
  { name: 'Descarga', min: 35 },
  { name: 'Voltio', min: 55 },
  { name: 'Relámpago', min: 75 },
  { name: 'Tormenta', min: 95 },
  { name: 'Rayo', min: 120 },
  { name: 'Supernova', min: 150 },
];

export function rankFor(wpm: number): { current: Rank; next: Rank | null } {
  let idx = 0;
  RANKS.forEach((r, i) => {
    if (wpm >= r.min) idx = i;
  });
  return { current: RANKS[idx] as Rank, next: RANKS[idx + 1] ?? null };
}
