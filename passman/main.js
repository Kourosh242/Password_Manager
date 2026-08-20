'use strict';

/*
 * Offline Password Manager — Desktop shell (Electron 22.x)
 * Electron 22 is the last major line that runs on Windows 7/8/8.1 (Chromium 108),
 * while also working on Windows 10 and 11.
 */

const { app, BrowserWindow, Menu, shell, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_ID = 'com.korosh.offlinepasswordmanager';
const APP_TITLE = 'مدیر رمز عبور آفلاین';
const MAX_BACKUP_CHARS = 20 * 1024 * 1024;

let mainWindow = null;

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

Menu.setApplicationMenu(null);

function isHttpUrl(url) {
  return /^https?:/i.test(String(url || ''));
}

function isAllowedFileUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'file:') return false;
    let filePath = decodeURIComponent(parsed.pathname);
    if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(filePath)) {
      filePath = filePath.slice(1);
    }
    const resolved = path.resolve(filePath);
    const root = path.resolve(__dirname);
    const rel = path.relative(root, resolved);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1140,
    height: 760,
    minWidth: 400,
    minHeight: 560,
    title: APP_TITLE,
    icon: path.join(__dirname, 'resources', 'icon.png'),
    backgroundColor: '#f5f6fa',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      enableWebSQL: false,
      navigateOnDragDrop: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedFileUrl(url)) return;
    event.preventDefault();
    if (isHttpUrl(url)) shell.openExternal(url);
  });

  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());
  mainWindow.webContents.on('devtools-opened', () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.closeDevTools();
  });

  mainWindow.on('page-title-updated', (event) => event.preventDefault());

  const notifyHidden = () => {
    try {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('app-hidden');
    } catch {
      // window is shutting down
    }
  };
  mainWindow.on('minimize', notifyHidden);
  mainWindow.on('hide', notifyHidden);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.loadFile(path.join(__dirname, 'app', 'Index.html'));
}

function denyPermission(_webContents, _permission, callback) {
  if (typeof callback === 'function') callback(false);
}

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

  const ses = session.defaultSession;
  ses.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (_details, callback) => callback({ cancel: true })
  );
  ses.setPermissionRequestHandler(denyPermission);
  ses.setPermissionCheckHandler(() => false);
  if (typeof ses.setDevicePermissionHandler === 'function') {
    ses.setDevicePermissionHandler(() => false);
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

ipcMain.handle('app-info', () => ({ version: app.getVersion() }));

ipcMain.handle('save-text-file', async (event, payload) => {
  try {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      return { ok: false, error: 'unauthorized' };
    }

    let filename = String(payload && payload.filename ? payload.filename : 'backup.json');
    filename = path.basename(filename).replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').slice(0, 120)
      || 'backup.json';
    const text = String(payload && payload.text != null ? payload.text : '');
    if (text.length > MAX_BACKUP_CHARS) return { ok: false, error: 'too-large' };

    const mime = String((payload && payload.mime) || 'application/json');
    const ext = mime === 'application/json' ? 'json' : path.extname(filename).replace('.', '') || 'txt';

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'ذخیرهٔ فایل پشتیبان',
      defaultPath: path.join(app.getPath('downloads'), filename),
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    });

    if (result.canceled || !result.filePath) return { ok: false, canceled: true };

    fs.writeFileSync(result.filePath, text, 'utf8');
    return { ok: true, path: result.filePath };
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error) };
  }
});
