'use strict';

/*
 * afterPack hook:
 * Electron-builder normally edits the Windows .exe (icon + version info) with
 * rcedit-ia32.exe under wine. This sandbox has a 64-bit-only wine, so we disable
 * electron-builder's built-in editing (signAndEditExecutable=false) and instead
 * run rcedit-x64.exe ourselves — the result is identical.
 */

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

function findRceditX64() {
  const roots = [
    path.join(os.homedir(), '.cache', 'electron-builder', 'winCodeSign'),
    process.env.ELECTRON_BUILDER_CACHE
      ? path.join(process.env.ELECTRON_BUILDER_CACHE, 'winCodeSign')
      : null
  ].filter(Boolean);

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const dir of fs.readdirSync(root)) {
      const candidate = path.join(root, dir, 'rcedit-x64.exe');
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  // defensive: download the winCodeSign bundle if it is missing entirely
  try {
    const root = roots[0];
    fs.mkdirSync(root, { recursive: true });
    const versionDir = path.join(root, 'winCodeSign-2.6.0');
    fs.mkdirSync(versionDir, { recursive: true });
    const url = 'https://github.com/electron-userland/electron-builder-binaries/releases/download/winCodeSign-2.6.0/winCodeSign-2.6.0.7z';
    const archive = path.join(root, 'winCodeSign-2.6.0.7z');
    if (!fs.existsSync(archive)) {
      execFileSync('curl', ['-sL', '-o', archive, url, '--max-time', '300'], { stdio: 'inherit' });
    }
    const target = path.join(versionDir, 'rcedit-x64.exe');
    if (!fs.existsSync(target)) {
      execFileSync('7z', ['x', '-y', archive, 'rcedit-x64.exe'], { cwd: versionDir, stdio: 'ignore' });
    }
    if (fs.existsSync(target)) return target;
  } catch {
    // fall through to null
  }

  return null;
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const productFilename = context.packager.appInfo.productFilename;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  if (!fs.existsSync(exePath)) {
    console.log(`[afterPack] exe not found: ${exePath}`);
    return;
  }

  const rcedit = findRceditX64();
  if (!rcedit) {
    console.log('[afterPack] rcedit-x64.exe not found in cache — skipping exe metadata (icon stays default)');
    return;
  }

  const iconPath = path.join(__dirname, 'resources', 'icon.ico');
  const version = context.packager.appInfo.version;
  const [major, minor, patch] = String(version || '1.0.0').split('.').map((n) => parseInt(n, 10) || 0);

  const args = [
    rcedit,
    exePath,
    '--set-icon', iconPath,
    '--set-version-string', 'FileDescription', 'Offline Password Manager',
    '--set-version-string', 'ProductName', 'Offline Password Manager',
    '--set-version-string', 'CompanyName', 'Korosh and Luna',
    '--set-version-string', 'LegalCopyright', 'Copyright 2026 Korosh and Luna',
    '--set-version-string', 'InternalName', productFilename,
    '--set-version-string', 'OriginalFilename', `${productFilename}.exe`,
    '--set-file-version', `${major}.${minor}.${patch}`,
    '--set-product-version', `${major}.${minor}.${patch}.0`
  ];

  const env = {
    ...process.env,
    WINEDEBUG: '-all',
    WINEPREFIX: process.env.WINEPREFIX || path.join(os.homedir(), '.wine64')
  };

  console.log('[afterPack] patching exe icon + version info with rcedit-x64 via wine…');
  try {
    execFileSync('wine', args, { stdio: 'inherit', env, timeout: 300000 });
    console.log('[afterPack] exe patched successfully.');
  } catch (error) {
    console.error('[afterPack] rcedit failed:', error && error.message);
    // Non-fatal: the build continues with the default icon if this ever fails.
  }
};
