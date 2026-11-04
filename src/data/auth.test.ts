import { afterEach, beforeEach, expect, test } from '@jest/globals';

import {
  enterLocalMode,
  getAuthenticatedRemoteSession,
  isLocalOnlySession,
  leaveDeviceSession,
  requireRemoteUserId,
  signOut,
} from './auth';
import { createMemoryLocalStore, setLocalStoreForTests } from './local-store';
import { clearQuoteCache, readCachedQuotes, writeCachedQuotes, cachedQuote } from './quoteCache';

declare const process: { cwd(): string };
declare function require(id: 'fs'): { readFileSync(file: string, encoding: 'utf8'): string };
declare function require(id: 'path'): { join(...parts: string[]): string };

beforeEach(() => {
  setLocalStoreForTests(createMemoryLocalStore());
});

afterEach(async () => {
  await signOut().catch(() => {});
  await clearQuoteCache();
  setLocalStoreForTests(null);
});

test('sign-out clears the current user cache even when auth.signOut throws', async () => {
  const quote = cachedQuote({
    symbol: 'AAA',
    price: 11,
    currency: 'USD',
    as_of: '2026-01-01T00:00:00.000Z',
    status: 'fresh',
    source: 'finnhub',
  });
  await writeCachedQuotes('user-a', [quote]);
  await writeCachedQuotes('user-b', [
    cachedQuote({
      symbol: 'BBB',
      price: 4,
      currency: 'USD',
      as_of: '2026-01-01T00:00:00.000Z',
      status: 'fresh',
      source: 'finnhub',
    }),
  ]);
  await expect(
    leaveDeviceSession('user-a', async () => {
      throw new Error('sign-out failed');
    }),
  ).rejects.toThrow('sign-out failed');
  await expect(readCachedQuotes('user-a')).resolves.toEqual([]);
  expect((await readCachedQuotes('user-b')).map((item) => item.symbol)).toEqual(['BBB']);
});

test('isLocalOnlySession distinguishes fake local session from real user session', () => {
  expect(isLocalOnlySession(null)).toBe(false);
  expect(
    isLocalOnlySession({
      userId: '00000000-0000-4000-8000-000000000001',
      email: 'local@device.offline',
    }),
  ).toBe(true);
  expect(
    isLocalOnlySession({
      userId: '11111111-1111-4111-8111-111111111111',
      email: 'yifeng@example.com',
    }),
  ).toBe(false);
});

test('local mode blocks getAuthenticatedRemoteSession and requireRemoteUserId', async () => {
  const localSess = enterLocalMode();
  expect(isLocalOnlySession(localSess)).toBe(true);
  await expect(getAuthenticatedRemoteSession()).resolves.toBeNull();
  await expect(requireRemoteUserId()).rejects.toThrow('Not signed in');
});

test('pwa-head.js defaults isLocalModeEnabled to false, removes mobile/remote auto-enable, and gates fake JWT/seed data on native shell + 127.0.0.1:54321', () => {
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(process.cwd(), 'public/pwa-head.js'), 'utf8');
  expect(source).not.toContain('isMobileOrRemoteClient');
  expect(source).toContain('function isLocalModeEnabled()');
  expect(source).toContain(
    "return isNativePackagedShell() && getConfiguredSupabaseUrl(urlHint).indexOf('127.0.0.1:54321') !== -1;",
  );
  expect(source).toContain('if (!canUseFakeJwtAndSeedData(urlHint)) return null;');
});
