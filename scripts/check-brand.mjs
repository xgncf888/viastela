import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const source = readFileSync(new URL('../src/config/brand.ts', import.meta.url), 'utf8');
const match = source.match(/displayName:\s*'([^']+)'/);
if (!match) {
  console.error('src/config/brand.ts must set displayName to a string literal');
  process.exit(1);
}

const name = match[1];
const result = spawnSync(
  'git',
  ['grep', '-n', '-I', '-F', name, '--', '.', ':!src/config/brand.ts'],
  { encoding: 'utf8' },
);

if (result.status === 0) {
  console.error(`Display name ${name} must appear only in src/config/brand.ts`);
  console.error(result.stdout);
  process.exit(1);
}

if (result.status === 1 && !result.stdout) {
  process.exit(0);
}

console.error(result.stderr || 'brand check failed');
process.exit(result.status ?? 1);
