import { settings } from '../settings/store';
import { KEYS, readJSON, readString, writeJSON, writeString } from '../storage/local';
import { history } from '../stats/history';
import { createGist, findGist, GistError, readGist, verifyToken, writeGist } from './gist';
import { differs, mergeSnapshots } from './merge';
import { applySnapshot, buildSnapshot } from './portable';

export type SyncState = 'off' | 'idle' | 'syncing' | 'ok' | 'error';

interface SyncConfig {
  gistId: string | null;
  login: string | null;
  auto: boolean;
  lastSyncAt: number | null;
}

const DEFAULT_CONFIG: SyncConfig = { gistId: null, login: null, auto: true, lastSyncAt: null };

type Listener = () => void;

/**
 * Optional sync through a secret gist. The token lives only in this browser's
 * localStorage and is sent only to api.github.com.
 */
class SyncManager {
  state: SyncState = 'off';
  message = '';
  private config: SyncConfig = { ...DEFAULT_CONFIG, ...readJSON<Partial<SyncConfig>>(KEYS.sync, {}) };
  private listeners = new Set<Listener>();
  private running = false;
  private again = false;
  private timer = 0;
  private applying = false;

  constructor() {
    if (this.token()) this.state = 'idle';
    history.subscribe(() => !this.applying && this.schedule(3000));
    settings.subscribe(() => !this.applying && this.schedule(10000));
  }

  token(): string | null {
    return readString(KEYS.token);
  }

  get connected(): boolean {
    return this.token() !== null;
  }
  get login(): string | null {
    return this.config.login;
  }
  get auto(): boolean {
    return this.config.auto;
  }
  get lastSyncAt(): number | null {
    return this.config.lastSyncAt;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(state: SyncState, message = ''): void {
    this.state = state;
    this.message = message;
    for (const fn of this.listeners) fn();
  }

  private saveConfig(patch: Partial<SyncConfig>): void {
    this.config = { ...this.config, ...patch };
    writeJSON(KEYS.sync, this.config);
  }

  /** Validates the token, locates (or creates) the gist and does a first sync. */
  async connect(token: string): Promise<void> {
    const clean = token.trim();
    if (!clean) throw new GistError('Pega primero un token.', 0);
    this.emit('syncing', 'Comprobando el token…');
    try {
      const login = await verifyToken(clean);
      writeString(KEYS.token, clean);
      this.saveConfig({ login, gistId: null });
    } catch (err) {
      this.emit(this.connected ? 'idle' : 'off', '');
      throw err;
    }
    await this.syncNow();
  }

  disconnect(): void {
    window.clearTimeout(this.timer);
    writeString(KEYS.token, null);
    this.saveConfig({ ...DEFAULT_CONFIG, auto: this.config.auto });
    this.emit('off');
  }

  setAuto(auto: boolean): void {
    this.saveConfig({ auto });
    this.emit(this.state, this.message);
    if (auto) this.schedule(500);
  }

  private schedule(delay: number): void {
    if (!this.connected || !this.config.auto) return;
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => void this.syncNow().catch(() => undefined), delay);
  }

  /** Fetch, merge, write back. Calls made while one is running collapse into a single re-run. */
  async syncNow(): Promise<void> {
    const token = this.token();
    if (!token) return;
    if (this.running) {
      this.again = true;
      return;
    }
    this.running = true;
    this.emit('syncing', 'Sincronizando…');
    try {
      await this.runOnce(token, true);
      this.saveConfig({ lastSyncAt: Date.now() });
      this.emit('ok', 'Sincronizado');
    } catch (err) {
      const message = err instanceof GistError ? err.message : 'No se pudo sincronizar.';
      this.emit('error', message);
      throw err;
    } finally {
      this.running = false;
      if (this.again) {
        this.again = false;
        this.schedule(500);
      }
    }
  }

  private async runOnce(token: string, retryIfMissing: boolean): Promise<void> {
    const local = buildSnapshot();
    let id = this.config.gistId ?? (await findGist(token));
    if (!id) {
      id = await createGist(token, local);
      this.saveConfig({ gistId: id });
      return;
    }
    if (id !== this.config.gistId) this.saveConfig({ gistId: id });

    let remote;
    try {
      remote = await readGist(token, id);
    } catch (err) {
      if (err instanceof GistError && err.status === 404 && retryIfMissing) {
        this.saveConfig({ gistId: null }); // the gist was deleted: start over with a new one
        return this.runOnce(token, false);
      }
      throw err;
    }
    if (!remote) {
      await writeGist(token, id, local);
      return;
    }
    const merged = mergeSnapshots(local, remote);
    if (differs(remote, merged)) await writeGist(token, id, merged);
    if (differs(local, merged)) {
      this.applying = true; // our own write must not trigger another round
      try {
        applySnapshot(merged);
      } finally {
        this.applying = false;
      }
    }
  }

  /** Called once at start-up. */
  start(): void {
    if (this.connected && this.config.auto) this.schedule(800);
  }
}

export const sync = new SyncManager();
