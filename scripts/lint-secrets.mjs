#!/usr/bin/env node
/**
 * Fail when the tracked tree contains a credential.
 * Environment-variable names are allowed. Values are not, except an empty
 * .env.example and a loopback URL in that example file.
 *
 * A service-role JWT is a three-part token whose payload role is the
 * privileged API role. Finnhub tokens are 20 or more alphanumeric characters
 * assigned next to that provider. A VAPID private key is the 43-character
 * base64url P-256 scalar. PEM blocks that say PRIVATE KEY are private keys.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const privilegedRole = ['service', 'role'].join('_');
const secretPrefix = ['sb', 'secret', ''].join('_');

const PRIVATE_KEY = /-----BEGIN [A-Z0-9 ]*PRIVATE KEY[A-Z0-9 ]*-----/;
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const SUPABASE_SECRET = new RegExp(`${secretPrefix}[A-Za-z0-9_-]{16,}`, 'g');
const FINNHUB_ASSIGN =
  /([A-Za-z0-9_.$-]*finnhub[A-Za-z0-9_.$-]*)\s*[:=]\s*(['"`]?)([^'"`\s;,)]+)\2/gi;
const FINNHUB_TOKEN_QUERY = /finnhub\.io[^\n]{0,120}?[?&]token=([A-Za-z0-9]{20,})/gi;
const VAPID_ASSIGN =
  /([A-Za-z0-9_.$-]*vapid[A-Za-z0-9_.$-]*)\s*[:=]\s*(['"`]?)([^'"`\s;,)]+)\2/gi;
const VAPID_PRIVATE_PROP = /private[_-]?key\s*[:=]\s*(['"`])([A-Za-z0-9_-]{43})\1/gi;

const BINARY_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.woff',
  '.woff2',
  '.ttf',
  '.otf',
  '.pdf',
  '.zip',
  '.gz',
  '.mp4',
  '.webm',
  '.wasm',
]);
const KEY_BASENAMES = new Set(['id_rsa', 'id_dsa', 'id_ecdsa', 'id_ed25519']);
const KEY_EXT = new Set(['.p8', '.p12', '.pfx', '.key']);

export function scanRepository(root = ROOT) {
  const files = trackedFiles(root).map((relativePath) => {
    const absolute = path.join(root, relativePath);
    let buffer;
    try {
      buffer = readFileSync(absolute);
    } catch (error) {
      return { path: relativePath, missing: true, error };
    }
    return { path: relativePath, buffer };
  });
  const findings = [];
  for (const file of files) {
    if (file.missing) {
      findings.push({
        rule: 'unreadable',
        file: file.path,
        line: 1,
        message: `could not read ${file.path}`,
      });
      continue;
    }
    findings.push(...findingsInFile(file.path, file.buffer));
  }
  return dedupe(findings);
}

export function findingsInText(relativePath, text) {
  return dedupe(findingsInFile(relativePath, Buffer.from(text)));
}

function findingsInFile(relativePath, buffer) {
  const findings = [];
  const envKind = classifyEnv(relativePath);
  if (envKind === 'forbidden') {
    findings.push({
      rule: 'env-file',
      file: relativePath,
      line: 1,
      message: `tracked env file ${relativePath} is not allowed; only .env.example with empty values`,
    });
  }
  if (isPrivateKeyFile(relativePath)) {
    findings.push({
      rule: 'private-key',
      file: relativePath,
      line: 1,
      message: `tracked private key file ${relativePath}`,
    });
  }
  if (buffer.includes(0) || BINARY_EXT.has(path.posix.extname(relativePath).toLowerCase())) return findings;

  const text = buffer.toString('utf8');
  if (envKind === 'example') findings.push(...exampleValueFindings(relativePath, text));
  findings.push(...contentFindings(relativePath, text));
  return findings;
}

function classifyEnv(relativePath) {
  const base = path.posix.basename(relativePath);
  if (base === '.env.example') return 'example';
  if (base === '.env' || base.startsWith('.env.')) return 'forbidden';
  return null;
}

function isPrivateKeyFile(relativePath) {
  const base = path.posix.basename(relativePath);
  if (base.endsWith('.pub')) return false;
  if (KEY_BASENAMES.has(base)) return true;
  return KEY_EXT.has(path.posix.extname(base).toLowerCase());
}

function exampleValueFindings(relativePath, text) {
  const findings = [];
  const lines = text.split(/\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, '');
    let value = stripQuotes(trimmed.slice(eq + 1).trim());
    const hash = value.indexOf(' #');
    if (hash !== -1 && !value.startsWith('"') && !value.startsWith("'")) value = value.slice(0, hash).trim();
    if (value === '' || isLoopbackUrl(value)) continue;
    findings.push({
      rule: 'example-value',
      file: relativePath,
      line: index + 1,
      message: `${key} in .env.example must be empty or a loopback URL`,
    });
  }
  return findings;
}

function stripQuotes(value) {
  if (value.length >= 2) {
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) return value.slice(1, -1);
  }
  return value;
}

function isLoopbackUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || url.search || url.hash) return false;
  if (url.pathname !== '/' && url.pathname !== '') return false;
  return url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1';
}

function contentFindings(relativePath, text) {
  const findings = [];
  if (PRIVATE_KEY.test(text)) {
    findings.push({
      rule: 'private-key',
      file: relativePath,
      line: lineOf(text, text.search(PRIVATE_KEY)),
      message: 'private key block',
    });
  }

  for (const match of text.matchAll(JWT)) {
    if (!jwtHasRole(match[0], privilegedRole)) continue;
    findings.push({
      rule: 'service-role-jwt',
      file: relativePath,
      line: lineOf(text, match.index),
      message: `JWT payload role is ${privilegedRole}`,
    });
  }

  for (const match of text.matchAll(SUPABASE_SECRET)) {
    findings.push({
      rule: 'supabase-secret-key',
      file: relativePath,
      line: lineOf(text, match.index),
      message: 'Supabase secret key',
    });
  }

  for (const match of text.matchAll(FINNHUB_ASSIGN)) {
    const name = match[1];
    const value = match[3];
    if (name.toLowerCase().includes('url')) continue;
    if (!isFinnhubToken(value)) continue;
    findings.push({
      rule: 'finnhub-key',
      file: relativePath,
      line: lineOf(text, match.index),
      message: 'Finnhub key value; only the env var name is allowed',
    });
  }
  for (const match of text.matchAll(FINNHUB_TOKEN_QUERY)) {
    findings.push({
      rule: 'finnhub-key',
      file: relativePath,
      line: lineOf(text, match.index),
      message: 'Finnhub key in a request URL',
    });
  }

  for (const match of text.matchAll(VAPID_ASSIGN)) {
    const name = match[1];
    if (/public/i.test(name) && !/private/i.test(name)) continue;
    if (!isVapidPrivateKey(match[3])) continue;
    findings.push({
      rule: 'vapid-private-key',
      file: relativePath,
      line: lineOf(text, match.index),
      message: 'VAPID private key value; only the env var name is allowed',
    });
  }
  for (const match of text.matchAll(VAPID_PRIVATE_PROP)) {
    const around = text.slice(Math.max(0, match.index - 240), match.index + match[0].length + 80);
    if (!/vapid/i.test(around)) continue;
    if (!isVapidPrivateKey(match[2])) continue;
    findings.push({
      rule: 'vapid-private-key',
      file: relativePath,
      line: lineOf(text, match.index),
      message: 'VAPID private key value; only the env var name is allowed',
    });
  }
  return findings;
}

function isFinnhubToken(value) {
  return /^[A-Za-z0-9]{20,}$/.test(value);
}

function isVapidPrivateKey(value) {
  const bare = value.replace(/=+$/, '');
  if (!/^[A-Za-z0-9_-]{43}$/.test(bare)) return false;
  return Buffer.from(bare, 'base64url').length === 32;
}

function jwtHasRole(token, role) {
  const payload = token.split('.')[1];
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed?.role === role;
  } catch {
    return false;
  }
}

function lineOf(text, index) {
  let line = 1;
  for (let cursor = 0; cursor < index && cursor < text.length; cursor += 1) {
    if (text[cursor] === '\n') line += 1;
  }
  return line;
}

function dedupe(findings) {
  const seen = new Set();
  const unique = [];
  for (const item of findings) {
    const key = `${item.rule}\0${item.file}\0${item.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  unique.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
  return unique;
}

function trackedFiles(root) {
  const listed = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'buffer',
  });
  if (listed.status !== 0) {
    throw new Error(listed.stderr?.toString() || 'git ls-files failed');
  }
  return listed.stdout.toString('utf8').split('\0').filter(Boolean);
}

function report(findings) {
  for (const item of findings) {
    console.error(`::error file=${item.file},line=${item.line}::${item.message}`);
    console.error(`${item.file}:${item.line}: ${item.message}`);
  }
  console.log(`lint-secrets: ${findings.length} findings`);
  return findings.length > 0 ? 1 : 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exit(report(scanRepository()));
