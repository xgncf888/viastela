#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerTypeScript } from './register-typescript.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
registerTypeScript();
const require = createRequire(import.meta.url);
const preflight = require('../src/core/android-apk-preflight.ts');

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), 'utf8'));
}

function expoConfig() {
  const cli = require.resolve('expo/bin/cli');
  const result = spawnSync(process.execPath, [cli, 'config', '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: process.env,
  });
  if (result.status !== 0) {
    const detail = `${result.stderr ?? ''}${result.stdout ?? ''}`.replace(/EXPO_TOKEN=\S+/g, 'EXPO_TOKEN=(redacted)');
    console.error(detail.trim() || 'expo config failed');
    process.exit(result.status ?? 1);
  }
  try {
    return preflight.parseJsonStdout(result.stdout ?? '');
  } catch {
    console.error('expo config did not print JSON');
    process.exit(1);
  }
}

const problems = [
  ...preflight.androidConfigProblems(expoConfig(), {
    owner: process.env.EXPO_OWNER ?? '',
    projectId: process.env.EAS_PROJECT_ID ?? '',
  }),
  ...preflight.assetLinksProblems(readJson('public/.well-known/assetlinks.json')),
  ...preflight.vercelHostingProblems(readJson('vercel.json')),
  ...preflight.supabasePublicEnvProblems({
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    anonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  }),
];
const updateUrl = preflight.updateUrlProblem(process.env.EXPO_PUBLIC_EAS_UPDATE_URL);
if (updateUrl) problems.push(updateUrl);

if (problems.length > 0) {
  for (const problem of problems) console.error(problem);
  process.exit(1);
}

console.log('android config ok');
