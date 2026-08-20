# Security

## Reporting

If you find a vulnerability, please open a private GitHub security advisory or contact the maintainers. Do not file a public issue for unreleased secrets.

## Signing keys

Release keystores, `keystore.properties`, and any passwords **must stay off git**.

A previous release keystore was committed by mistake (binary + passwords in git history). That key is **compromised**. Generate a new local keystore before any public or Play Store build. See `passman-android/keystore/README.md`.

Even after deleting the files from `HEAD`, older git commits on GitHub may still contain the blob until history is rewritten and GitHub cache is purged. Rotate the key; do not reuse it.

## Crypto

Vaults use AES-256-GCM. Keys are derived with PBKDF2-SHA-256 (310,000 iterations) and a random 16-byte salt. The master password is never persisted. Backups are independently encrypted envelopes.

Master password policy: minimum 8 characters, rejects common and repeated passwords.

## Offline policy

- Android manifest has no `INTERNET` permission
- WebView intercepts and drops `http`/`https` (and anything outside `file:///android_asset/`)
- Electron cancels all `http`/`https` session requests
- External links open in the system browser only (`http`/`https`)
- CSP: `default-src 'none'` plus explicit self/inline/data for the bundled UI; `connect-src 'none'`
