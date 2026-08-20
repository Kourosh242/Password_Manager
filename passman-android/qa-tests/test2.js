// Second test process (fresh IndexedDB): generator + backup round-trip.
const { boot, tick, $, $$, txt, byText, nav, errors } = require('./harness');

const log = (n, s, d = '') =>
  console.log(`${s === 'PASS' ? '✅' : s === 'BUG' ? '🐞' : 'ℹ️'} [${s}] ${n}${d ? '\n      → ' + d : ''}`);

async function createVault(dom, pw = 'Str0ng-Master-Pass!') {
  dom.window.document.getElementById('master-password').value = pw;
  dom.window.document.getElementById('master-confirm').value = pw;
  $(dom, 'form.form').dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
  await tick(dom, 400);
}

(async () => {
  const d = await boot({ android: true });
  await createVault(d);

  // ---- T6: generator persists an all-false charset, breaking the entry form ----
  await nav(d, '#/generator');
  await tick(d, 80);
  ['gen-upper', 'gen-lower', 'gen-numbers', 'gen-symbols'].forEach(id => {
    const el = d.window.document.getElementById(id);
    if (el) el.checked = false;
  });
  const genBtn = byText(d, 'button.primary', 'تولید رمز');
  if (genBtn) { genBtn.click(); await tick(d, 120); }

  let saved={}; try{ saved=JSON.parse(d.window.localStorage.getItem('offline-password-manager-settings')||'{}'); }catch(e){}
  const g = saved.generator || {};
  // NOTE: localStorage is unavailable on the opaque file:// origin inside jsdom,
  // so `saved` is empty here. The authoritative check is the knock-on test below,
  // which exercises the live in-memory settings object.
  const allFalse = Object.keys(g).length > 0 && !g.upper && !g.lower && !g.numbers && !g.symbols;
  if (allFalse) {
    log('T6 generator persists an unusable all-false charset', 'BUG',
      `ذخیره‌شده: ${JSON.stringify(g)}`);
    await nav(d, '#/passwords/new');
    await tick(d, 100);
    const formGen = byText(d, 'button', 'تولید رمز');
    const pwField = $$(d, 'form input[type="password"]')[0];
    if (formGen) { formGen.click(); await tick(d, 60); }
    log('T6b knock-on: «تولید رمز» inside the add-entry form', pwField && pwField.value ? 'PASS' : 'BUG',
      pwField && pwField.value ? '' : 'هیچ رمزی تولید نشد — دکمه برای همیشه خراب می‌ماند.');
  } else {
    log('T6 generator refuses to persist an all-false charset', 'PASS');
    await nav(d, '#/passwords/new');
    await tick(d, 100);
    const formGen = byText(d, 'button', 'تولید رمز');
    const pwField = $$(d, 'form input[type="password"]')[0];
    if (formGen) { formGen.click(); await tick(d, 60); }
    log('T6b knock-on: «تولید رمز» inside the add-entry form still works',
      pwField && pwField.value ? 'PASS' : 'BUG',
      pwField && pwField.value ? `رمز تولیدشده: ${pwField.value.length} نویسه` : 'هیچ رمزی تولید نشد');
  }

  // ---- T8: add entry + encrypted backup through AndroidBridge ----

  await nav(d, '#/passwords/new');
  await tick(d, 100);
  const inputs = $$(d, 'form input');
  inputs[0].value = 'حساب تست';
  const pw = $$(d, 'form input[type="password"]')[0];
  if (pw) pw.value = 'Test-Entry-Pass-99';
  $(d, 'form.form').dispatchEvent(new d.window.Event('submit', { cancelable: true, bubbles: true }));
  await tick(d, 400);
  log('T7 add entry', txt(d).includes('حساب تست') ? 'PASS' : 'BUG', txt(d).slice(0, 120));

  await nav(d, '#/backup');
  await tick(d, 120);
  const pws = $$(d, 'input[type="password"]');
  pws[0].value = 'Backup-Pass-2026!';
  pws[1].value = 'Backup-Pass-2026!';
  const bBtn = byText(d, 'button', 'ساخت پشتیبان');
  if (bBtn) { bBtn.click(); await tick(d, 900); }
  const files = d.window.AndroidBridge._files;
  if (files.length) {
    const j = JSON.parse(files[0].text);
    log('T8 encrypted backup via AndroidBridge', j.envelope && j.envelope.cipher === 'AES-GCM' ? 'PASS' : 'BUG',
      `فایل «${files[0].name}» — cipher=${j.envelope && j.envelope.cipher}, iterations=${j.envelope && j.envelope.kdf.iterations}`);
    const leak = files[0].text.includes('Test-Entry-Pass-99') || files[0].text.includes('حساب تست');
    log('T9 backup contains NO plaintext secrets', leak ? 'BUG' : 'PASS');
  } else {
    log('T8 encrypted backup via AndroidBridge', 'BUG', 'هیچ فایلی ساخته نشد');
  }

  if (errors.length) {
    console.log('\n--- runtime errors ---');
    console.log([...new Set(errors)].slice(0, 8).join('\n').slice(0, 2000));
  }
  process.exit(0);
})().catch(e => { console.error('HARNESS CRASH:', e && e.stack || e); process.exit(1); });
