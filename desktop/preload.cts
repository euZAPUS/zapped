import { contextBridge, ipcRenderer } from 'electron';

interface UpdateStatus {
  state: string;
  version?: string;
  percent?: number;
  message?: string;
  auto?: boolean;
}

// Minimal, explicit surface for the web app. Nothing else from Node/Electron is exposed.
contextBridge.exposeInMainWorld('zapperDesktop', {
  version: process.argv.find((a) => a.startsWith('--zapper-version='))?.split('=')[1] ?? '',
  platform: process.platform,
  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('updater:check'),
  installUpdate: (): void => ipcRenderer.send('updater:install'),
  lastUpdateStatus: (): Promise<UpdateStatus> => ipcRenderer.invoke('updater:last'),
  onUpdateStatus: (cb: (status: UpdateStatus) => void): (() => void) => {
    const listener = (_e: unknown, status: UpdateStatus): void => cb(status);
    ipcRenderer.on('updater:status', listener);
    return () => ipcRenderer.removeListener('updater:status', listener);
  },
  writeBackup: (json: string): Promise<void> => ipcRenderer.invoke('backup:write', json),
  readBackup: (): Promise<string | null> => ipcRenderer.invoke('backup:read'),
});
