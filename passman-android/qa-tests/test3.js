// Data-integrity paths: change master password, backup→restore round trip.
const { boot, tick, $, $$, txt, byText, nav, errors } = require('./harness');
const log = (n, s, d = '') =>
  console.log(`${s === 'PASS' ? '✅' : s === 'BUG' ? '🐞' : 'ℹ️'} [${s}] ${n}${d ? '\n      → ' + d : ''}`);

const OLD = 'Str0ng-Master-Pass!';
const NEW = 'Even-Str0nger-2026!';

async function createVault(d, pw) {
  d.window.document.getElementById('master-password').value = pw;
  d.window.document.getElementById('master-confirm').value = pw;
  $(d, 'form.form').dispatchEvent(new d.window.Event('submit', { cancelable: true, bubbles: true }));
  await tick(d, 400);
}
async function addEntry(d, title, pass) {
  await nav(d, '#/passwords/new'); await tick(d, 100);
  $$(d, 'form input')[0].value = title;
  const p = $$(d, 'form input[type="password"]')[0]; if (p) p.value = pass;
  $(d, 'form.form').dispatchEvent(new d.window.Event('submit', { cancelable: true, bubbles: true }));
  await tick(d, 400);
}
async function unlock(d, pw) {
  const i = d.window.document.getElementById('master-password');
  if (!i) return 'no-lock-screen';
  i.value = pw;
  $(d, 'form.form').dispatchEvent(new d.window.Event('submit', { cancelable: true, bubbles: true }));
  await tick(d, 500);
  // reliable signal: the unlocked app shell exists (lock screen has no .appbar)
  return $(d, '.app-shell .appbar') ? 'unlocked' : 'failed';
}

(async () => {
  const d = await boot({ android: true });
  await createVault(d, OLD);
  await addEntry(d, 'حساب بانکی', 'Bank-Pass-123!');

  // ---- T10: change master password, then lock + unlock with the NEW password ----
  await nav(d, '#/settings'); await tick(d, 120);
  const btn = byText(d, 'button', 'تغییر رمز اصلی');
  btn.click(); await tick(d, 150);
  const dlgInputs = $$(d, 'dialog input[type="password"]');
  if (dlgInputs.length < 3) { log('T10 change-master dialog', 'BUG', 'دیالوگ باز نشد'); }
  else {
    dlgInputs[0].value = OLD; dlgInputs[1].value = NEW; dlgInputs[2].value = NEW;
    byText(d, 'dialog button', 'ذخیره').click();
    await tick(d, 900);

    const lockBtn = $$(d, '.appbar .icon-btn')[0];
    if (lockBtn) { lockBtn.click(); await tick(d, 250); }

    const withOld = await unlock(d, OLD);
    log('T10a old password must be REJECTED after change', withOld === 'failed' ? 'PASS' : 'BUG', 'نتیجه: ' + withOld);

    const withNew = await unlock(d, NEW);
    log('T10b new password must WORK after change', withNew === 'unlocked' ? 'PASS' : 'BUG', 'نتیجه: ' + withNew);

    await nav(d, '#/search'); await tick(d, 200);
    log('T10c entry survives password change', txt(d).includes('حساب بانکی') ? 'PASS' : 'BUG');
  }

  // ---- T11: backup → wipe → restore round trip ----
  await nav(d, '#/backup'); await tick(d, 150);
  const pws = $$(d, 'input[type="password"]');
  pws[0].value = 'Backup-Pass-2026!'; pws[1].value = 'Backup-Pass-2026!';
  byText(d, 'button', 'ساخت پشتیبان').click();
  await tick(d, 900);
  const file = d.window.AndroidBridge._files.slice(-1)[0];
  if (!file) { log('T11 backup', 'BUG', 'فایل ساخته نشد'); }
  else {
    // wipe everything, then restore into a fresh boot
    await nav(d, '#/settings'); await tick(d, 100);
    const d2 = d; // same DB
    // simulate "forgot password" wipe from the lock screen
    const lockBtn2 = $$(d2, '.appbar .icon-btn')[0];
    if (lockBtn2) { lockBtn2.click(); await tick(d2, 250); }
    const forgot = byText(d2, 'button', 'فراموشی رمز عبور');
    if (forgot) {
      forgot.click(); await tick(d2, 200);
      const yes = byText(d2, 'dialog button', 'بله، پاک کن');
      if (yes) { yes.click(); await tick(d2, 500); }
    }
    log('T11a wipe returns to create-vault screen',
      txt(d2).includes('ساخت گاوصندوق') ? 'PASS' : 'BUG', txt(d2).slice(0, 100));

    // restore
    await nav(d2, '#/restore'); await tick(d2, 200);
    const fileInput = $(d2, 'input[type="file"]');
    const blob = new (d2.window.File)([file.text], file.name, { type: 'application/json' });
    Object.defineProperty(fileInput, 'files', { value: [blob], configurable: true });
    $$(d2, 'input[type="password"]').slice(-1)[0].value = 'Backup-Pass-2026!';
    byText(d2, 'button', 'بازیابی').click();
    await tick(d2, 400);
    const yes2 = byText(d2, 'dialog button', 'بازیابی');
    if (yes2) { yes2.click(); await tick(d2, 1200); }
    await nav(d2, '#/search'); await tick(d2, 300);
    log('T11b restore brings the entry back',
      txt(d2).includes('حساب بانکی') ? 'PASS' : 'BUG', txt(d2).slice(0, 140));
  }

  // ---- T12: generator length number/slider desync ----
  await nav(d, '#/generator'); await tick(d, 150);
  const num = $(d, 'input[type="number"]');
  const range = $(d, 'input[type="range"]');
  if (num && range) {
    // real user flow: type an out-of-range value, then commit it (blur/Enter → change)
    num.value = '2';
    num.dispatchEvent(new d.window.Event('input', { bubbles: true }));
    await tick(d, 40);
    num.dispatchEvent(new d.window.Event('change', { bubbles: true }));
    await tick(d, 40);
    const synced = num.value === '4' && range.value === '4';
    log('T12 out-of-range length snaps back and stays in sync with the slider',
      synced ? 'PASS' : 'BUG',
      `number=${num.value} slider=${range.value}`);
  }

  if (errors.length) {
    console.log('\n--- runtime errors ---');
    console.log([...new Set(errors)].slice(0, 6).join('\n').slice(0, 1500));
  }
  process.exit(0);
})().catch(e => { console.error('HARNESS CRASH:', e && e.stack || e); process.exit(1); });
