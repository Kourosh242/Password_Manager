'use strict';
/* Visual verification: computed styles + rects + screenshots (analyzed by Python). */

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.setPath('userData', path.join(os.tmpdir(), 'opm-visual-' + Date.now()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/opm-visual';
fs.mkdirSync(OUT, { recursive: true });

async function run(width, height, ua, tag) {
  const win = new BrowserWindow({
    width, height, show: false, backgroundColor: '#f5f6fa',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false
    }
  });
  if (ua) win.webContents.setUserAgent(ua);
  const logs = [];
  win.webContents.on('console-message', (_e, l, m) => logs.push(m));
  const js = (c) => win.webContents.executeJavaScript(c, true);

  await win.loadFile(path.join(__dirname, 'app', 'Index.html'));
  for (let i = 0; i < 20; i++) { if (await js(`!!document.getElementById('master-password')`)) break; await sleep(250); }

  const lockBtn = await js(`(() => {
    const b = document.querySelector('form .btn.primary');
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    return { bg: cs.backgroundColor, color: cs.color, x: r.x, y: r.y, w: r.width, h: r.height, text: b.textContent.trim() };
  })()`);
  fs.writeFileSync(`${OUT}/${tag}-lock.png`, (await win.webContents.capturePage()).toPNG());

  await js(`document.getElementById('master-password').value='Test-1234-Abc!'; document.getElementById('master-confirm').value='Test-1234-Abc!'; document.querySelector('form').requestSubmit(); true;`);
  await sleep(4000);

  const nav = await js(`Array.from(document.querySelectorAll('.nav-link')).map(a => {
    const r = a.getBoundingClientRect();
    const icon = a.querySelector('.nav-icon');
    return { label: a.textContent.trim(), x: r.x, y: r.y, w: r.width, h: r.height,
             iconHidden: !icon || getComputedStyle(icon).display === 'none' };
  })`);
  fs.writeFileSync(`${OUT}/${tag}-dashboard.png`, (await win.webContents.capturePage()).toPNG());

  // create an entry, open the delete dialog
  await js(`location.hash = '#/passwords/new'; true;`);
  await sleep(900);
  await js(`
    const inputs = document.querySelectorAll('input.input');
    inputs[0].value = 'Gmail';
    Array.from(inputs).find(i => i.getAttribute('aria-label') === 'رمز عبور').value = 'SuperSecret1!';
    document.querySelector('form').requestSubmit(); true;
  `);
  await sleep(2500);
  await js(`Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'حذف').click(); true;`);
  await sleep(900);
  const dialogBtns = await js(`(() => {
    const d = document.querySelector('dialog');
    const btns = Array.from(d.querySelectorAll('.dialog-actions .btn')).map(b => {
      const cs = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      return { text: b.textContent.trim(), bg: cs.backgroundColor, color: cs.color, x: r.x, y: r.y, w: r.width, h: r.height };
    });
    return { open: d.open, btns };
  })()`);
  fs.writeFileSync(`${OUT}/${tag}-dialog.png`, (await win.webContents.capturePage()).toPNG());
  await js(`document.querySelector('dialog').close(); true;`);

  // search page primary add button
  await js(`location.hash = '#/search'; true;`);
  await sleep(900);
  const addBtn = await js(`(() => {
    const b = Array.from(document.querySelectorAll('.btn.primary')).find(x => x.textContent.includes('افزودن'));
    const cs = getComputedStyle(b);
    const r = b.getBoundingClientRect();
    return { bg: cs.backgroundColor, color: cs.color, x: r.x, y: r.y, w: r.width, h: r.height };
  })()`);
  fs.writeFileSync(`${OUT}/${tag}-search.png`, (await win.webContents.capturePage()).toPNG());

  win.destroy();
  return { tag, logs, lockBtn, nav, dialogBtns, addBtn };
}

app.whenReady().then(async () => {
  const out = {};
  const mode = process.argv.includes('android') ? 'android' : 'desktop';
  try {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_d, cb) => cb({ cancel: true }));
    if (mode === 'android') {
      out.android = await run(390, 844, 'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36', 'android');
    } else {
      out.desktop = await run(1140, 760, null, 'desktop');
    }
    console.log('VISUAL_JSON ' + JSON.stringify(out));
  } catch (e) {
    out.error = String(e && e.stack || e);
    console.log('VISUAL_JSON ' + JSON.stringify(out));
  } finally {
    app.exit(0);
  }
});
