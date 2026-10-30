#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';

import { createRequire } from 'node:module';

import { registerTypeScript } from './register-typescript.mjs';

registerTypeScript();
const require = createRequire(import.meta.url);
const preflight = require('../src/core/android-apk-preflight.ts');

const jsonPath = process.argv[2] ?? 'eas-build.json';
const outDir = process.argv[3] ?? 'android-apk';
const apkName = 'viastela-preview.apk';

const payload = preflight.parseJsonStdout(await readFile(jsonPath, 'utf8'));
const artifact = preflight.readEasApkArtifact(payload);
if (!artifact) {
  console.error(preflight.easBuildFailure(payload));
  process.exit(1);
}

const response = await fetch(artifact.archiveUrl);
if (!response.ok) {
  console.error(`APK download failed (${response.status})`);
  process.exit(1);
}
const bytes = Buffer.from(await response.arrayBuffer());
await mkdir(outDir, { recursive: true });
const apkPath = path.join(outDir, apkName);
await writeFile(apkPath, bytes);
const sha256 = createHash('sha256').update(bytes).digest('hex');
await writeFile(path.join(outDir, 'sha256.txt'), `${sha256}  ${apkName}\n`);

const owner = (process.env.EXPO_OWNER ?? '').trim();
const page = owner
  ? `https://expo.dev/accounts/${encodeURIComponent(owner)}/projects/viastela/builds/${artifact.id}`
  : '';
const lines = [
  '## Android preview APK',
  '',
  `- Build: \`${artifact.id}\``,
  `- versionName: \`${artifact.appVersion ?? 'see the build page'}\``,
  `- versionCode: \`${artifact.appBuildVersion ?? 'see the build page'}\``,
  `- sha256: \`${sha256}\``,
];
if (page) lines.push(`- Build page: ${page}`);
lines.push('', 'Update `public/version.json` with this versionCode, versionName, sha256, and a stable https download URL, then deploy the site.');
const summary = `${lines.join('\n')}\n`;
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
