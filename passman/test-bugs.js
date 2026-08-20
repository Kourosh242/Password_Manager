'use strict';
/* Comprehensive bug-fix verification harness (Electron 22 = same Chromium as the Windows build). */

const { app, BrowserWindow, session, ipcMain, nativeTheme } = require('electron');
const { webcrypto } = require('node:crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.setPath('userData', path.join(os.tmpdir(), 'opm-bugs-' + Date.now()));

const OUT = '/tmp/opm-bugs';
fs.mkdirSync(OUT, { recursive: true });

const savedFiles = [];
ipcMain.handle('save-text-file', (_e, payload) => {
  savedFiles.push(payload);
  const fname = path.join(OUT, 'saved', String(payload && payload.filename || 'backup.json'));
  fs.mkdirSync(path.dirname(fname), { recursive: true });
  fs.writeFileSync(fname, String(payload && payload.text || ''), 'utf8');
  return { ok: true, path: fname };
});
ipcMain.handle('app-info', () => ({ version: '1.0.1' }));

const results = {};
const resultsLog = [];
const resultsProxy = new Proxy(results, {
  set(target, key, value) {
    target[key] = value;
    resultsLog.push(String(key));
    fs.writeFileSync('/tmp/opm-bugs/checkpoint.txt', resultsLog.join('\n'));
    return true;
  }
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.whenReady().then(async () => {
  try {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ['http://*/*', 'https://*/*'] }, (_d, cb) => cb({ cancel: true }));

    nativeTheme.themeSource = 'dark'; // simulate OS dark mode for the "system" theme test

    const win = new BrowserWindow({
      width: 1140, height: 760, show: false, backgroundColor: '#f5f6fa',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false
      }
    });
    const logs = [];
    win.webContents.on('console-message', (_e, l, m) => logs.push(m));

    // run(code) evaluates code inside an IIFE in the page
    const run = (code) => win.webContents.executeJavaScript('(() => { ' + code + ' })()', true);
    const val = (expr) => win.webContents.executeJavaScript('(() => { return (' + expr + '); })()', true);
    const shot = async (n) => fs.writeFileSync(`${OUT}/${n}.png`, (await win.webContents.capturePage()).toPNG());
    const waitFor = async (expr, tries = 25) => {
      for (let i = 0; i < tries; i++) { if (await val(expr)) return true; await sleep(250); }
      return false;
    };

    await win.loadFile(path.join(__dirname, 'app', 'Index.html'));
    await waitFor(`!!document.getElementById('master-password')`);

    // ---- issue 3: theme "system" follows the OS ----
    resultsProxy.themeSystem = await val(`({
      theme: document.documentElement.dataset.theme,
      scheme: document.documentElement.style.colorScheme
    })`);
    nativeTheme.themeSource = 'light';
    await sleep(800);
    resultsProxy.themeSystemAfterLight = await val(`document.documentElement.dataset.theme`);
    nativeTheme.themeSource = 'dark';
    await sleep(800);

    // ---- issue 7: master password "1234" accepted ----
    await run(`
      document.getElementById('master-password').value = '1234';
      document.getElementById('master-confirm').value = '1234';
      document.querySelector('form').requestSubmit(); true;
    `);
    await sleep(3800);
    resultsProxy.password1234 = await val(`({ hash: location.hash, dashboard: document.getElementById('app-root').textContent.includes('داشبورد') })`);

    // ---- issue 2: categories ----
    await run(`location.hash = '#/categories'; true;`);
    await sleep(800);

    await run(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'افزودن').click(); true;`);
    await sleep(500);
    resultsProxy.catEmpty = await val(`({ toast: document.getElementById('toast-root').textContent, focused: document.activeElement === document.querySelector('input[placeholder*="دسته"]') })`);

    await run(`document.querySelector('input[placeholder*="دسته"]').value = 'شبکه های اجتماعی'; true;`);
    await run(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'افزودن').click(); true;`);
    await sleep(1500);
    resultsProxy.catAdded = await val(`({ toast: document.getElementById('toast-root').textContent, inList: document.getElementById('app-root').textContent.includes('شبکه های اجتماعی') })`);

    await run(`document.querySelector('input[placeholder*="دسته"]').value = 'شبکه های اجتماعی'; true;`);
    await run(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'افزودن').click(); true;`);
    await sleep(500);
    resultsProxy.catDuplicate = await val(`document.getElementById('toast-root').textContent`);

    await run(`
      const input = document.querySelector('input[placeholder*="دسته"]');
      input.value = 'بانکی';
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      true;
    `);
    await sleep(1500);
    resultsProxy.catEnter = await val(`document.getElementById('app-root').textContent.includes('بانکی')`);

    // ---- issue 1: behavior section ----
    await run(`location.hash = '#/settings'; true;`);
    await sleep(900);
    resultsProxy.behavior = await val(`({
      sections: Array.from(document.querySelectorAll('.section-title')).map(s => s.textContent),
      autoLockNumberHidden: (() => {
        const el = document.querySelector('#autolock-custom');
        return el && el.parentElement && el.parentElement.style.display === 'none';
      })()
    })`);

    await run(`
      const sel = Array.from(document.querySelectorAll('select')).find(s => Array.from(s.options).some(o => o.value === 'custom'));
      sel.value = 'custom';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      true;
    `);
    await sleep(600);
    resultsProxy.behaviorCustom = await val(`({
      numberVisible: (() => {
        const el = document.querySelector('#autolock-custom');
        return el && el.parentElement && el.parentElement.style.display !== 'none';
      })(),
      numberFocused: document.activeElement === document.querySelector('#autolock-custom')
    })`);

    await run(`
      const n = document.querySelector('#autolock-custom');
      n.value = '7';
      n.dispatchEvent(new Event('input', { bubbles: true }));
      true;
    `);
    await sleep(1200);
    resultsProxy.behaviorTyped = await val(`JSON.parse(localStorage.getItem('offline-password-manager-settings')).autoLockMinutes`);

    await run(`
      const all = Array.from(document.querySelectorAll('input[type="number"]'));
      const clip = all.find(i => i.min === '0' && i.max === '300');
      clip.value = '45';
      clip.dispatchEvent(new Event('input', { bubbles: true }));
      true;
    `);
    await sleep(1200);
    resultsProxy.clipboardTyped = await val(`JSON.parse(localStorage.getItem('offline-password-manager-settings')).clipboardTimeout`);

    await run(`
      const sel2 = Array.from(document.querySelectorAll('select')).find(s => Array.from(s.options).some(o => o.value === '/generator'));
      sel2.value = '/generator';
      sel2.dispatchEvent(new Event('change', { bubbles: true }));
      true;
    `);
    await sleep(500);
    resultsProxy.startupChanged = await val(`JSON.parse(localStorage.getItem('offline-password-manager-settings')).startupPage`);
    await shot('settings-behavior');

    // ---- issue 4: dark checkboxes ----
    resultsProxy.checkboxRects = await val(`Array.from(document.querySelectorAll('input[type="checkbox"]')).slice(0, 8).map(c => {
      const r = c.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, checked: c.checked };
    })`);
    await shot('settings-dark');

    // ---- issue 6: version in About ----
    await run(`location.hash = '#/about'; true;`);
    await sleep(900);
    resultsProxy.aboutVersion = await val(`(Array.from(document.querySelectorAll('.card p')).map(p => p.textContent).find(t => t.includes('نسخهٔ برنامه')) || null)`);

    // ---- issue 5: backup create + decrypt + restore ----
    await run(`location.hash = '#/passwords/new'; true;`);
    await sleep(800);
    await run(`
      const inputs = document.querySelectorAll('input.input');
      inputs[0].value = 'Gmail';
      Array.from(inputs).find(i => i.getAttribute('aria-label') === 'رمز عبور').value = 'SuperSecret1!';
      document.querySelector('form').requestSubmit(); true;
    `);
    await sleep(2500);

    await run(`location.hash = '#/backup'; true;`);
    await sleep(800);
    await run(`
      const pws = Array.from(document.querySelectorAll('input[type="password"]')).filter(i => i.getAttribute('aria-label') === 'رمز پشتیبان' || i.getAttribute('aria-label') === 'تکرار رمز پشتیبان');
      pws[0].value = 'backup-pass-1';
      pws[1].value = 'backup-pass-1';
      Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('ساخت پشتیبان')).click(); true;
    `);
    await sleep(2500);
    resultsProxy.backupStatus = await val(`(Array.from(document.querySelectorAll('p')).map(p => p.textContent).find(t => t.includes('ذخیره شد')) || null)`);
    resultsProxy.backupSavedCount = savedFiles.length;

    if (savedFiles.length) {
      const payload = JSON.parse(savedFiles[savedFiles.length - 1].text);
      resultsProxy.backupPayloadOk = { app: payload.app, backupVersion: payload.backupVersion, kdfIterations: payload.envelope.kdf.iterations };
      const env = payload.envelope;
      const keyMaterial = await webcrypto.subtle.importKey('raw', Buffer.from('backup-pass-1', 'utf8'), 'PBKDF2', false, ['deriveKey']);
      const key = await webcrypto.subtle.deriveKey(
        { name: 'PBKDF2', salt: Buffer.from(env.kdf.saltB64, 'base64'), iterations: env.kdf.iterations, hash: 'SHA-256' },
        keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      const plain = await webcrypto.subtle.decrypt(
        { name: 'AES-GCM', iv: Buffer.from(env.ivB64, 'base64') }, key, Buffer.from(env.dataB64, 'base64'));
      const vault = JSON.parse(Buffer.from(plain).toString('utf8'));
      resultsProxy.backupDecryptedTitles = vault.entries.map(e => e.title);
      resultsProxy.backupText = JSON.stringify(payload);
    }

    // delete the entry, then restore it from the backup
    await run(`location.hash = '#/passwords'; true;`);
    await sleep(800);
    await run(`
      const a = document.querySelector('.entry-link'); location.hash = a.getAttribute('href'); true;
    `);
    await sleep(800);
    await run(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'حذف').click(); true;`);
    await sleep(700);
    await run(`Array.from(document.querySelectorAll('dialog .btn')).find(b => b.textContent.includes('حذف')).click(); true;`);
    await sleep(1500);

    await run(`location.hash = '#/restore'; true;`);
    await sleep(800);
    const bt = results.backupText;
    await run(`
      const file = new File([__BACKUP_JSON__], 'backup.json', { type: 'application/json' });
      const dt = new DataTransfer();
      dt.items.add(file);
      const fi = document.querySelector('input[type="file"]');
      fi.files = dt.files;
      true;
    `.replace('__BACKUP_JSON__', JSON.stringify(bt)));
    await run(`
      const pw = Array.from(document.querySelectorAll('input[type="password"]')).find(i => i.getAttribute('aria-label') === 'رمز فایل پشتیبان');
      pw.value = 'backup-pass-1';
      Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('بازیابی')).click(); true;
    `);
    await sleep(1000);
    await run(`Array.from(document.querySelectorAll('dialog .btn')).find(b => b.textContent.includes('بازیابی')).click(); true;`);
    await sleep(3500);
    await run(`location.hash = '#/search'; true;`);
    await sleep(900);
    resultsProxy.restored = await val(`({
      hash: location.hash,
      gmailBack: document.getElementById('app-root').textContent.includes('Gmail')
    })`);

    // ---- favorites route resets the filter ----
    await run(`location.hash = '#/favorites'; true;`);
    await sleep(800);
    const favBefore = await val(`document.querySelector('#filter-onlyFavorites').checked`);
    await run(`location.hash = '#/search'; true;`);
    await sleep(800);
    const favAfter = await val(`document.querySelector('#filter-onlyFavorites').checked`);
    resultsProxy.favoritesReset = { favBefore, favAfter };

    // ---- lock-when-hidden via desktop minimize simulation ----
    await run(`
      const s = JSON.parse(localStorage.getItem('offline-password-manager-settings'));
      s.lockWhenHidden = true;
      localStorage.setItem('offline-password-manager-settings', JSON.stringify(s));
      location.hash = '#/dashboard'; true;
    `);
    await sleep(800);
    win.webContents.send('app-hidden');
    await sleep(1200);
    resultsProxy.hiddenLock = await val(`({ hash: location.hash, locked: !!document.getElementById('master-password') })`);

    // ---- forgot-password regression ----
    await run(`document.getElementById('master-password').value = '1234'; document.querySelector('form').requestSubmit(); true;`);
    await sleep(3500);
    await run(`location.reload(); true;`);
    await sleep(2500);
    resultsProxy.forgotPresent = await val(`Array.from(document.querySelectorAll('.lock-links button')).some(b => b.textContent.includes('فراموشی'))`);
    await run(`Array.from(document.querySelectorAll('.lock-links button')).find(b => b.textContent.includes('فراموشی')).click(); true;`);
    await sleep(800);
    await run(`Array.from(document.querySelectorAll('dialog .btn')).find(b => b.textContent.includes('پاک کن')).click(); true;`);
    await sleep(1500);
    resultsProxy.forgotWipe = await val(`({ createMode: !!document.getElementById('master-confirm'), toast: document.getElementById('toast-root').textContent })`);

    resultsProxy.logs = logs;
    fs.writeFileSync('/tmp/opm-bugs/results.json', JSON.stringify(results, null, 2));
    console.log('DONE');
  } catch (e) {
    resultsProxy.error = String(e && e.stack || e);
    fs.writeFileSync('/tmp/opm-bugs/results.json', JSON.stringify(results, null, 2));
    console.log('DONE-ERROR');
  } finally {
    setTimeout(() => app.exit(0), 300);
  }
});
