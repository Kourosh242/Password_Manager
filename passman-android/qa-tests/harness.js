// Headless harness: boots Index.html in jsdom and drives the real app code.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
require('fake-indexeddb/auto');
const { webcrypto } = require('crypto');

const HTML = process.env.APP_HTML ||
  '/home/user/proj/passman-android/app/src/main/assets/Index.html';

const errors = [];

async function boot({ android = true } = {}) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push('jsdomError: ' + (e.stack || e.message)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  const dom = new JSDOM(fs.readFileSync(HTML, 'utf8'), {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'file:///android_asset/Index.html',
    virtualConsole: vc,
    beforeParse(win) {
      // --- Android WebView environment ---
      Object.defineProperty(win.navigator, 'userAgent', {
        value: android
          ? 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120 Mobile Safari/537.36'
          : 'Mozilla/5.0 (Windows NT 10.0) Chrome/120 Safari/537.36'
      });
      if (android) {
        win.AndroidBridge = {
          _files: [],
          saveTextFile(name, text, mime) {
            this._files.push({ name, text, mime });
            return JSON.stringify({ ok: true, name });
          }
        };
      }
      Object.defineProperty(win, 'crypto', {
        value: webcrypto, configurable: true, writable: true
      });
      win.isSecureContext = true;
      win.indexedDB = indexedDB;
      win.IDBKeyRange = IDBKeyRange;
      win.matchMedia = q => ({
        matches: false, media: q,
        addEventListener() {}, removeEventListener() {},
        addListener() {}, removeListener() {}
      });
      // jsdom has no <dialog> modal support
      const proto = win.HTMLDialogElement && win.HTMLDialogElement.prototype;
      if (proto) {
        proto.showModal = function () { this.open = true; this.setAttribute('open', ''); };
        proto.close = function () {
          this.open = false; this.removeAttribute('open');
          if (typeof this.onclose === 'function') this.onclose();
          this.dispatchEvent(new win.Event('close'));
        };
      }
      win.navigator.clipboard = { writeText: async () => {} };
      win.TextEncoder = TextEncoder;
      win.TextDecoder = TextDecoder;
      win.onerror = (msg, src, l, c, err) =>
        errors.push('window.onerror: ' + msg + '\n' + (err && err.stack));
      win.addEventListener('unhandledrejection', e =>
        errors.push('unhandledrejection: ' + (e.reason && (e.reason.stack || e.reason.message))));
    }
  });

  await new Promise(r => dom.window.addEventListener('load', r));
  await tick(dom, 40);
  return dom;
}

const tick = (dom, n = 20) =>
  new Promise(r => setTimeout(r, n));

const $ = (dom, sel) => dom.window.document.querySelector(sel);
const $$ = (dom, sel) => [...dom.window.document.querySelectorAll(sel)];
const txt = dom => dom.window.document.getElementById('app-root').textContent.replace(/\s+/g, ' ').trim();

function byText(dom, sel, needle) {
  return $$(dom, sel).find(e => (e.textContent || '').includes(needle));
}

async function nav(dom, hash) {
  dom.window.location.hash = hash;
  // jsdom does fire hashchange, but give it time
  await tick(dom, 30);
}

function resetDB() {
  return new Promise(res => {
    const req = indexedDB.deleteDatabase('offline-password-manager-db');
    req.onsuccess = req.onerror = req.onblocked = () => res();
  });
}

module.exports = { boot, tick, $, $$, txt, byText, nav, errors, resetDB };
