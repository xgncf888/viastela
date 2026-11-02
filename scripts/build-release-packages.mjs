#!/usr/bin/env node
/**
 * Builds all local distributable packages and syncs `<displayName>.app` using the
 * unified Charioteer workspace convention:
 * - Workspace Root App: `/Users/guoyifeng1/Desktop/Gemini-Projects/<displayName>.app` (alongside `Charioteer.app`)
 * - Repo Root App:      `./<displayName>.app` (alongside `./charioteer/Charioteer.app`)
 * - Charioteer Plugin:  `~/.charioteer/plugins/viastela/` (auto-registered on build)
 * - Release Archives:   `./releases/` & `../Releases/<displayName>/` (`.pkg`, `.dmg`, `.zip`, `.apk`, `.ipa`, `.mobileconfig`, `SHA256SUMS.txt`)
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE_PARENT = path.resolve(ROOT, '..');
const RELEASES_DIR = path.join(ROOT, 'releases');
const DIST_DIR = path.join(ROOT, 'dist');
const MACOS_BUILD_DIR = path.join(ROOT, 'web-build', 'macos');

function readDisplayName() {
  const brandSrc = readFileSync(path.join(ROOT, 'src', 'config', 'brand.ts'), 'utf8');
  const match = brandSrc.match(/displayName:\s*'([^']+)'/);
  return match ? match[1] : 'App';
}

function sha256File(filePath) {
  const hash = createHash('sha256');
  hash.update(readFileSync(filePath));
  return hash.digest('hex');
}

function main() {
  const displayName = readDisplayName();
  mkdirSync(RELEASES_DIR, { recursive: true });

  const env = {
    ...process.env,
    EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321',
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0',
  };

  console.log('1/5 Exporting Web & PWA static bundle...');
  execFileSync('npm', ['run', 'export:web'], { cwd: ROOT, env, stdio: 'inherit' });

  console.log('2/5 Packaging Web PWA & Charioteer Plugin archives...');
  const webZip = path.join(RELEASES_DIR, 'viastela-web-pwa.zip');
  rmSync(webZip, { force: true });
  execFileSync('ditto', ['-c', '-k', DIST_DIR, webZip], { stdio: 'inherit' });

  const pluginStage = path.join(os.tmpdir(), `viastela-plugin-${Date.now()}`);
  mkdirSync(path.join(pluginStage, 'public'), { recursive: true });
  cpSync(DIST_DIR, path.join(pluginStage, 'public'), { recursive: true });
  cpSync(path.join(ROOT, 'public', 'charioteer-plugin.json'), path.join(pluginStage, 'charioteer-plugin.json'));
  const pluginZip = path.join(RELEASES_DIR, 'viastela-charioteer-plugin.zip');
  rmSync(pluginZip, { force: true });
  execFileSync('ditto', ['-c', '-k', pluginStage, pluginZip], { stdio: 'inherit' });

  try {
    const charioteerHome = process.env.CHARIOTEER_HOME || path.join(os.homedir(), '.charioteer');
    const livePluginDir = path.join(charioteerHome, 'plugins', 'viastela');
    mkdirSync(livePluginDir, { recursive: true });
    cpSync(pluginStage, livePluginDir, { recursive: true });
  } catch {
    // Ignore if home dir is restricted in CI
  }
  rmSync(pluginStage, { recursive: true, force: true });

  if (process.platform === 'darwin') {
    console.log('3/5 Building macOS native desktop bundle & .pkg installer...');
    execFileSync('node', [path.join(ROOT, 'scripts', 'build-macos-app.mjs')], {
      cwd: ROOT,
      env,
      stdio: 'inherit',
    });
    const macZipSrc = path.join(MACOS_BUILD_DIR, 'viastela-macos.zip');
    if (existsSync(macZipSrc)) {
      cpSync(macZipSrc, path.join(RELEASES_DIR, 'viastela-macos.zip'));
    }
    const macDmgSrc = path.join(MACOS_BUILD_DIR, 'viastela-macos.dmg');
    if (existsSync(macDmgSrc)) {
      cpSync(macDmgSrc, path.join(RELEASES_DIR, 'viastela-macos.dmg'));
    }
    const appBundleName = `${displayName}.app`;
    const macAppSrc = path.join(MACOS_BUILD_DIR, appBundleName);
    if (existsSync(macAppSrc)) {
      rmSync(path.join(RELEASES_DIR, appBundleName), { recursive: true, force: true });
      const repoRootApp = path.join(ROOT, appBundleName);

      const macPkgOut = path.join(RELEASES_DIR, 'viastela-macos.pkg');
      rmSync(macPkgOut, { force: true });
      execFileSync(
        'pkgbuild',
        [
          '--component',
          repoRootApp,
          '--install-location',
          '/Applications',
          '--identifier',
          'app.viastela.desktop',
          '--version',
          '1.0.0',
          macPkgOut,
        ],
        { stdio: 'inherit' },
      );
    }
  }

  console.log('4/5 Building mobile packages (iOS .mobileconfig/.ipa & Android .apk)...');
  execFileSync('node', [path.join(ROOT, 'scripts', 'build-ios-ipa.mjs')], { cwd: ROOT, env, stdio: 'inherit' });
  execFileSync('node', [path.join(ROOT, 'scripts', 'build-android-apk.mjs')], { cwd: ROOT, env, stdio: 'inherit' });

  console.log('5/5 Writing SHA256SUMS.txt & syncing Releases/ directory...');
  const packageExts = ['.pkg', '.dmg', '.apk', '.ipa', '.mobileconfig', '.zip'];
  const files = readdirSync(RELEASES_DIR)
    .filter((name) => packageExts.some((ext) => name.endsWith(ext)))
    .sort();
  const lines = files.map((name) => {
    const full = path.join(RELEASES_DIR, name);
    const sizeKb = Math.round(statSync(full).size / 1024);
    return `${sha256File(full)}  ${name}  (${sizeKb} KB)`;
  });
  writeFileSync(path.join(RELEASES_DIR, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'utf8');

  const outerReleaseDir = path.join(WORKSPACE_PARENT, 'Releases', displayName);
  try {
    mkdirSync(outerReleaseDir, { recursive: true });
    for (const name of [...files, 'SHA256SUMS.txt']) {
      cpSync(path.join(RELEASES_DIR, name), path.join(outerReleaseDir, name));
    }
  } catch {
    // Ignore if outer directory is not writable in CI
  }

  console.log(`\nUnified Desktop App Bundles ready:`);
  console.log(`  - ${path.join(WORKSPACE_PARENT, `${displayName}.app`)} (Workspace Root — alongside Charioteer.app)`);
  console.log(`  - ${path.join(ROOT, `${displayName}.app`)} (Repo Root)`);
  console.log(`\nAll release archives ready in ${RELEASES_DIR} & ${outerReleaseDir}:`);
  for (const line of lines) {
    console.log(`  - ${line}`);
  }
}

main();
