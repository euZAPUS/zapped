/** Contract between the web app and the Electron shell (see desktop/preload.ts). */

export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'none' | 'error' | 'dev';

export interface UpdateStatus {
  state: UpdateState;
  /** Version that is being offered or installed. */
  version?: string;
  /** Download progress, 0-100. */
  percent?: number;
  message?: string;
  /** True when found during the check at start-up: the app installs it and restarts by itself. */
  auto?: boolean;
}

export interface DesktopBridge {
  version: string;
  platform: string;
  checkForUpdates(): Promise<void>;
  /** Quits, installs the downloaded update and relaunches. */
  installUpdate(): void;
  onUpdateStatus(cb: (status: UpdateStatus) => void): () => void;
  /** Latest status already known, so late subscribers do not miss the start-up check. */
  lastUpdateStatus(): Promise<UpdateStatus>;
  writeBackup(json: string): Promise<void>;
  readBackup(): Promise<string | null>;
}

declare global {
  interface Window {
    zappedDesktop?: DesktopBridge;
  }
}

/** Present only when running inside the desktop app. */
export const desktop: DesktopBridge | null = window.zappedDesktop ?? null;
