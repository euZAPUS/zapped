/** Thin, failure-tolerant wrapper over localStorage (private mode, quota, disabled storage). */

const PREFIX = 'zapped:v1:';

export const KEYS = {
  settings: 'settings',
  history: 'history',
  clearedBefore: 'clearedBefore',
  sync: 'sync',
  token: 'token',
  bgImage: 'bgImage',
} as const;

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readString(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function writeString(key: string, value: string | null): boolean {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, value);
    return true;
  } catch {
    return false;
  }
}
