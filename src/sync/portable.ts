import { settings } from '../settings/store';
import { history } from '../stats/history';
import { mergeSnapshots, parseSnapshot, type Snapshot } from './merge';

export function buildSnapshot(): Snapshot {
  return {
    app: 'zapped',
    version: 1,
    exportedAt: Date.now(),
    settings: settings.get(),
    history: [...history.all()],
    clearedBefore: history.clearedBefore(),
  };
}

/** Writes a merged snapshot into the local stores, touching only what changed. */
export function applySnapshot(next: Snapshot): void {
  const local = buildSnapshot();
  if (next.settings.updatedAt !== local.settings.updatedAt) settings.replace(next.settings);
  const historyChanged =
    next.clearedBefore !== local.clearedBefore ||
    next.history.length !== local.history.length ||
    next.history.some((r) => !local.history.some((l) => l.id === r.id));
  if (historyChanged) history.replace(next.history, next.clearedBefore);
}

export function exportFileName(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `zapped-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}.json`;
}

export function downloadExport(): void {
  const blob = new Blob([JSON.stringify(buildSnapshot(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = exportFileName();
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export interface ImportSummary {
  added: number;
  settingsReplaced: boolean;
}

/**
 * Imports a JSON export. History is merged (no duplicates). Settings from the
 * file are applied because importing is an explicit act.
 */
export async function importFromFile(file: File): Promise<ImportSummary> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error('El archivo no es un JSON válido.');
  }
  const incoming = parseSnapshot(raw);
  if (!incoming) throw new Error('El archivo no parece una exportación de zapped.');

  const local = buildSnapshot();
  const merged = mergeSnapshots(local, incoming);
  const settingsReplaced = incoming.settings.updatedAt !== local.settings.updatedAt;
  merged.settings = { ...incoming.settings, updatedAt: Math.max(incoming.settings.updatedAt, Date.now()) };
  const added = merged.history.length - local.history.length;
  applySnapshot(merged);
  return { added: Math.max(0, added), settingsReplaced };
}

