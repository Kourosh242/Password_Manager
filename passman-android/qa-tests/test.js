const { boot, tick, $, $$, txt, byText, nav, errors, resetDB } = require('./harness');

const results = [];
const log = (name, status, detail = '') => {
  results.push({ name, status, detail });
  const icon = status === 'PASS' ? '✅' : status === 'BUG' ? '🐞' : '⚠️';
  console.log(`${icon} [${status}] ${name}${detail ? '\n      → ' + detail : ''}`);
};

async function createVault(dom, pw = 'Str0ng-Master-Pass!') {
  const pwInput = dom.window.document.getElementById('master-password');
  const confirm = dom.window.document.getElementById('master-confirm');
  pwInput.value = pw; confirm.value = pw;
  $(dom, 'form.form').dispatchEvent(new dom.window.Event('submit', { cancelable: true, bubbles: true }));
  await tick(dom, 400);
}

(async () => {
  console.log('=== Booting app in simulated Android WebView ===\n');
  const dom = await boot({ android: true });
  const W = dom.window;

  // ---------- T1: boot reaches the lock screen ----------
  if (txt(dom).includes('ساخت گاوصندوق')) log('T1 boot → lock/create screen', 'PASS');
  else log('T1 boot → lock/create screen', 'FAIL', txt(dom).slice(0, 200));

  // ---------- T2: create vault ----------
  await createVault(dom);
  if (txt(dom).includes('داشبورد')) log('T2 create vault → dashboard', 'PASS');
  else log('T2 create vault → dashboard', 'FAIL', txt(dom).slice(0, 200));

  // ---------- T3: pagehide leaves state inconsistent (crash) ----------
  {
    W.dispatchEvent(new W.Event('pagehide'));
    const app = W.__APP_DEBUG__;
    let crashed = false, detail = '';
    const before = errors.length;
    try {
      await nav(dom, '#/dashboard');
      W.dispatchEvent(new W.HashChangeEvent('hashchange'));
      await tick(dom, 60);
    } catch (e) { crashed = true; detail = e.message; }
    const newErrors = errors.slice(before).join(' | ');
    if (crashed || /Cannot read properties of null|null .*entries/.test(newErrors)) {
      log('T3 pagehide → vault=null but locked=false → render crash', 'BUG',
        'صفحه سفید: ' + (detail || newErrors).slice(0, 220));
    } else {
      log('T3 pagehide state consistency', 'PASS', newErrors.slice(0, 150));
    }
  }

  // fresh boot for remaining tests
  await resetDB();
  const d2 = await boot({ android: true });
  await tick(d2, 100);
  await createVault(d2);

  // ---------- T4: /favorites sticky filter ----------
  {
    await nav(d2, '#/favorites');
    await tick(d2, 60);
    await nav(d2, '#/search');
    await tick(d2, 80);
    const favChip = d2.window.document.getElementById('filter-onlyFavorites');
    if (favChip && favChip.checked) {
      log('T4 /favorites leaves onlyFavorites stuck ON for the whole list', 'BUG',
        'بعد از یک‌بار بازدید از علاقه‌مندی‌ها، صفحهٔ رمزها برای همیشه فیلترشده می‌ماند.');
    } else {
      log('T4 /favorites filter reset', 'PASS');
    }
  }

  // ---------- T5: history pollution on locked redirect ----------
  {
    const app = d2.window;
    const lenBefore = app.history.length;
    await nav(d2, '#/settings');
    // lock
    const lockBtn = $$(d2, '.appbar .icon-btn')[0];
    if (lockBtn) { lockBtn.click(); await tick(d2, 120); }
    const before = app.history.length;
    await nav(d2, '#/dashboard'); // should bounce back to #/lock
    await tick(d2, 80);
    const after = app.history.length;
    if (after > before + 1) {
      log('T5 locked-redirect pushes extra history entries', 'BUG',
        `history ${before} → ${after}: دکمهٔ بازگشت اندروید در صفحهٔ قفل گیر می‌کند.`);
    } else {
      log('T5 locked-redirect history', 'INFO', `history ${before} → ${after}`);
    }
  }

  console.log('\n=== جمع‌بندی ===');
  const bugs = results.filter(r => r.status === 'BUG' || r.status === 'FAIL');
  console.log(`تست‌ها: ${results.length} | مشکل: ${bugs.length}`);
  if (errors.length) {
    console.log('\n--- خطاهای runtime ثبت‌شده ---');
    console.log([...new Set(errors)].slice(0, 12).join('\n').slice(0, 3000));
  }
  process.exit(0);
})().catch(e => { console.error('HARNESS CRASH:', e); process.exit(1); });
