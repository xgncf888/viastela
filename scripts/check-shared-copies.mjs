#!/usr/bin/env node
/**
 * Fail when an Edge Function copy under supabase/functions/_shared drifts
 * from the src module it was copied from.
 *
 * The mapping is the table below. It comes from the copy header comments and
 * from the modules quotes imports: database types from src/data, and the
 * accounting-day and delete-account origin helpers from src/core. A mapped
 * original or copy that is not on disk fails the check.
 *
 * Each copy keeps its own leading header comment (an Edge Function banner,
 * plus the original header when the copy repeats it). That leading run of
 * block comments is removed from the copy, and from the original when it has
 * one. The remaining bytes are compared exactly. Mismatches report the file
 * pair and unified-diff hunk line numbers only — never file text, env vars,
 * or secrets.
 */

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHARED_DIR = 'supabase/functions/_shared';

export const SHARED_COPIES = [
  {
    copy: 'supabase/functions/_shared/database.types.ts',
    original: 'src/data/database.types.ts',
  },
  {
    copy: 'supabase/functions/_shared/delete-account-origin.ts',
    original: 'src/core/delete-account-origin.ts',
  },
  {
    copy: 'supabase/functions/_shared/local-day.ts',
    original: 'src/core/local-day.ts',
  },
];

export function checkSharedCopies(root = ROOT, pairs = SHARED_COPIES) {
  const findings = [...unmappedFindings(root, pairs)];
  for (const pair of pairs) findings.push(...comparePair(root, pair));
  findings.sort(compareFindings);
  return { ok: findings.length === 0, findings };
}

export function formatFindings(findings) {
  const lines = [];
  for (const item of findings) {
    if (item.kind === 'missing-copy') {
      lines.push(`missing copy ${item.copy} (original ${item.original})`);
      continue;
    }
    if (item.kind === 'missing-original') {
      lines.push(`missing original ${item.original} (copy ${item.copy})`);
      continue;
    }
    if (item.kind === 'unmapped') {
      lines.push(`unmapped shared file ${item.file}`);
      continue;
    }
    lines.push(`${item.copy} drifted from ${item.original}`);
    for (const hunk of item.hunks) {
      lines.push(`@@ -${hunk.originalStart},${hunk.originalCount} +${hunk.copyStart},${hunk.copyCount} @@`);
    }
  }
  return lines;
}

/**
 * Drop the leading run of block comments. Copies may prepend a banner to the
 * original header; blank lines that only separate those comments are part of
 * the header. Bytes after the header, including later comments, are kept.
 */
export function stripLeadingHeader(text) {
  let index = 0;
  let stripped = false;
  while (index < text.length) {
    if (text.startsWith('/*', index)) {
      const end = text.indexOf('*/', index + 2);
      if (end === -1) break;
      index = end + 2;
      while (text[index] === ' ' || text[index] === '\t') index += 1;
      index = consumeNewline(text, index);
      stripped = true;
      continue;
    }
    if (stripped && isNewline(text, index)) {
      const next = consumeNewline(text, index);
      if (text.startsWith('/*', next)) {
        index = next;
        continue;
      }
    }
    break;
  }
  if (!stripped) return { body: text, offset: 0 };
  index = consumeNewline(text, index);
  return { body: text.slice(index), offset: index };
}

function comparePair(root, pair) {
  const copyText = readText(root, pair.copy);
  const originalText = readText(root, pair.original);
  if (copyText === null) return [{ kind: 'missing-copy', copy: pair.copy, original: pair.original }];
  if (originalText === null) return [{ kind: 'missing-original', copy: pair.copy, original: pair.original }];

  const copy = stripLeadingHeader(copyText);
  const original = stripLeadingHeader(originalText);
  if (copy.body === original.body) return [];

  const copyLineOffset = newlineCount(copyText, copy.offset);
  const originalLineOffset = newlineCount(originalText, original.offset);
  const hunks = lineDiffHunks(original.body, copy.body).map((hunk) => ({
    originalStart: hunk.originalStart + originalLineOffset,
    originalCount: hunk.originalCount,
    copyStart: hunk.copyStart + copyLineOffset,
    copyCount: hunk.copyCount,
  }));
  return [{ kind: 'mismatch', copy: pair.copy, original: pair.original, hunks }];
}

