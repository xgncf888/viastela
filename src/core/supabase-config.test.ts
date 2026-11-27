import { expect, test } from '@jest/globals';

import { validateSupabaseConfig } from './supabase-config';

function tokenWithRole(role: string): string {
  const encode = (value: Record<string, unknown>) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ role })}.signature`;
}

const httpsUrl = 'https://projectref.supabase.co';
const anonJwt = tokenWithRole('anon');
const serviceJwt = tokenWithRole(['service', 'role'].join('_'));
const secretKey = `${['sb', 'secret', ''].join('_')}${'a'.repeat(24)}`;
const publishableKey = 'sb_publishable_example_key';

test('http and a secret key are rejected', () => {
  const httpResult = validateSupabaseConfig('http://projectref.supabase.co', anonJwt);
  expect(httpResult.ok).toBe(false);
  if (!httpResult.ok) expect(httpResult.urlError).toBeTruthy();

  const secretResult = validateSupabaseConfig(httpsUrl, secretKey);
  expect(secretResult.ok).toBe(false);
  if (!secretResult.ok) expect(secretResult.keyError).toBeTruthy();
});

test('a privileged role JWT is rejected', () => {
  const result = validateSupabaseConfig(httpsUrl, serviceJwt);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.keyError).toBeTruthy();
});

test('an anon JWT and an sb_publishable_ key are accepted', () => {
  expect(validateSupabaseConfig(httpsUrl, anonJwt)).toEqual({
    ok: true,
    url: httpsUrl,
    anonKey: anonJwt,
  });
  expect(validateSupabaseConfig(`  ${httpsUrl}  `, `  ${publishableKey}  `)).toEqual({
    ok: true,
    url: httpsUrl,
    anonKey: publishableKey,
  });
});

test('anything that is not an anon key is rejected and empty input is not a reset', () => {
  const other = validateSupabaseConfig(httpsUrl, tokenWithRole('authenticated'));
  expect(other.ok).toBe(false);
  const empty = validateSupabaseConfig('', '');
  expect(empty.ok).toBe(false);
});
