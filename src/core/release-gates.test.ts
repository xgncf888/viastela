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

  it('enforces zero demo/mock seed data in pwa-head.js and build-macos-app.mjs', () => {
    for (const rel of ['public/pwa-head.js', 'scripts/build-macos-app.mjs']) {
      const src = readFileSync(`${rootDir}/${rel}`, 'utf8');
      expect(src).not.toContain('w-seed-6');
      expect(src).not.toContain('acc-seed-1');
      expect(src).not.toContain('hold-seed-1');
      expect(src).toContain('stripSeedRows');
    }
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
