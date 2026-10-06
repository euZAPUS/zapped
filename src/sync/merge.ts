import { MAX_RECORDS, sanitizeRecord, type ResultRecord } from '../stats/history';
import { sanitizeSettings, type Settings } from '../settings/schema';

/** Everything that is persisted and can travel between devices. The token never does. */
export interface Snapshot {
  app: 'zapped';
  version: 1;
  exportedAt: number;
  settings: Settings;
  history: ResultRecord[];
  /** Results at or before this time were deleted on purpose. */
  clearedBefore: number;
}

export function parseSnapshot(raw: unknown): Snapshot | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (r.app !== 'zapped' || !Array.isArray(r.history)) return null;
  return {
    app: 'zapped',
    version: 1,
    exportedAt: typeof r.exportedAt === 'number' ? r.exportedAt : 0,
    settings: sanitizeSettings(r.settings),
    history: r.history.map(sanitizeRecord).filter((x): x is ResultRecord => x !== null),
    clearedBefore: typeof r.clearedBefore === 'number' ? r.clearedBefore : 0,
  };
}

/** Union of two histories by id, honouring deletions, without duplicates. */
export function mergeHistory(a: readonly ResultRecord[], b: readonly ResultRecord[], clearedBefore: number): ResultRecord[] {
  const byId = new Map<string, ResultRecord>();
  for (const r of [...a, ...b]) {
    if (r.at <= clearedBefore) continue;
    const known = byId.get(r.id);
    // identical ids are the same test; keep whichever copy still has its chart data
    if (!known || (!known.series && r.series)) byId.set(r.id, r);
  }
  return [...byId.values()].sort((x, y) => x.at - y.at).slice(-MAX_RECORDS);
}

/** Settings: the most recently modified copy wins as a whole. */
export function mergeSettings(local: Settings, remote: Settings): Settings {
  return remote.updatedAt > local.updatedAt ? remote : local;
}

export function mergeSnapshots(local: Snapshot, remote: Snapshot): Snapshot {
  const clearedBefore = Math.max(local.clearedBefore, remote.clearedBefore);
  return {
    app: 'zapped',
    version: 1,
    exportedAt: Date.now(),
    settings: mergeSettings(local.settings, remote.settings),
    history: mergeHistory(local.history, remote.history, clearedBefore),
    clearedBefore,
  };
}

/** True when `next` carries something `base` does not have. */
export function differs(base: Snapshot, next: Snapshot): boolean {
  if (base.clearedBefore !== next.clearedBefore) return true;
  if (base.settings.updatedAt !== next.settings.updatedAt) return true;
  if (base.history.length !== next.history.length) return true;
  const ids = new Set(base.history.map((r) => r.id));
  return next.history.some((r) => !ids.has(r.id));
}
