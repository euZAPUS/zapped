import { app } from 'electron';
import { autoUpdater } from 'electron-updater';

export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'none' | 'error' | 'dev';

export interface UpdateStatus {
  state: UpdateState;
  version?: string;
  percent?: number;
  message?: string;
  /** Found during the start-up check: installs and restarts without asking. */
  auto?: boolean;
}

const RECHECK_MS = 4 * 60 * 60 * 1000;
const RESTART_DELAY_MS = 2200; // long enough to read "Reiniciando…"

/**
 * Auto-update from GitHub Releases.
 *
 * At launch the first check is "automatic": if a new version exists it is
 * downloaded, shown to the user and installed with an automatic restart.
 * Later checks (every few hours, or the user's button) never interrupt:
 * the update waits until the user restarts or closes the app.
 */
export class Updater {
  status: UpdateStatus = { state: 'idle' };
  private launchPhase = true;
  private checking = false;

  constructor(private readonly send: (status: UpdateStatus) => void) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.logger = null;

    autoUpdater.on('checking-for-update', () => this.set({ state: 'checking' }));
    autoUpdater.on('update-available', (info) => this.set({ state: 'available', version: info.version, auto: this.launchPhase }));
    autoUpdater.on('update-not-available', () => this.finishCheck({ state: 'none' }));
    autoUpdater.on('download-progress', (p) =>
      this.set({ state: 'downloading', version: this.status.version, percent: Math.round(p.percent), auto: this.status.auto }),
    );
    autoUpdater.on('update-downloaded', (info) => {
      const auto = this.launchPhase;
      this.set({ state: 'downloaded', version: info.version, auto });
      this.launchPhase = false;
      this.checking = false;
      if (auto) setTimeout(() => this.install(), RESTART_DELAY_MS);
    });
    autoUpdater.on('error', (err) => this.finishCheck({ state: 'error', message: err == null ? 'Error desconocido' : String(err.message ?? err) }));
  }

  private set(status: UpdateStatus): void {
    this.status = status;
    this.send(status);
  }

  private finishCheck(status: UpdateStatus): void {
    this.launchPhase = false;
    this.checking = false;
    this.set(status);
  }

  /** Called once when the window is ready. */
  start(): void {
    if (process.env.ZAPPER_FAKE_UPDATE) {
      void this.fake(process.env.ZAPPER_FAKE_UPDATE);
      return;
    }
    void this.check();
    setInterval(() => void this.check(), RECHECK_MS).unref();
  }

  async check(): Promise<void> {
    if (!app.isPackaged) {
      this.set({ state: 'dev', message: 'La actualización automática solo funciona en la app instalada.' });
      return;
    }
    if (this.checking || this.status.state === 'downloading' || this.status.state === 'downloaded') return;
    this.checking = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      if (result === null) {
        // electron-updater is inactive outside an installer build (e.g. a plain Linux folder)
        this.finishCheck({ state: 'dev', message: 'La actualización automática no está activa en esta instalación.' });
      }
    } catch (err) {
      this.finishCheck({ state: 'error', message: err instanceof Error ? err.message : 'No se pudo comprobar.' });
    }
  }

  install(): void {
    if (this.status.state !== 'downloaded') return;
    // silent install, then relaunch the app by itself
    autoUpdater.quitAndInstall(true, true);
  }

  /** Simulates the whole flow so the interface can be tried without publishing a release. */
  private async fake(version: string): Promise<void> {
    const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
    this.set({ state: 'checking' });
    await wait(900);
    this.set({ state: 'available', version, auto: true });
    for (let p = 0; p <= 100; p += 10) {
      await wait(250);
      this.set({ state: 'downloading', version, percent: p, auto: true });
    }
    this.set({ state: 'downloaded', version, auto: true });
  }
}
