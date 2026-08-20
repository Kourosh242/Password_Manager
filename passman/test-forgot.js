'use strict';
/* Focused test: "forgot password" flow on the lock page. */

const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

app.setPath('userData', path.join(os.tmpdir(), 'opm-forgot-' + Date.now()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const OUT = '/tmp/opm-forgot';
fs.mkdirSync(OUT, { recursive: true });

app.whenReady().then(async () => {
  const out = {};
  try {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_d, cb) => cb({ cancel: true }));
    const win = new BrowserWindow({
      width: 1140, height: 760, show: false, backgroundColor: '#f5f6fa',
      webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
    });
    const logs = [];
    win.webContents.on('console-message', (_e, l, m) => logs.push(m));
    const js = (c) => win.webContents.executeJavaScript(c, true);
    const shot = async (n) => fs.writeFileSync(`${OUT}/${n}.png`, (await win.webContents.capturePage()).toPNG());

    await win.loadFile(path.join(__dirname, 'app', 'Index.html'));
    for (let i = 0; i < 20; i++) { if (await js(`!!document.getElementById('master-password')`)) break; await sleep(250); }

    // 1. no vault -> forgot button absent
    out.step1_firstRun = await js(`(() => {
      const links = Array.from(document.querySelectorAll('.lock-links button, .lock-links a')).map(x => x.textContent.trim());
      return { links, forgotPresent: links.includes('فراموشی رمز عبور') };
    })()`);
    await shot('1-first-run-lock');

    // 2. create vault
    await js(`document.getElementById('master-password').value='Test-1234-Abc!'; document.getElementById('master-confirm').value='Test-1234-Abc!'; document.querySelector('form').requestSubmit(); true;`);
    await sleep(3500);

    // 3. lock again -> forgot button present
    await js(`location.reload(); true;`);
    await sleep(2500);
    out.step3_hasVault = await js(`(() => {
      const links = Array.from(document.querySelectorAll('.lock-links button, .lock-links a')).map(x => x.textContent.trim());
      return { links, forgotPresent: links.includes('فراموشی رمز عبور'), hasConfirmField: !!document.getElementById('master-confirm') };
    })()`);
    await shot('2-lock-with-forgot');

    // 4. click forgot -> dialog appears with the security message
    await js(`Array.from(document.querySelectorAll('.lock-links button')).find(b => b.textContent.includes('فراموشی')).click(); true;`);
    await sleep(900);
    out.step4_dialog = await js(`(() => {
      const d = document.querySelector('dialog');
      const btns = Array.from(d.querySelectorAll('.dialog-actions .btn')).map(b => ({ text: b.textContent.trim(), cls: b.className }));
      return { open: d.open, title: d.querySelector('.dialog-title').textContent, body: d.querySelector('p').textContent, btns };
    })()`);
    await shot('3-forgot-dialog');

    // 5. confirm the wipe
    await js(`Array.from(document.querySelectorAll('dialog .dialog-actions .btn')).find(b => b.textContent.includes('پاک کن')).click(); true;`);
    await sleep(1500);
    out.step5_afterWipe = await js(`({
      hash: location.hash,
      createMode: !!document.getElementById('master-confirm'),
      toast: document.getElementById('toast-root').textContent
    })`);
    await shot('4-after-wipe-create-mode');

    // 6. reload -> still fresh (vault really gone from IndexedDB)
    await js(`location.reload(); true;`);
    await sleep(2500);
    out.step6_reload = await js(`({
      createMode: !!document.getElementById('master-confirm'),
      forgotAbsent: !Array.from(document.querySelectorAll('.lock-links button')).some(b => b.textContent.includes('فراموشی'))
    })`);

    // 7. can create a new vault from scratch
    await js(`document.getElementById('master-password').value='New-Master-999!'; document.getElementById('master-confirm').value='New-Master-999!'; document.querySelector('form').requestSubmit(); true;`);
    await sleep(3500);
    out.step7_newVault = await js(`({ hash: location.hash, dashboard: document.getElementById('app-root').textContent.includes('داشبورد') })`);

    out.logs = logs;
    console.log('FORGOT_JSON ' + JSON.stringify(out, null, 2));
  } catch (e) {
    out.error = String(e && e.stack || e);
    console.log('FORGOT_JSON ' + JSON.stringify(out, null, 2));
  } finally {
    app.exit(0);
  }
});