function unmappedFindings(root, pairs) {
  const dir = path.join(root, SHARED_DIR);
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw new Error(`could not read ${SHARED_DIR}`);
  }
  const mapped = new Set(pairs.map((pair) => pair.copy));
  const findings = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const file = `${SHARED_DIR}/${entry.name}`;
    if (mapped.has(file)) continue;
    findings.push({ kind: 'unmapped', file });
  }
  return findings;
}

function readText(root, relativePath) {
  try {
    return readFileSync(path.join(root, relativePath), 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw new Error(`could not read ${relativePath}`);
  }
}

function lineDiffHunks(originalBody, copyBody) {
  const original = originalBody.split('\n');
  const copy = copyBody.split('\n');
  const score = longestCommonSuffix(original, copy);
  const hunks = [];
  let originalIndex = 0;
  let copyIndex = 0;
  let current = null;

  const open = () => {
    if (current) return;
    current = {
      originalStart: originalIndex + 1,
      originalCount: 0,
      copyStart: copyIndex + 1,
      copyCount: 0,
    };
  };
  const close = () => {
    if (!current) return;
    hunks.push(current);
    current = null;
  };

  while (originalIndex < original.length && copyIndex < copy.length) {
    if (original[originalIndex] === copy[copyIndex]) {
      close();
      originalIndex += 1;
      copyIndex += 1;
      continue;
    }
    open();
    if (score[originalIndex + 1][copyIndex] >= score[originalIndex][copyIndex + 1]) {
      current.originalCount += 1;
      originalIndex += 1;
    } else {
      current.copyCount += 1;
      copyIndex += 1;
    }
  }
  while (originalIndex < original.length) {
    open();
    current.originalCount += 1;
    originalIndex += 1;
  }
  while (copyIndex < copy.length) {
    open();
    current.copyCount += 1;
    copyIndex += 1;
  }
  close();
  return hunks;
}

function longestCommonSuffix(original, copy) {
  const rows = original.length;
  const cols = copy.length;
  const score = Array.from({ length: rows + 1 }, () => new Uint32Array(cols + 1));
  for (let originalIndex = rows - 1; originalIndex >= 0; originalIndex -= 1) {
    for (let copyIndex = cols - 1; copyIndex >= 0; copyIndex -= 1) {
      score[originalIndex][copyIndex] =
        original[originalIndex] === copy[copyIndex]
          ? score[originalIndex + 1][copyIndex + 1] + 1
          : Math.max(score[originalIndex + 1][copyIndex], score[originalIndex][copyIndex + 1]);
    }
  }
  return score;
}

function newlineCount(text, end) {
  let count = 0;
  for (let index = 0; index < end && index < text.length; index += 1) {
    if (text[index] === '\n') count += 1;
  }
  return count;
}

function isNewline(text, index) {
  return text[index] === '\n' || text.startsWith('\r\n', index);
}

function consumeNewline(text, index) {
  if (text.startsWith('\r\n', index)) return index + 2;
  if (text[index] === '\n') return index + 1;
  return index;
}

function compareFindings(left, right) {
  return findingKey(left).localeCompare(findingKey(right));
}

function findingKey(item) {
  if (item.kind === 'unmapped') return `2\0${item.file}`;
  return `1\0${item.copy}\0${item.kind}`;
}

function report(result) {
  for (const item of result.findings) {
    const file = item.file ?? item.copy ?? item.original ?? '';
    const lineNo = item.hunks?.[0]?.copyStart;
    const loc = lineNo ? `,line=${lineNo}` : '';
    for (const line of formatFindings([item])) {
      if (!line.startsWith('@@')) console.error(`::error file=${file}${loc}::${line}`);
      console.error(line);
    }
  }
  console.log(`check-shared-copies: ${result.findings.length} findings`);
  return result.ok ? 0 : 1;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(report(checkSharedCopies()));
