# Agent Rules & 5-Platform Architecture Constitution (`AGENTS.md` / `CLAUDE.md`)

This is Yifeng's personal life-management app (`星途`). The product display name lives only in `src/config/brand.ts`. These rules apply to every coding agent (`Claude Code`, `Codex`, `Gemini`, `Cursor`) working in this repository.

---

## 1. Unified 5-Platform Architecture & Frontend Stack (Mandatory Invariants)

1. **Pure React 19 + TypeScript + Vite 8 + Tailwind CSS v4 Engine**:
   - This repository uses **Vite 8 (`vite.config.ts`) + React 19 + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`)**.
   - **NEVER re-introduce `react-native-web` runtime**: All `@/ui/*` and `react-native` primitives resolve to our zero-overhead native DOM engine (`src/lib/web-shims/react-native-dom.tsx`) and native desktop primitives (`src/ui/dom.tsx`).
   - **Test Against the Real Production Shim (`[G-SHIM-1]`)**: Never mock `react-native` to `react-native-web` in DOM/entry tests (`src/ui/dom.test.ts`). Mocking to `react-native-web` hides missing methods in `src/lib/web-shims/react-native-dom.tsx` (such as `Animated.Value.prototype.interpolate`, `Easing.quad`, `StyleSheet.absoluteFillObject`, or `AsyncStorage.getAllKeys/multiRemove`), which causes top-level module evaluation crashes (`white screen`) before `createRoot(#root)` can run.
2. **Dual-Theme Design System (`DESIGN.md`)**:
   - Default theme is **Warm Paper (`#FAF9F5` canvas + sidebar unified, `#FFFFFF` cards, `#F5F4ED` secondary surface, `#D97757` terracotta accent)**.
   - Optional dark theme is **Obsidian Gold (`#121318` canvas, `#1A1C23` cards, `#F5B942` molten gold)**.
   - Never hardcode mismatched sidebar backgrounds (like `#F2EFE9`); always use `color.paper` / `color.card` / `color.surface` from `src/ui/theme.ts`.
3. **Zero Demo / Mock Seed Data in Runtime Stores (`[G-DATA-1]`)**:
   - Runtime persisted stores (`public/pwa-head.js`, `scripts/build-macos-app.mjs`, `src/data/bookkeeping.ts`, `src/data/life-gamification.ts`, `src/data/life-milestones-okr.ts`, `src/data/time-block-tracker.ts`, `src/data/time-pricing.ts`) must **NEVER** pre-populate fake user records (`w-seed-*`, `t-seed-*`, `s-seed-*`, `j-seed-*`, `tx-seed-*`, `chat-seed-*`, `init-meal-*`).
   - Users must always experience a clean, zero-mock personal workspace on first launch, while pure unit test fixtures remain isolated inside `src/core/*` for Jest tests.
4. **Bundle Budget & Render Loop Discipline (`[G-PERF-1]`)**:
   - **No inline base64 images > 10 KB in `src/`**: Keep static illustrations (`public/islands/*.png`, `public/icons/*.png`) in `public/` so `dist/assets/index.js` stays compact and parses in `<50ms` on startup.
   - **No unconditional `setInterval(..., 1000)` full-tree polling**: Only tick a 1-second timer while an active focus countdown is running (`activeTimer !== null`), and use `subscribeTimeBlockStore` + `useMemo` for 182-day heatmaps.

---

## 2. 5-Platform Native & Web Packaging Rules (8 Non-Negotiable Release Gates)

Every package build (`npm run build:packages` / `node scripts/build-release-packages.mjs`) and test run (`npm test`) enforces these 8 cross-platform packaging rules via `scripts/check-release-gates.mjs`:

1. **[G-SHIM-1] Web Shim Completeness & Root Mount Gate**:
   - `src/lib/web-shims/react-native-dom.tsx` must implement `Animated.Value.prototype.interpolate`, `unwrapAnimatedValue`, `Easing.quad/cubic/in/out/inOut`, and `StyleSheet.absoluteFillObject`.
   - `src/ui/dom.test.ts` must mount `<BootScreen />` and `<ViteRootApp />` directly against `react-native-dom.tsx` so any missing shim API fails CI before deployment.
2. **[G-WEB-2] Tracked `manifest.webmanifest` & Non-Greedy `vercel.json` SPA Rewrite**:
   - `public/manifest.webmanifest` must be tracked in git (never ignored in `.gitignore`) and emitted into `dist/manifest.webmanifest` by `scripts/stamp-pwa-html.js`.
   - `vercel.json` `rewrites` must NEVER use a catch-all `"/(.*)"` that rewrites missing/static files to `/index.html` (which causes `/manifest.webmanifest` or `/sw.js` to return HTML with a JSON/JS MIME type). Always exclude static paths (`manifest.webmanifest`, `sw.js`, `pwa-head.js`, `version.json`, `favicon.*`, `icons/`, `islands/`, `assets/`, `fonts/`, `.well-known/`).
   - `index.html` must not duplicate `<script src="/pwa-head.js"></script>` (injected and deduplicated by `scripts/stamp-pwa-html.js`).
3. **[G-IOS-1] iOS `.mobileconfig` `PayloadVersion` MUST strictly be `1`**:
   - In Apple's `MCProfile` specification, `<key>PayloadVersion</key>` (both in the outer `Configuration` dict and inner `com.apple.webClip.managed` dict) is the **Apple schema format version** and **MUST ALWAYS be `<integer>1</integer>`**.
   - Setting `PayloadVersion` to `2` or `3` causes iOS `profiled` to reject the profile with *"不支持此描述文件" (Profile Failed to Install)*. Note that `plutil -lint` on macOS only checks XML syntax and will NOT catch this! When bumping revisions, only increment `PayloadIdentifier` (e.g. `com.viastela.studio.webclip.v7`).
4. **[G-IOS-2] iOS `.mobileconfig` MUST use `FullScreen=true` + Valid `https://` URL + 180×180 Icon**:
   - **NEVER use `data:text/html;base64,...` in `<key>URL</key>`**: iOS WebClip requires an `https://` or `http://` URL (default `https://viastela.vercel.app/?shell=native`). Using `data:text/html` breaks `FullScreen` mode and causes iOS browsers to parse `text` as a hostname (`ERR_NAME_NOT_RESOLVED`).
   - Always embed `public/icons/apple-touch-icon.png` (180×180, keeping `.mobileconfig` `< 250 KB`), never a 1MB+ 512px/1024px PNG.
5. **[G-ANDROID-1] Android `.apk` Overwrite-Install Cache Busting (`classes.dex` Patch)**:
   - The native Android WebView shell extracts `assets/webbundle.bin` into `getFilesDir()/<cacheDir>/` and skips extraction if `<cacheDir>/index.html` already exists.
   - `scripts/build-android-apk.mjs` MUST call `patchAndroidClassesDexCacheDir(classesDexPath, 'www-v8')` (updating the 6-byte directory name and recalculating Dalvik SHA-1 + Adler32 checksums) so installing a new APK over an existing install always extracts the latest web bundle.
6. **[G-ANDROID-2] Android 7–15 4-Byte `zipalign` + APK Signature Scheme v1 & v2**:
   - Uncompressed entries (`resources.arsc`, `assets/webbundle.bin`, `.png`) must be 4-byte aligned, and the APK must carry both `META-INF/*.RSA` (v1) and `APK Sig Block 42` (`0x7109871a`, v2).
7. **[G-WEBVIEW-1] Custom-Scheme CORS & `/index.html` Route Normalization**:
   - `scripts/stamp-pwa-html.js` MUST strip `crossorigin` attributes from `dist/index.html` so custom URL schemes (`viastela-local://` on iOS `.ipa`, `app://` on macOS `.app`) never block ES module scripts.
   - `public/pwa-head.js` and `src/lib/web-shims/expo-router.tsx` MUST normalize `/index.html` to `/` on HTTP(S) origins before routing so mobile WebViews never render an unmatched route white screen.
8. **[G-BRAND-1] Brand Guard (`npm run check:brand`)**:
   - The capitalized display name lives only in `src/config/brand.ts`, `public/manifest.webmanifest`, `DECISIONS.md`, `DESIGN.md`, `docs/email-otp-hosted.md`, and `supabase/config.toml`. Never hardcode it in other source/script/doc files, and never introduce `dots` traces into this repository.

---

## 3. Ownership & Product Boundaries

| Path | Owner | Responsibility |
| --- | --- | --- |
| `app/` | shell | Route entry screens |
| `src/features/*` | feature | Domain screens (`today`, `trend`, `me`, `record`, `auth`, `weight`, `shell`) |
| `src/core/` | core | Pure TypeScript domain logic & unit tests (zero React/DOM/Supabase imports) |
| `src/data/` | data | Persisted stores, local-first DB engine, and Supabase client calls |
| `src/ui/` | ui | Shared UI components, theme tokens (`theme.ts`), and native DOM primitives (`dom.tsx`) |
| `src/lib/web-shims/` | platform | Pure React 19 native DOM engine & router shims |
| `src/config/`, `scripts/` | platform | Brand config, 5-platform native bundlers, and automated release gates |

## 4. Pre-Push & Packaging Verification Commands

Before committing or pushing any change:
```bash
export PATH="/Users/guoyifeng1/Desktop/Gemini-Projects/.toolchain/node24/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
npm run typecheck && npm run lint && npm run check:brand && npm run check:gates && npm test -- --watchAll=false
```
When rebuilding the 5-platform packages (`.app`, `.pkg`, `.zip`, `.mobileconfig`, `.ipa`, `.apk`):
```bash
node scripts/build-release-packages.mjs
```
