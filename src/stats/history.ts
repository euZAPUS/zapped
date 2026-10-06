import { CODE_LANG_IDS, type CodeLang } from '../data/snippets';
import type { LangId } from '../data/words';
import type { Mode } from '../engine/types';
import { KEYS, readJSON, writeJSON } from '../storage/local';

export interface ResultRecord {
  id: string;
  /** Epoch ms when the test finished. */
  at: number;
  mode: Mode;
  /** Seconds (time), word count (words) or word count of the text (custom). */
  limit: number;
  language: LangId;
  punctuation: boolean;
  numbers: boolean;
  accents: boolean;
  /** Programming language, only for code mode. */
  code?: CodeLang;
  stopOnError: boolean;
  wpm: number;
  raw: number;
  acc: number;
  cons: number;
  correct: number;
  incorrect: number;
  extra: number;
  missed: number;
  duration: number;
  /** Net ppm per second, kept for the most recent tests only. */
  series?: number[];
  rawSeries?: number[];
}

export const MAX_RECORDS = 1500;
const KEEP_SERIES = 100;

type Listener = () => void;

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Validates one record coming from storage, an import or a gist. */
export function sanitizeRecord(raw: unknown): ResultRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const mode = r.mode === 'time' || r.mode === 'words' || r.mode === 'custom' || r.mode === 'code' ? r.mode : null;
  const language = r.language === 'es' || r.language === 'en' || r.language === 'cyber' || r.language === 'c42' ? r.language : null;
  const at = n(r.at);
  const wpm = n(r.wpm);
  if (typeof r.id !== 'string' || !mode || !language || at === null || wpm === null) return null;
  const series = (v: unknown): number[] | undefined =>
    Array.isArray(v) && v.length <= 1000 && v.every((x) => typeof x === 'number') ? (v as number[]) : undefined;
  return {
    id: r.id.slice(0, 64),
    at,
    mode,
    limit: n(r.limit) ?? 0,
    language,
    punctuation: r.punctuation === true,
    numbers: r.numbers === true,
    accents: r.accents !== false,
    code: CODE_LANG_IDS.includes(r.code as CodeLang) ? (r.code as CodeLang) : undefined,
    stopOnError: r.stopOnError === true,
    wpm,
    raw: n(r.raw) ?? wpm,
    acc: n(r.acc) ?? 100,
    cons: n(r.cons) ?? 0,
    correct: n(r.correct) ?? 0,
    incorrect: n(r.incorrect) ?? 0,
    extra: n(r.extra) ?? 0,
    missed: n(r.missed) ?? 0,
    duration: n(r.duration) ?? 0,
    series: series(r.series),
    rawSeries: series(r.rawSeries),
  };
}

class HistoryStore {
  private items: ResultRecord[] = [];
  /** Entries at or before this timestamp were deleted on purpose and must not come back through sync. */
  private cleared = 0;
  private listeners = new Set<Listener>();

  constructor() {
    const stored = readJSON<unknown[]>(KEYS.history, []);
    this.items = (Array.isArray(stored) ? stored : []).map(sanitizeRecord).filter((r): r is ResultRecord => r !== null);
    this.items.sort((a, b) => a.at - b.at);
    this.cleared = readJSON<number>(KEYS.clearedBefore, 0);
  }

  all(): readonly ResultRecord[] {
    return this.items;
  }

  clearedBefore(): number {
    return this.cleared;
  }

  add(record: ResultRecord): void {
    if (this.items.some((r) => r.id === record.id)) return;
    this.items.push(record);
    this.items.sort((a, b) => a.at - b.at);
    this.commit();
  }

  /** Replaces the whole history (after a merge). */
  replace(items: ResultRecord[], clearedBefore: number): void {
    this.items = items.slice().sort((a, b) => a.at - b.at);
    this.cleared = clearedBefore;
    this.commit();
    writeJSON(KEYS.clearedBefore, this.cleared);
  }

  clear(): void {
    this.cleared = Date.now();
    this.items = [];
    writeJSON(KEYS.clearedBefore, this.cleared);
    this.commit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private commit(): void {
    if (this.items.length > MAX_RECORDS) this.items = this.items.slice(-MAX_RECORDS);
    const keepFrom = this.items.length - KEEP_SERIES;
    this.items.forEach((r, i) => {
      if (i < keepFrom && (r.series || r.rawSeries)) {
        delete r.series;
        delete r.rawSeries;
      }
    });
    writeJSON(KEYS.history, this.items);
    for (const fn of this.listeners) fn();
  }
}

export const history = new HistoryStore();
