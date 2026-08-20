'use strict';
/* Smoke test: Android-mode mobile UI verification (UA + 390x844 viewport). */

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.setPath('userData', path.join(os.tmpdir(), 'opm-android-smoke-' + Date.now()));

const SHOTS = '/home/user/passman-android/screenshots';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';

const results = { steps: {}, logs: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] }, (_d, cb) => cb({ cancel: true })
  );

  const win = new BrowserWindow({
    width: 390, height: 844, show: false, backgroundColor: '#f5f6fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false
    }
  });

  win.webContents.setUserAgent(ANDROID_UA);
  win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    results.logs.push(`[lvl${level}] ${message} (${String(sourceId).split('/').pop()}:${line})`);
  });
  win.webContents.on('preload-error', (_e, p, err) => results.logs.push('PRELOAD ERROR: ' + err));

  const js = (code) => win.webContents.executeJavaScript(code, true);
  const shot = async (name) => {
    fs.writeFileSync(`${SHOTS}/${name}.png`, (await win.webContents.capturePage()).toPNG());
  };

  try {
    await win.loadFile(path.join(__dirname, 'app', 'Index.html'));
    await sleep(2200);

    results.steps.platform = await js(`({
      isAndroid: document.documentElement.dataset.platform === 'android',
      hash: location.hash,
      viewportW: innerWidth
    })`);
    await shot('android-01-lock');

    // create vault
    await js(`
      document.getElementById('master-password').value = 'Test-1234-Abc!';
      document.getElementById('master-confirm').value = 'Test-1234-Abc!';
      document.querySelector('form').requestSubmit(); true;
    `);
    await sleep(4000);

    results.steps.nav = await js(`({
      labels: Array.from(document.querySelectorAll('.nav-link span:last-child')).map(s => s.textContent),
      icons: document.querySelectorAll('.nav-icon').length,
      hasPasswordsTab: Array.from(document.querySelectorAll('.nav-link')).some(a => a.textContent.includes('رمزها')),
      hasFavoritesTab: Array.from(document.querySelectorAll('.nav-link')).some(a => a.textContent.includes('علاقه\u200cمندی')),
      navIsBottomBar: (() => { const n = document.querySelector('.nav'); const r = n.getBoundingClientRect(); return getComputedStyle(n).position === 'fixed' && r.bottom > 780; })()
    })`);
    await shot('android-02-dashboard');

    // add a sample entry so lists aren't empty
    await js(`location.hash = '#/passwords/new'; true;`);
    await sleep(800);
    await js(`
      const inputs = document.querySelectorAll('input.input');
      inputs[0].value = 'Instagram';
      Array.from(inputs).find(i => i.getAttribute('aria-label') === 'رمز عبور').value = 'SuperSecret1!';
      document.querySelector('form').requestSubmit(); true;
    `);
    await sleep(2800);
    await shot('android-03-entry-details');

    // search page: filter panel closed by default + toggle works
    await js(`location.hash = '#/search'; true;`);
    await sleep(900);
    results.steps.search = await js(`({
      panelExists: !!document.querySelector('.filter-panel'),
      panelInitiallyClosed: !document.querySelector('.filter-panel').classList.contains('open'),
      toggleVisible: getComputedStyle(document.querySelector('.filter-toggle')).display !== 'none'
    })`);
    await shot('android-04-search-closed');

    await js(`document.querySelector('.filter-toggle').click(); true;`);
    await sleep(600);
    results.steps.filtersOpen = await js(`document.querySelector('.filter-panel').classList.contains('open')`);
    await shot('android-05-search-filters-open');

    // /passwords route still works on android and focuses search
    await js(`location.hash = '#/passwords'; true;`);
    await sleep(900);
    results.steps.passwordsRoute = await js(`({
      rendered: document.getElementById('app-root').textContent.includes('رمزهای عبور'),
      searchFocused: document.activeElement === document.querySelector('input[type="search"]')
    })`);
    await shot('android-06-passwords');

    // bottom-sheet dialog (delete confirmation)
    await js(`location.hash = '#/search'; true;`);
    await sleep(700);
    await js(`
      const a = document.querySelector('.entry-link'); location.hash = a.getAttribute('href'); true;
    `);
    await sleep(900);
    await js(`
      Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'حذف').click(); true;
    `);
    await sleep(900);
    results.steps.dialog = await js(`({
      open: !!document.querySelector('dialog') && document.querySelector('dialog').open,
      rect: (() => { const d = document.querySelector('dialog').getBoundingClientRect(); return { bottom: Math.round(d.bottom), h: Math.round(d.height), w: Math.round(d.width) }; })()
    })`);
    await shot('android-07-bottom-sheet-dialog');
    await js(`document.querySelector('dialog').close(); true;`);

    // generator + dark theme
    await js(`location.hash = '#/generator'; true;`);
    await sleep(800);
    await js(`
      Array.from(document.querySelectorAll('.main button')).find(b => b.textContent.includes('تولید رمز')).click(); true;
    `);
    await sleep(700);
    await shot('android-08-generator');

    await js(`
      localStorage.setItem('offline-password-manager-settings', JSON.stringify({ theme: 'dark', accent: '#6750a4' }));
      location.reload(); true;
    `);
    await sleep(2500);
    await shot('android-09-dark-lock');

    console.log('SMOKE_RESULTS ' + JSON.stringify(results, null, 2));
  } catch (error) {
    results.logs.push('HARNESS ERROR: ' + (error && error.stack || error));
    console.log('SMOKE_RESULTS ' + JSON.stringify(results, null, 2));
  } finally {
    app.exit(0);
  }
});
