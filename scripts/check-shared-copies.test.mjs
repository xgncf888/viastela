import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { checkSharedCopies, formatFindings } from './check-shared-copies.mjs';

const PAIR = [
  {
    copy: 'supabase/functions/_shared/local-day.ts',
    original: 'src/core/local-day.ts',
  },
];

function withTree(files, fn) {
  const root = mkdtempSync(path.join(tmpdir(), 'shared-copies-'));
  try {
    for (const [relativePath, text] of Object.entries(files)) {
      const absolute = path.join(root, relativePath);
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, text);
    }
    return fn(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('identical bodies pass when the leading header comments differ', () => {
  const result = withTree(
    {
      'src/core/local-day.ts': '/** original header */\nexport const value = 1;\n',
      'supabase/functions/_shared/local-day.ts': '/** Edge Function copy header */\nexport const value = 1;\n',
    },
    (root) => checkSharedCopies(root, PAIR),
  );
  assert.equal(result.ok, true);
  assert.deepEqual(result.findings, []);
});

test('a one-byte body difference fails', () => {
  const result = withTree(
    {
      'src/core/local-day.ts': '/** original header */\nexport const value = 1;\n',
      'supabase/functions/_shared/local-day.ts': '/** Edge Function copy header */\nexport const value = 2;\n',
    },
    (root) => checkSharedCopies(root, PAIR),
  );
  assert.equal(result.ok, false);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].kind, 'mismatch');
  const lines = formatFindings(result.findings);
  assert.deepEqual(lines, [
    'supabase/functions/_shared/local-day.ts drifted from src/core/local-day.ts',
    '@@ -2,1 +2,1 @@',
  ]);
  assert.equal(lines.some((line) => line.includes('export') || line.includes('value')), false);
});

test('a missing copy fails', () => {
  const result = withTree(
    { 'src/core/local-day.ts': 'export const value = 1;\n' },
    (root) => checkSharedCopies(root, PAIR),
  );
  assert.equal(result.ok, false);
  const lines = formatFindings(result.findings);
  assert.deepEqual(lines, [
    'missing copy supabase/functions/_shared/local-day.ts (original src/core/local-day.ts)',
  ]);
});

test('the shared copies match their src originals', () => {
  const result = checkSharedCopies();
  assert.deepEqual(formatFindings(result.findings), []);
});
