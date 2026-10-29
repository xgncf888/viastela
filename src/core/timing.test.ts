import { expect, test } from '@jest/globals';

import { LOAD_TIMEOUT_MS, LOADING_DELAY_MS, LOADING_MIN_VISIBLE_MS, PULSE_DURATION_MS, QUOTES_TIMEOUT_MS } from '@/lib/timing';

declare function require(name: string): {
  readFileSync: (path: string, encoding: string) => string;
  readdirSync: (path: string) => string[];
  statSync: (path: string) => { isDirectory: () => boolean };
  join: (...parts: string[]) => string;
};

const fs = require('node:fs');
const path = require('node:path');

const SKIP = new Set(['node_modules', 'dist', '.git', '.expo', 'coverage', 'android', 'ios', 'web-build']);

function filesContaining(root: string, needles: readonly string[]): string[] {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      if (SKIP.has(name)) continue;
      const fullPath = path.join(dir, name);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|md)$/.test(name)) continue;
      // DESIGN.md records the retired names in its rename note. Code must not.
      if (name === 'DESIGN.md') continue;
      const text = fs.readFileSync(fullPath, 'utf8');
      if (needles.some((needle) => text.includes(needle))) hits.push(fullPath);
    }
  };
  walk(root);
  return hits;
}

test('load budgets live in src/lib/timing and the 8 second budget is written once', () => {
  expect(LOADING_DELAY_MS).toBe(1000);
  expect(LOADING_MIN_VISIBLE_MS).toBe(400);
  expect(LOAD_TIMEOUT_MS).toBe(8000);
  expect(PULSE_DURATION_MS).toBe(1600);
  expect(QUOTES_TIMEOUT_MS).toBe(LOAD_TIMEOUT_MS);

  const source = fs.readFileSync(path.join(process.cwd(), 'src/lib/timing.ts'), 'utf8');
  expect(source.match(/8000/g)).toEqual(['8000']);
  const retired = ['REQUEST', 'TIMEOUT_MS'].join('_');
  const retiredDelay = ['SKELETON', 'DELAY_MS'].join('_');
  expect(filesContaining(process.cwd(), [retired, retiredDelay])).toEqual([]);
});
