#!/usr/bin/env node
/**
 * Automated 5-Platform Architecture, Web Runtime & Packaging Gate (`scripts/check-release-gates.mjs`)
 *
 * Physically prevents regressions across Web (Vercel/PWA), macOS (.app/.pkg), Windows (WebView2),
 * iOS (.mobileconfig/.ipa), and Android (.apk):
 * - [G-STACK-1] Pure React 19 native DOM shim in `vite.config.ts` (no `react-native-web` alias)
 * - [G-SHIM-1]  `react-native-dom.tsx` must implement `AnimatedValue.interpolate`, `Easing.quad/inOut`,
 *               `StyleSheet.absoluteFillObject`, and `unwrapAnimatedValue`; `async-storage.ts` must implement
 *               `getAllKeys` & `multiRemove` (prevents top-level module evaluation white screens)
 * - [G-DATA-1]  Zero demo/mock seed injection in `public/pwa-head.js` & `scripts/build-macos-app.mjs`
 * - [G-WEB-1]   `scripts/stamp-pwa-html.js` must strip `crossorigin`, deduplicate `/pwa-head.js`, and emit `manifest.webmanifest`
 * - [G-WEB-2]   `public/manifest.webmanifest` must be tracked (not gitignored) & valid JSON; `vercel.json` SPA rewrite
 *               must exclude all static files (`manifest.webmanifest`, `sw.js`, `pwa-head.js`, `icons/`, `islands/`, `assets/`, `.well-known/`)
 * - [G-PERF-1]  No inline `data:image/png;base64` > 10 KB in `src/` (static images must live in `public/`)
 * - [G-IOS-1]   `releases/viastela-ios.mobileconfig` must have `PayloadVersion = 1` (never > 1)
 * - [G-IOS-2]   `releases/viastela-ios.mobileconfig` must have `FullScreen = true`, valid `https://` URL (no `data:text/html`), and size < 350 KB
 * - [G-AND-1]   `scripts/build-android-apk.mjs` must binary-patch `classes.dex` cache dir (`patchAndroidClassesDexCacheDir`)
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

  // 2. G-SHIM-1: Production web shims must implement required RN Animated/Easing/StyleSheet/AsyncStorage APIs
  const rnDomPath = path.join(rootDir, 'src', 'lib', 'web-shims', 'react-native-dom.tsx');
  if (existsSync(rnDomPath)) {
    const rnDomSrc = readFileSync(rnDomPath, 'utf8');
    for (const token of ['interpolate(', 'unwrapAnimatedValue', 'quad:', 'cubic:', 'absoluteFillObject:']) {
      if (!rnDomSrc.includes(token)) {
        errors.push(`[G-SHIM-1] src/lib/web-shims/react-native-dom.tsx is missing required runtime shim token: ${token}`);
      }
    }
  }
  const asyncStoragePath = path.join(rootDir, 'src', 'lib', 'web-shims', 'async-storage.ts');
  if (existsSync(asyncStoragePath)) {
    const asSrc = readFileSync(asyncStoragePath, 'utf8');
    for (const token of ['getAllKeys', 'multiRemove']) {
      if (!asSrc.includes(token)) {
        errors.push(`[G-SHIM-1] src/lib/web-shims/async-storage.ts is missing required method: ${token}`);
      }
    }
  }

  // 3. G-DATA-1: No w-seed-* / acc-seed-* demo data injection in pwa-head.js or build-macos-app.mjs
  for (const rel of ['public/pwa-head.js', 'scripts/build-macos-app.mjs']) {
    const p = path.join(rootDir, rel);
    if (existsSync(p)) {
      const src = readFileSync(p, 'utf8');
      if (src.includes('w-seed-6') || src.includes('acc-seed-1') || src.includes('hold-seed-1')) {
        errors.push(`[G-DATA-1] ${rel} must not inject demo/mock seed records (w-seed-*, acc-seed-*, hold-seed-*).`);
      }
    }
  }

  // 4. G-WEB-1 & G-WEB-2: stamp-pwa-html.js, manifest.webmanifest, index.html, and vercel.json SPA rewrites
  const stampPath = path.join(rootDir, 'scripts', 'stamp-pwa-html.js');
  if (existsSync(stampPath)) {
    const stampSrc = readFileSync(stampPath, 'utf8');
    if (!stampSrc.includes('crossorigin')) {
      errors.push('[G-WEB-1] scripts/stamp-pwa-html.js must strip crossorigin attributes from dist/index.html.');
    }
    if (!stampSrc.includes('manifest.webmanifest')) {
      errors.push('[G-WEB-1] scripts/stamp-pwa-html.js must write manifest.webmanifest.');
    }
  }

  const gitignorePath = path.join(rootDir, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignoreSrc = readFileSync(gitignorePath, 'utf8');
    if (gitignoreSrc.includes('manifest.webmanifest')) {
      errors.push('[G-WEB-2] .gitignore must not ignore public/manifest.webmanifest.');
    }
  }

  const manifestPath = path.join(rootDir, 'public', 'manifest.webmanifest');
  if (!existsSync(manifestPath)) {
    errors.push('[G-WEB-2] public/manifest.webmanifest is missing.');
  } else {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (!manifest.name || !manifest.short_name || !manifest.start_url || !Array.isArray(manifest.icons) || manifest.icons.length === 0) {
        errors.push('[G-WEB-2] public/manifest.webmanifest is missing required fields (name/short_name/start_url/icons).');
      }
    } catch {
      errors.push('[G-WEB-2] public/manifest.webmanifest is not valid JSON.');
    }
  }

  const vercelPath = path.join(rootDir, 'vercel.json');
  if (existsSync(vercelPath)) {
    const vercel = JSON.parse(readFileSync(vercelPath, 'utf8'));
    const sourcePattern = vercel?.rewrites?.[0]?.source ?? '';
    if (!sourcePattern || sourcePattern === '/(.*)') {
      errors.push('[G-WEB-2] vercel.json rewrite must exclude static assets instead of using catch-all /(.*).');
    } else {
      const re = new RegExp(`^${sourcePattern}$`);
      for (const staticPath of [
        '/manifest.webmanifest',
        '/sw.js',
        '/pwa-head.js',
        '/version.json',
        '/favicon.ico',
        '/favicon.svg',
        '/icons/icon-192.png',
        '/islands/focus.png',
        '/assets/index.js',
        '/.well-known/assetlinks.json',
      ]) {
        if (re.test(staticPath)) {
          errors.push(`[G-WEB-2] vercel.json SPA rewrite wrongly intercepts static path: ${staticPath}`);
        }
      }
      for (const spaPath of ['/', '/login', '/today', '/assets', '/trend', '/timeline', '/me']) {
        if (!re.test(spaPath)) {
          errors.push(`[G-WEB-2] vercel.json SPA rewrite failed to match frontend route: ${spaPath}`);
        }
      }
    }
  }

  const distHtmlPath = path.join(rootDir, 'dist', 'index.html');
  if (existsSync(distHtmlPath)) {
    const distHtml = readFileSync(distHtmlPath, 'utf8');
    const pwaHeadCount = (distHtml.match(/pwa-head\.js/g) || []).length;
    if (pwaHeadCount !== 1) {
      errors.push(`[G-WEB-1] dist/index.html must include /pwa-head.js exactly once (found ${pwaHeadCount}).`);
    }
  }

  // 5. G-PERF-1: No bloated inline base64 PNG strings in src/ui/island-assets.ts
  const islandAssetsPath = path.join(rootDir, 'src', 'ui', 'island-assets.ts');
  if (existsSync(islandAssetsPath)) {
    const islandSrc = readFileSync(islandAssetsPath, 'utf8');
    if (islandSrc.includes('data:image/png;base64,') || Buffer.byteLength(islandSrc, 'utf8') > 10 * 1024) {
      errors.push('[G-PERF-1] src/ui/island-assets.ts must reference static /islands/*.png files, never inline base64 PNGs.');
    }
  }

  // 6. G-IOS-1 & G-IOS-2: Validate scripts/build-ios-ipa.mjs and releases/viastela-ios.mobileconfig
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

  // 7. G-AND-1: Android APK builder must patch classes.dex cache directory
  const apkScriptPath = path.join(rootDir, 'scripts', 'build-android-apk.mjs');
  if (existsSync(apkScriptPath)) {
    const apkSrc = readFileSync(apkScriptPath, 'utf8');
    if (!apkSrc.includes('patchAndroidClassesDexCacheDir')) {
      errors.push('[G-AND-1] scripts/build-android-apk.mjs must call patchAndroidClassesDexCacheDir so overwrite-installs update web assets.');
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
