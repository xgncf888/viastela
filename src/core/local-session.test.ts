import { expect, test } from '@jest/globals';

import {
  hasStoredRemoteSession,
  LOCAL_OFFLINE_USER_ID,
  storedTokenIsLocalUser,
  storedTokenIsRemoteUser,
  supabaseAuthStorageKey,
} from './local-session';

const cloudUser = {
  user: { id: '11111111-1111-4111-8111-111111111111', email: 'yifeng@example.com' },
};

test('storage key follows the Supabase client hostname label', () => {
  expect(supabaseAuthStorageKey('https://projectref.supabase.co')).toBe('sb-projectref-auth-token');
  expect(supabaseAuthStorageKey('http://127.0.0.1:54321')).toBe('sb-127-auth-token');
  expect(supabaseAuthStorageKey('https://auth.viastela.com')).toBe('sb-auth-auth-token');
});

test('a cloud session is detected only under the client key for that URL', () => {
  const store = new Map<string, string>();
  store.set('sb-127-auth-token', JSON.stringify(cloudUser));
  const read = (key: string) => store.get(key) ?? null;
  expect(hasStoredRemoteSession(read, 'https://projectref.supabase.co')).toBe(false);
  store.set('sb-projectref-auth-token', JSON.stringify(cloudUser));
  expect(hasStoredRemoteSession(read, 'https://projectref.supabase.co')).toBe(true);
  expect(hasStoredRemoteSession(read, 'http://127.0.0.1:54321')).toBe(true);
});

test('the device-only user is not a remote session', () => {
  const raw = JSON.stringify({
    user: { id: LOCAL_OFFLINE_USER_ID, email: 'local@device.offline' },
  });
  expect(storedTokenIsLocalUser(raw)).toBe(true);
  expect(storedTokenIsRemoteUser(raw)).toBe(false);
  expect(storedTokenIsRemoteUser(null)).toBe(false);
  expect(storedTokenIsRemoteUser('not-json')).toBe(false);
});
