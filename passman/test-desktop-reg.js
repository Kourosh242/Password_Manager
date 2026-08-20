'use strict';
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const os = require('os');
app.setPath('userData', path.join(os.tmpdir(), 'opm-desk-reg-' + Date.now()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
app.whenReady().then(async () => {
  const out = {};
  try {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_d, cb) => cb({ cancel: true }));
    const win = new BrowserWindow({ width: 1140, height: 760, show: false, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    const js = (c) => win.webContents.executeJavaScript(c, true);
    const logs = [];
    win.webContents.on('console-message', (_e, l, m) => logs.push(m));
    await win.loadFile(path.join(__dirname, 'app', 'Index.html'));

    let ok = false;
    for (let i = 0; i < 20; i++) {
      ok = await js(`!!document.getElementById('master-password')`);
      if (ok) break;
      await sleep(300);
    }
    out.lockRendered = ok;

    await js(`document.getElementById('master-password').value='Test-1234-Abc!'; document.getElementById('master-confirm').value='Test-1234-Abc!'; document.querySelector('form').requestSubmit(); true;`);
    await sleep(4000);
    out.hashAfterCreate = await js(`location.hash`);

    await js(`location.hash = '#/search'; true;`);
    await sleep(800);
    out.dashboard = await js(`({
      labels: Array.from(document.querySelectorAll('.nav-link span:last-child')).map(s=>s.textContent),
      filterPanelOpenByDefault: document.querySelector('.filter-panel').classList.contains('open'),
      toggleHidden: getComputedStyle(document.querySelector('.filter-toggle')).display === 'none',
      platformAndroid: document.documentElement.dataset.platform === 'android'
    })`);
    out.logs = logs;
    console.log('DESKTOP_REG ' + JSON.stringify(out, null, 2));
  } catch (e) {
    out.error = String(e && e.stack || e);
    console.log('DESKTOP_REG ' + JSON.stringify(out, null, 2));
  } finally {
    app.exit(0);
  }
});
