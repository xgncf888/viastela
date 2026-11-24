import { afterEach, beforeEach, expect, test } from '@jest/globals';

import {
  clearLocalModeData,
  enterLocalMode,
  getAuthenticatedRemoteSession,
  hasStoredCloudSession,
  isLocalModeSelected,
  isLocalOnlySession,
  leaveDeviceSession,
  leaveLocalMode,
  requireRemoteUserId,
  signOut,
} from './auth';
import { localListWeightRecords, localUpsertWeightRecord } from './local-db';
import { createMemoryLocalStore, setLocalStoreForTests } from './local-store';
import { clearQuoteCache, readCachedQuotes, writeCachedQuotes, cachedQuote } from './quoteCache';

declare const process: { cwd(): string; env: Record<string, string | undefined> };
declare function require(id: 'fs'): { readFileSync(file: string, encoding: 'utf8'): string };
declare function require(id: 'path'): { join(...parts: string[]): string };

function installLocalStorage(): void {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => (store.has(key) ? (store.get(key) ?? null) : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorage });
}

beforeEach(() => {
  installLocalStorage();
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

test('standalone, shell=native, and app: do not turn local mode on by themselves', () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        search: '?shell=native',
        protocol: 'app:',
        hostname: 'appassets.androidplatform.net',
      },
      navigator: { standalone: true },
    },
  });
  expect(isLocalModeSelected()).toBe(false);
  expect(localStorage.getItem('viastela.local_mode')).toBeNull();
  expect(enterLocalMode()?.userId).toBe('00000000-0000-4000-8000-000000000001');
  expect(localStorage.getItem('viastela.local_mode')).toBe('1');
});

test('production builds ignore a stored local-mode flag', () => {
  const dev = globalThis as { __DEV__?: boolean };
  const previous = dev.__DEV__;
  dev.__DEV__ = false;
  try {
    localStorage.setItem('viastela.local_mode', '1');
    expect(isLocalModeSelected()).toBe(false);
    expect(enterLocalMode()).toBeNull();
  } finally {
    dev.__DEV__ = previous;
  }
});

test('real-session detection uses the configured client storage key', () => {
  const previous = process.env.EXPO_PUBLIC_SUPABASE_URL;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://projectref.supabase.co';
  try {
    const cloud = JSON.stringify({
      user: { id: '11111111-1111-4111-8111-111111111111', email: 'yifeng@example.com' },
    });
    localStorage.setItem('sb-127-auth-token', cloud);
    expect(hasStoredCloudSession()).toBe(false);
    localStorage.setItem('sb-projectref-auth-token', cloud);
    expect(hasStoredCloudSession()).toBe(true);
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previous;
  }
});

test('leaving local mode keeps records until an explicit clear', async () => {
  await localUpsertWeightRecord({
    id: 'w-local',
    weightKg: 70,
    recordedAt: '2026-11-04T08:00:00.000Z',
    tz: 'UTC',
    localDay: '2026-11-04',
    updatedAt: '2026-11-04T08:00:00.000Z',
  });
  enterLocalMode();
  localStorage.setItem('viastela.desktop.standalone.db.v1', '{"weight_records":[{"id":"legacy"}]}');
  await leaveLocalMode();
  expect(localStorage.getItem('viastela.local_mode')).toBeNull();
  expect(await localListWeightRecords({ fromDay: '2026-11-01', toDay: '2026-11-30' })).toHaveLength(1);
  expect(localStorage.getItem('viastela.desktop.standalone.db.v1')).toBe('{"weight_records":[{"id":"legacy"}]}');

  enterLocalMode();
  localStorage.setItem(
    'sb-127-auth-token',
    JSON.stringify({
      user: { id: '00000000-0000-4000-8000-000000000001', email: 'local@device.offline' },
    }),
  );
  await clearLocalModeData();
  expect(await localListWeightRecords({ fromDay: '2026-11-01', toDay: '2026-11-30' })).toEqual([]);
  expect(localStorage.getItem('viastela.desktop.standalone.db.v1')).toBeNull();
  expect(localStorage.getItem('viastela.local_mode')).toBeNull();
  expect(localStorage.getItem('sb-127-auth-token')).toBeNull();
});

test('pwa-head.js and the macOS shell do not ship a fake session or fetch interceptor', () => {
  const fs = require('fs');
  const path = require('path');
  const head = fs.readFileSync(path.join(process.cwd(), 'public/pwa-head.js'), 'utf8');
  const macos = fs.readFileSync(path.join(process.cwd(), 'scripts/build-macos-app.mjs'), 'utf8');
  const auth = fs.readFileSync(path.join(process.cwd(), 'src/data/auth.ts'), 'utf8');
  for (const source of [head, macos]) {
    expect(source).not.toContain('isLocalModeEnabled');
    expect(source).not.toContain('installLocalStandaloneBackend');
    expect(source).not.toContain('handleLocalRest');
    expect(source).not.toContain('__VIASTELA_ENTER_LOCAL_MODE__');
    expect(source).not.toContain('00000000-0000-4000-8000-000000000001');
  }
  expect(head).not.toContain('window.fetch');
  expect(head).not.toContain('navigator.standalone');
  expect(auth).not.toContain('sb-127-auth-token');
  expect(auth).not.toContain('navigator.standalone');
  expect(auth).toContain('hasStoredRemoteSession');
});
