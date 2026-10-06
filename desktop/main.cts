import { app, BrowserWindow, ipcMain, Menu, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { Updater } from './updater.cjs';

const APP_NAME = 'zapper-aio';
const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
const INDEX = path.join(__dirname, '..', '..', 'dist', 'index.html');
const DEV_URL = process.env.ZAPPER_DEV_URL;

app.setName(APP_NAME);

let win: BrowserWindow | null = null;
let updater: Updater | null = null;

// One window only: launching the app again focuses the existing one.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

function isOurPage(url: string): boolean {
  return DEV_URL ? url.startsWith(DEV_URL) : url.startsWith('file://') && url.includes('/dist/index.html');
}

/** IPC is only honoured from our own page. */
function trusted(event: { senderFrame?: { url: string } | null }): boolean {
  return isOurPage(event.senderFrame?.url ?? '');
}

function backupFile(): string {
  return path.join(app.getPath('userData'), 'backup', 'zapped-data.json');
}

function createWindow(): void {
  win = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 720,
    minHeight: 560,
    show: false,
    backgroundColor: '#0c0d1f',
    title: APP_NAME,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      additionalArguments: [`--zapper-version=${app.getVersion()}`],
    },
  });

  win.once('ready-to-show', () => win?.show());
  win.on('page-title-updated', (e) => e.preventDefault()); // keep the window title as the app name
  win.on('closed', () => (win = null));

  // Links open in the browser; the app window never navigates away.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isOurPage(url)) event.preventDefault();
  });

  if (!app.isPackaged) {
    win.webContents.on('before-input-event', (_e, input) => {
      if (input.type === 'keyDown' && input.key === 'F12') win?.webContents.toggleDevTools();
    });
  }

  if (DEV_URL) void win.loadURL(DEV_URL);
  else void win.loadFile(INDEX);

  updater = new Updater((status) => win?.webContents.send('updater:status', status));
  win.webContents.once('did-finish-load', () => updater?.start());
}

function setupMenu(): void {
  if (process.platform === 'darwin') {
    // macOS needs an Edit menu for copy/paste shortcuts to work
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        { role: 'appMenu' },
        { role: 'editMenu' },
        { role: 'windowMenu' },
      ]),
    );
  } else {
    Menu.setApplicationMenu(null);
  }
}

function setupIpc(): void {
  ipcMain.handle('updater:check', (e) => (trusted(e) ? updater?.check() : undefined));
  ipcMain.handle('updater:last', (e) => (trusted(e) ? updater?.status ?? { state: 'idle' } : { state: 'idle' }));
  ipcMain.on('updater:install', (e) => {
    if (trusted(e)) updater?.install();
  });

  // Last-resort copy of the user's data on disk, next to localStorage.
  ipcMain.handle('backup:write', async (e, json: unknown) => {
    if (!trusted(e) || typeof json !== 'string' || json.length > MAX_BACKUP_BYTES) return;
    const file = backupFile();
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.promises.writeFile(tmp, json, 'utf8');
    try {
      await fs.promises.copyFile(file, `${file}.prev`);
    } catch {
      /* first write */
    }
    await fs.promises.rename(tmp, file);
  });
  ipcMain.handle('backup:read', async (e) => {
    if (!trusted(e)) return null;
    try {
      return await fs.promises.readFile(backupFile(), 'utf8');
    } catch {
      return null;
    }
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  setupMenu();
  setupIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
