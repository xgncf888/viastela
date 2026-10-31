#!/usr/bin/env node
/**
 * Builds all local distributable packages into `releases/`:
 * 1. `releases/<displayName>.app` & `releases/viastela-macos.zip` (macOS Native Desktop App)
 * 2. `releases/viastela-web-pwa.zip` (Standalone Web & Mobile PWA Bundle)
 * 3. `releases/viastela-charioteer-plugin.zip` (Charioteer Perspective Plugin Bundle)
 * 4. `releases/SHA256SUMS.txt` (SHA-256 Checksum Manifest)
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

  console.log('1/4 Exporting Web & PWA static bundle...');
  execFileSync('npm', ['run', 'export:web'], { cwd: ROOT, env, stdio: 'inherit' });

  console.log('2/4 Packaging Web PWA & Charioteer Plugin archives...');
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
  rmSync(pluginStage, { recursive: true, force: true });

  if (process.platform === 'darwin') {
    console.log('3/4 Building macOS native desktop bundle...');
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
      const releaseApp = path.join(RELEASES_DIR, appBundleName);
      rmSync(releaseApp, { recursive: true, force: true });
      execFileSync('ditto', [macAppSrc, releaseApp], { stdio: 'inherit' });
      try {
        execFileSync('codesign', ['--force', '--deep', '--sign', '-', releaseApp], { stdio: 'inherit' });
      } catch {
        // Ignore codesign warning if command-line tools are restricted
      }
    }
  }

  console.log('4/4 Writing SHA256SUMS.txt...');
  const files = readdirSync(RELEASES_DIR)
    .filter((name) => name.endsWith('.zip') || name.endsWith('.dmg') || name.endsWith('.apk') || name.endsWith('.ipa'))
    .sort();
  const lines = files.map((name) => {
    const full = path.join(RELEASES_DIR, name);
    const sizeKb = Math.round(statSync(full).size / 1024);
    return `${sha256File(full)}  ${name}  (${sizeKb} KB)`;
  });
  writeFileSync(path.join(RELEASES_DIR, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'utf8');

  console.log(`\nAll local release packages ready in ${RELEASES_DIR}:`);
  for (const line of lines) {
    console.log(`  - ${line}`);
  }
}

main();
