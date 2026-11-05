import { describe, expect, it } from '@jest/globals';

declare const require: (id: string) => {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
  statSync: (path: string) => { size: number };
};
declare const __dirname: string;

const { existsSync, readFileSync, statSync } = require('node:fs');
const rootDir = `${__dirname}/../..`;

describe('5-platform architecture & packaging release gates', () => {
  it('enforces pure React 19 native DOM shim without react-native-web alias in vite.config.ts', () => {
    const viteSrc = readFileSync(`${rootDir}/vite.config.ts`, 'utf8');
    expect(viteSrc).toContain('react-native-dom.tsx');
    expect(viteSrc).not.toContain("'react-native': 'react-native-web'");
  });

  it('enforces complete Animated/Easing/StyleSheet/AsyncStorage web shims to prevent module-init white screens', () => {
    const rnDomSrc = readFileSync(`${rootDir}/src/lib/web-shims/react-native-dom.tsx`, 'utf8');
    expect(rnDomSrc).toContain('interpolate(');
    expect(rnDomSrc).toContain('unwrapAnimatedValue');
    expect(rnDomSrc).toContain('quad:');
    expect(rnDomSrc).toContain('cubic:');
    expect(rnDomSrc).toContain('absoluteFillObject:');

    const asyncStorageSrc = readFileSync(`${rootDir}/src/lib/web-shims/async-storage.ts`, 'utf8');
    expect(asyncStorageSrc).toContain('getAllKeys');
    expect(asyncStorageSrc).toContain('multiRemove');
  });

  it('enforces zero demo/mock seed data in pwa-head.js and build-macos-app.mjs', () => {
    for (const rel of ['public/pwa-head.js', 'scripts/build-macos-app.mjs']) {
      const src = readFileSync(`${rootDir}/${rel}`, 'utf8');
      expect(src).not.toContain('w-seed-6');
      expect(src).not.toContain('acc-seed-1');
      expect(src).not.toContain('hold-seed-1');
      expect(src).toContain('stripSeedRows');
    }
  });

  it('enforces tracked valid manifest.webmanifest, non-greedy vercel.json SPA rewrite, and externalized island PNGs', () => {
    const gitignore = readFileSync(`${rootDir}/.gitignore`, 'utf8');
    expect(gitignore).not.toContain('manifest.webmanifest');

    const manifestPath = `${rootDir}/public/manifest.webmanifest`;
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      icons?: unknown[];
    };
    expect(manifest.short_name).toBe('星途');
    expect(manifest.start_url).toBe('/');
    expect(Array.isArray(manifest.icons) && manifest.icons.length).toBeGreaterThanOrEqual(4);

    const vercel = JSON.parse(readFileSync(`${rootDir}/vercel.json`, 'utf8')) as {
      rewrites?: { source: string; destination: string }[];
    };
    const sourcePattern = vercel.rewrites?.[0]?.source ?? '';
    expect(sourcePattern).not.toBe('/(.*)');
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
      '/crayonbox/01-inventor-boy.webp',
      '/assets/index.js',
      '/.well-known/assetlinks.json',
    ]) {
      expect(re.test(staticPath)).toBe(false);
    }
    for (const spaPath of ['/', '/login', '/today', '/assets', '/trend', '/timeline', '/me']) {
      expect(re.test(spaPath)).toBe(true);
    }

    const islandSrc = readFileSync(`${rootDir}/src/ui/island-assets.ts`, 'utf8');
    expect(islandSrc).not.toContain('data:image/png;base64,');
  });

  it('enforces valid iOS .mobileconfig (PayloadVersion=1, FullScreen=true, HTTPS URL, compact icon)', () => {
    const mcPath = `${rootDir}/releases/viastela-ios.mobileconfig`;
    expect(existsSync(mcPath)).toBe(true);
    const mcText = readFileSync(mcPath, 'utf8');
    expect(mcText).not.toContain('data:text/html');
    expect(mcText).toContain('<key>FullScreen</key>\n      <true/>');
    const versions = [...mcText.matchAll(/<key>PayloadVersion<\/key>\s*<integer>(\d+)<\/integer>/g)].map(
      (m) => m[1],
    );
    expect(versions).toEqual(['1', '1']);
    expect(statSync(mcPath).size).toBeLessThan(350 * 1024);
  });

  it('enforces Android classes.dex cache directory patching and custom-scheme crossorigin stripping', () => {
    const apkSrc = readFileSync(`${rootDir}/scripts/build-android-apk.mjs`, 'utf8');
    expect(apkSrc).toContain('patchAndroidClassesDexCacheDir');

    const stampSrc = readFileSync(`${rootDir}/scripts/stamp-pwa-html.js`, 'utf8');
    expect(stampSrc).toContain('crossorigin');
  });
});
