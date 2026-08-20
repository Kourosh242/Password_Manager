'use strict';
/* Smoke test: boots the real app in Electron 22, exercises the UI, captures screenshots. */

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// fresh isolated profile for the test
app.setPath('userData', path.join(os.tmpdir(), 'opm-smoke-' + Date.now()));

const results = { steps: {}, logs: [] };

app.whenReady().then(async () => {
  // same offline policy as the production main.js
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (_d, cb) => cb({ cancel: true })
  );

  const win = new BrowserWindow({
    width: 1140,
    height: 760,
    show: false,
    backgroundColor: '#f5f6fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });

  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    results.logs.push(`[lvl${level}] ${message} (${String(sourceId).split('/').pop()}:${line})`);
  });
  win.webContents.on('preload-error', (_e, p, err) => results.logs.push('PRELOAD ERROR: ' + err));
  win.webContents.on('render-process-gone', (_e, d) => results.logs.push('RENDERER GONE: ' + JSON.stringify(d)));
  win.webContents.on('did-fail-load', (_e, code, desc) => results.logs.push('DID FAIL LOAD: ' + code + ' ' + desc));

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const js = (code) => win.webContents.executeJavaScript(code, true);

  try {
    await win.loadFile(path.join(__dirname, 'app', 'Index.html'));
    await sleep(2200);

    results.steps.initial = await js(`({
      hash: location.hash,
      hasLock: !!document.getElementById('master-password'),
      hasConfirm: !!document.getElementById('master-confirm'),
      logoLoaded: (() => { const i = document.querySelector('.lock-logo'); return !!i && i.naturalWidth === 96; })(),
      fontApplied: getComputedStyle(document.body).fontFamily.includes('Vazirmatn'),
      isSecure: window.isSecureContext,
      hasCrypto: !!window.crypto && !!window.crypto.subtle,
      hasElectronAPI: !!(window.electronAPI && window.electronAPI.saveTextFile),
      cspMeta: !!document.querySelector('meta[http-equiv="Content-Security-Policy"]')
    })`);

    fs.writeFileSync('/tmp/shot-lock.png', (await win.webContents.capturePage()).toPNG());

    // create a vault through the real form
    await js(`
      document.getElementById('master-password').value = 'Test-1234-Abc!';
      document.getElementById('master-confirm').value = 'Test-1234-Abc!';
      document.querySelector('form').requestSubmit();
      true;
    `);
    await sleep(4000);

    results.steps.afterCreate = await js(`({
      hash: location.hash,
      hasDashboard: document.getElementById('app-root').textContent.includes('داشبورد'),
      hasNav: !!document.querySelector('.nav'),
      appbarLogo: (() => { const i = document.querySelector('.appbar-logo'); return !!i && i.complete && i.naturalWidth > 0; })(),
      statCards: document.querySelectorAll('.stat-card').length,
      toast: document.getElementById('toast-root').textContent
    })`);

    fs.writeFileSync('/tmp/shot-dashboard.png', (await win.webContents.capturePage()).toPNG());

    // persistence: reload should show LOCK page with a single password field (vault exists)
    win.webContents.reload();
    await sleep(2500);

    results.steps.afterReload = await js(`({
      hash: location.hash,
      hasLock: !!document.getElementById('master-password'),
      hasConfirm: !!document.getElementById('master-confirm'),
      // no confirm field => vault record was persisted in IndexedDB and read back
      vaultPersisted: !document.getElementById('master-confirm')
    })`);

    // unlock with the right password
    await js(`
      document.getElementById('master-password').value = 'Test-1234-Abc!';
      document.querySelector('form').requestSubmit();
      true;
    `);
    await sleep(3500);

    results.steps.afterUnlock = await js(`({
      hash: location.hash,
      hasDashboard: document.getElementById('app-root').textContent.includes('داشبورد')
    })`);

    // add an entry through the real form (exercises re-encryption + IndexedDB write)
    await js(`location.hash = '#/passwords/new'; true;`);
    await sleep(900);
    await js(`
      const inputs = document.querySelectorAll('input.input');
      inputs[0].value = 'Gmail';                                   // title
      Array.from(inputs).find(i => i.getAttribute('aria-label') === 'رمز عبور').value = 'SuperSecret1!';
      document.querySelector('form').requestSubmit();
      true;
    `);
    await sleep(3000);
    results.steps.entryCreated = await js(`({
      hash: location.hash,
      showsTitle: document.getElementById('app-root').textContent.includes('Gmail')
    })`);

    // open generator page + dark theme to render more surface
    await js(`location.hash = '#/generator'; true;`);
    await sleep(800);
    fs.writeFileSync('/tmp/shot-generator.png', (await win.webContents.capturePage()).toPNG());
    await js(`
      localStorage.setItem('offline-password-manager-settings',
        JSON.stringify({ ...JSON.parse(localStorage.getItem('offline-password-manager-settings')), theme: 'dark' }));
      location.reload(); true;
    `);
    await sleep(2500);
    fs.writeFileSync('/tmp/shot-lock-dark.png', (await win.webContents.capturePage()).toPNG());

    console.log('SMOKE_RESULTS ' + JSON.stringify(results, null, 2));
  } catch (error) {
    results.logs.push('HARNESS ERROR: ' + (error && error.stack || error));
    console.log('SMOKE_RESULTS ' + JSON.stringify(results, null, 2));
  } finally {
    app.exit(0);
  }
});
