import { KEYS, readJSON, writeJSON } from '../storage/local';
import { sanitizeSettings, type Settings } from './schema';

type Listener = (settings: Settings, changed: (keyof Settings)[]) => void;

/** Observable settings, persisted on every change. */
class SettingsStore {
  private value: Settings = sanitizeSettings(readJSON(KEYS.settings, {}));
  private listeners = new Set<Listener>();

  get(): Settings {
    return this.value;
  }

  set(patch: Partial<Settings>, opts: { touch?: boolean } = {}): void {
    const keys = (Object.keys(patch) as (keyof Settings)[]).filter((k) => this.value[k] !== patch[k]);
    if (keys.length === 0) return;
    const touch = opts.touch ?? true;
    this.value = sanitizeSettings({ ...this.value, ...patch, updatedAt: touch ? Date.now() : this.value.updatedAt });
    writeJSON(KEYS.settings, this.value);
    for (const fn of this.listeners) fn(this.value, keys);
  }

  /** Replaces everything (used by import and sync). Keeps the incoming timestamp. */
  replace(next: unknown): void {
    const before = this.value;
    this.value = sanitizeSettings(next);
    writeJSON(KEYS.settings, this.value);
    const keys = (Object.keys(this.value) as (keyof Settings)[]).filter((k) => before[k] !== this.value[k]);
    for (const fn of this.listeners) fn(this.value, keys);
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const settings = new SettingsStore();
