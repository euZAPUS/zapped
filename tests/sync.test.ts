import { describe, expect, it } from 'vitest';
import { differs, mergeHistory, mergeSettings, mergeSnapshots, parseSnapshot, type Snapshot } from '../src/sync/merge';
import { DEFAULT_SETTINGS } from '../src/settings/schema';
import type { ResultRecord } from '../src/stats/history';

const rec = (id: string, at: number, wpm = 50): ResultRecord => ({
  id, at, mode: 'time', limit: 30, language: 'es', punctuation: false, numbers: false, accents: true, stopOnError: false,
  wpm, raw: wpm, acc: 100, cons: 80, correct: 10, incorrect: 0, extra: 0, missed: 0, duration: 30,
});

const snap = (history: ResultRecord[], updatedAt: number, clearedBefore = 0, theme = 'voltio'): Snapshot => ({
  app: 'zapped', version: 1, exportedAt: 0,
  settings: { ...DEFAULT_SETTINGS, theme, updatedAt },
  history, clearedBefore,
});

describe('mergeHistory', () => {
  it('unions by id without duplicates and sorts by time', () => {
    const merged = mergeHistory([rec('a', 1), rec('b', 3)], [rec('b', 3), rec('c', 2)], 0);
    expect(merged.map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('is idempotent and symmetric', () => {
    const a = [rec('a', 1), rec('b', 2)];
    const b = [rec('b', 2), rec('c', 3)];
    const ab = mergeHistory(a, b, 0).map((r) => r.id);
    expect(mergeHistory(b, a, 0).map((r) => r.id)).toEqual(ab);
    expect(mergeHistory(mergeHistory(a, b, 0), b, 0).map((r) => r.id)).toEqual(ab);
  });

  it('drops entries deleted on purpose and prefers the copy that keeps its chart', () => {
    expect(mergeHistory([rec('old', 5)], [rec('new', 20)], 10).map((r) => r.id)).toEqual(['new']);
    const withSeries = { ...rec('x', 1), series: [1, 2] };
    expect(mergeHistory([rec('x', 1)], [withSeries], 0)[0]?.series).toEqual([1, 2]);
  });
});

describe('mergeSettings / mergeSnapshots', () => {
  it('keeps the most recently modified settings', () => {
    const local = { ...DEFAULT_SETTINGS, theme: 'papel', updatedAt: 100 };
    const remote = { ...DEFAULT_SETTINGS, theme: 'marea', updatedAt: 200 };
    expect(mergeSettings(local, remote).theme).toBe('marea');
    expect(mergeSettings(remote, local).theme).toBe('marea');
  });

  it('merges snapshots and reports whether something changed', () => {
    const local = snap([rec('a', 1)], 100, 0, 'papel');
    const remote = snap([rec('b', 2)], 50, 0, 'marea');
    const merged = mergeSnapshots(local, remote);
    expect(merged.history.map((r) => r.id)).toEqual(['a', 'b']);
    expect(merged.settings.theme).toBe('papel');
    expect(differs(remote, merged)).toBe(true);
    expect(differs(merged, mergeSnapshots(merged, remote))).toBe(false);
  });

  it('propagates a history clear to the other device', () => {
    const cleared = snap([], 10, 1000);
    const stale = snap([rec('a', 500)], 5);
    expect(mergeSnapshots(stale, cleared).history).toEqual([]);
  });
});

describe('parseSnapshot', () => {
  it('rejects foreign files and sanitises garbage', () => {
    expect(parseSnapshot({ hello: 1 })).toBeNull();
    expect(parseSnapshot(null)).toBeNull();
    const parsed = parseSnapshot({ app: 'zapped', history: [{ nope: true }, rec('ok', 1)], settings: { theme: '<script>', fontSize: 9999 } });
    expect(parsed?.history).toHaveLength(1);
    expect(parsed?.settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(parsed?.settings.fontSize).toBe(48);
  });
});
