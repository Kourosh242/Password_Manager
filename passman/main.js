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

let mainWindow = null;

// ---- single instance ----
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

// No application menu: cleaner window + removes accidental DevTools/Reload shortcuts.
Menu.setApplicationMenu(null);

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
      experimentalFeatures: false
    }
  });

  // Keep the app fully offline and contained:
  //  - block every http/https request inside the app
  //  - external links (e.g. the stored website of an entry) open in the user's
  //    default system browser instead of navigating the app window
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  mainWindow.webContents.on('will-attach-webview', (event) => event.preventDefault());

  mainWindow.on('page-title-updated', (event) => event.preventDefault());

  // "Lock when hidden": on desktop, minimizing/hiding does NOT fire the page
  // visibilitychange event, so we notify the renderer explicitly.
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

app.whenReady().then(() => {
  if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

  // Hard offline policy: cancel every http/https request app-wide.
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (_details, callback) => callback({ cancel: true })
  );

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// ---- app info (version display in the About page) ----
ipcMain.handle('app-info', () => ({ version: app.getVersion() }));

// ---- backup export: native "Save as" dialog (writes the encrypted JSON file) ----
ipcMain.handle('save-text-file', async (_event, payload) => {
  try {
    const filename = String(payload && payload.filename ? payload.filename : 'backup.json');
    const text = String(payload && payload.text != null ? payload.text : '');
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
