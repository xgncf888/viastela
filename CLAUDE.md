# Claude Code & Agent Constitution (`CLAUDE.md`)

> **Mandatory Reading**: Before modifying any UI, data store, or packaging script in this repository, read `AGENTS.md` and `DESIGN.md` in full.

## Core Invariants Quick Reference

1. **Frontend Stack**: Pure `React 19 + TypeScript + Vite 8 + Tailwind CSS v4` (`src/lib/web-shims/react-native-dom.tsx` + `src/ui/dom.tsx`). Never alias `react-native` back to `react-native-web`.
2. **Zero Demo/Seed Data in Runtime**: Never seed `*-seed-*` or `init-meal-*` demo records into runtime `localStorage` stores (`public/pwa-head.js`, `scripts/build-macos-app.mjs`, `src/data/*`).
3. **iOS `.mobileconfig` Rules (`scripts/build-ios-ipa.mjs`)**:
   - `<key>PayloadVersion</key>` (both inner and outer) **MUST be `<integer>1</integer>`** (never `2` or `3`, which triggers iOS *"不支持此描述文件"*).
   - `<key>FullScreen</key>` **MUST be `<true/>`**.
   - `<key>URL</key>` **MUST be a valid `https://` URL** (`https://viastela.vercel.app/?shell=native`), **NEVER `data:text/html`**.
   - `<key>Icon</key>` **MUST use `public/icons/apple-touch-icon.png` (180×180)** so `.mobileconfig` stays `< 250 KB`.
4. **Android `.apk` Rules (`scripts/build-android-apk.mjs`)**:
   - Must call `patchAndroidClassesDexCacheDir(classesDexPath, 'www-v8')` so overwrite-installs extract the new `assets/webbundle.bin` instead of serving stale cached files.
   - Must use 4-byte `zipalign` + APK Signature Scheme v1 & v2 (`APK Sig Block 42`).
5. **Custom-Scheme WebView Rules (`scripts/stamp-pwa-html.js`)**:
   - Must strip `crossorigin` attributes from `dist/index.html` and normalize `/index.html` -> `/` before router mount.
6. **Brand Guard (`npm run check:brand`)**:
   - Never hardcode the capitalized display name outside `src/config/brand.ts` (and allowlisted docs), and never include `dots` references.

Run `npm run check:gates && npm run check:brand && npm test -- --watchAll=false` before every commit.
