#!/usr/bin/env node
/**
 * Automated 5-Platform Architecture & Packaging Gate (`scripts/check-platform-gates.mjs`)
 *
 * Physically prevents regressions on the 6 cross-platform pitfalls:
 * - [G-STACK-1] Pure React 19 native DOM shim in `vite.config.ts` (no `react-native-web` alias)
 * - [G-DATA-1]  Zero demo/mock seed injection in `public/pwa-head.js` & `scripts/build-macos-app.mjs`
 * - [G-IOS-1]   `releases/viastela-ios.mobileconfig` must have `PayloadVersion = 1` (never > 1)
 * - [G-IOS-2]   `releases/viastela-ios.mobileconfig` must have `FullScreen = true`, valid `https://` URL (no `data:text/html`), and size < 350 KB
 * - [G-AND-1]   `scripts/build-android-apk.mjs` must binary-patch `classes.dex` cache dir (`patchAndroidClassesDexCacheDir`)
 * - [G-WEB-1]   `scripts/stamp-pwa-html.js` must strip `crossorigin` attributes for custom-scheme WebViews
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function runPlatformGates(rootDir = ROOT) {
  const errors = [];

  // 1. G-STACK-1: Vite config must use react-native-dom.tsx, never react-native-web
  const viteConfigPath = path.join(rootDir, 'vite.config.ts');
  if (existsSync(viteConfigPath)) {
    const viteSrc = readFileSync(viteConfigPath, 'utf8');
    if (viteSrc.includes("'react-native': 'react-native-web'") || viteSrc.includes('"react-native": "react-native-web"')) {
      errors.push('[G-STACK-1] vite.config.ts must resolve react-native to react-native-dom.tsx, never react-native-web.');
    }
  }

  // 2. G-DATA-1: No w-seed-* / acc-seed-* demo data injection in pwa-head.js or build-macos-app.mjs
  for (const rel of ['public/pwa-head.js', 'scripts/build-macos-app.mjs']) {
    const p = path.join(rootDir, rel);
    if (existsSync(p)) {
      const src = readFileSync(p, 'utf8');
      if (src.includes('w-seed-6') || src.includes('acc-seed-1') || src.includes('hold-seed-1')) {
        errors.push(`[G-DATA-1] ${rel} must not inject demo/mock seed records (w-seed-*, acc-seed-*, hold-seed-*).`);
      }
    }
  }

  // 3. G-IOS-1 & G-IOS-2: Validate scripts/build-ios-ipa.mjs and releases/viastela-ios.mobileconfig
  const iosScriptPath = path.join(rootDir, 'scripts', 'build-ios-ipa.mjs');
  if (existsSync(iosScriptPath)) {
    const iosSrc = readFileSync(iosScriptPath, 'utf8');
    if (/<key>PayloadVersion<\/key>\s*<integer>[2-9]\d*<\/integer>/.test(iosSrc)) {
      errors.push('[G-IOS-1] scripts/build-ios-ipa.mjs must never set PayloadVersion > 1 in .mobileconfig.');
    }
  }

  const mcPath = path.join(rootDir, 'releases', 'viastela-ios.mobileconfig');
  if (existsSync(mcPath)) {
    const mcText = readFileSync(mcPath, 'utf8');
    const sizeKb = Math.round(statSync(mcPath).size / 1024);
    if (mcText.includes('data:text/html')) {
      errors.push('[G-IOS-2] releases/viastela-ios.mobileconfig must never use data:text/html in URL.');
    }
    if (!mcText.includes('<key>FullScreen</key>\n      <true/>')) {
      errors.push('[G-IOS-2] releases/viastela-ios.mobileconfig must set <key>FullScreen</key><true/>.');
    }
    const payloadVersionMatches = [...mcText.matchAll(/<key>PayloadVersion<\/key>\s*<integer>(\d+)<\/integer>/g)];
    if (payloadVersionMatches.length < 2 || payloadVersionMatches.some((m) => m[1] !== '1')) {
      errors.push('[G-IOS-1] releases/viastela-ios.mobileconfig must set <key>PayloadVersion</key><integer>1</integer> in both inner and outer dicts.');
    }
    if (sizeKb > 350) {
      errors.push(`[G-IOS-2] releases/viastela-ios.mobileconfig is too large (${sizeKb} KB > 350 KB); use 180x180 apple-touch-icon.png.`);
    }
  }

  // 4. G-AND-1: Android APK builder must patch classes.dex cache directory
  const apkScriptPath = path.join(rootDir, 'scripts', 'build-android-apk.mjs');
  if (existsSync(apkScriptPath)) {
    const apkSrc = readFileSync(apkScriptPath, 'utf8');
    if (!apkSrc.includes('patchAndroidClassesDexCacheDir')) {
      errors.push('[G-AND-1] scripts/build-android-apk.mjs must call patchAndroidClassesDexCacheDir so overwrite-installs update web assets.');
    }
  }

  // 5. G-WEB-1: stamp-pwa-html.js must strip crossorigin attributes
  const stampPath = path.join(rootDir, 'scripts', 'stamp-pwa-html.js');
  if (existsSync(stampPath)) {
    const stampSrc = readFileSync(stampPath, 'utf8');
    if (!stampSrc.includes('crossorigin')) {
      errors.push('[G-WEB-1] scripts/stamp-pwa-html.js must strip crossorigin attributes from dist/index.html.');
    }
  }

  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errs = runPlatformGates();
  if (errs.length > 0) {
    console.error('❌ Platform Release Gates Failed:');
    for (const e of errs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('✓ All 5-platform architecture & packaging gates passed.');
}
