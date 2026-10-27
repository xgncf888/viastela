import { expect, test } from '@jest/globals';

import {
  amrClaim,
  isRecentSignIn,
  newestAuthentication,
  reauthChannel,
  recentSignInWindowMs,
} from './recent-sign-in';

const nowMs = 1_700_000_000_000;
const minute = 60 * 1000;

function entry(ageMs: number, method = 'otp', provider?: string) {
  return {
    method,
    timestamp: Math.floor((nowMs - ageMs) / 1000),
    ...(provider ? { provider } : {}),
  };
}

function unsignedJwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) => {
    const json = JSON.stringify(value);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
}

test('the recent-sign-in window is 10 minutes and exactly 10:00 passes', () => {
  expect(recentSignInWindowMs).toBe(10 * minute);
  expect(isRecentSignIn([entry(9 * minute + 59 * 1000)], nowMs)).toBe(true);
  expect(isRecentSignIn([entry(10 * minute)], nowMs)).toBe(true);
  expect(isRecentSignIn([entry(10 * minute + 1000)], nowMs)).toBe(false);
});

test('a missing amr, an empty array, and an invalid timestamp are stale', () => {
  expect(isRecentSignIn(undefined, nowMs)).toBe(false);
  expect(isRecentSignIn(null, nowMs)).toBe(false);
  expect(isRecentSignIn([], nowMs)).toBe(false);
  expect(isRecentSignIn([{ method: 'otp', timestamp: 'nope' }], nowMs)).toBe(false);
  expect(isRecentSignIn([{ method: 'otp', timestamp: 10.5 }], nowMs)).toBe(false);
  expect(isRecentSignIn([{ method: 'otp' }], nowMs)).toBe(false);
  expect(isRecentSignIn([{ method: 'otp', timestamp: -1 }], nowMs)).toBe(false);
});

test('multiple amr entries use the newest timestamp, ignoring array order', () => {
  expect(isRecentSignIn([entry(10 * minute + 1000), entry(9 * minute + 59 * 1000, 'oauth', 'google')], nowMs)).toBe(
    true,
  );
  expect(isRecentSignIn([entry(11 * minute), entry(10 * minute + 1000, 'oauth', 'github')], nowMs)).toBe(false);
  expect(newestAuthentication([entry(minute, 'otp'), entry(0, 'oauth', 'google')])?.method).toBe('oauth');
});

test('a token_refresh entry does not count as re-authentication', () => {
  const refreshed = [entry(10 * minute + 1000, 'otp'), entry(0, 'token_refresh')];
  expect(isRecentSignIn(refreshed, nowMs)).toBe(false);
  expect(newestAuthentication(refreshed)?.method).toBe('otp');

  const token = unsignedJwt({
    iat: Math.floor(nowMs / 1000),
    amr: refreshed,
  });
  expect(isRecentSignIn(amrClaim(token), nowMs)).toBe(false);
});

test('reauth follows the newest method, and native always uses the email code', () => {
  const google = [entry(minute, 'oauth', 'google')];
  const github = [entry(11 * minute, 'otp'), { method: 'oauth', timestamp: Math.floor(nowMs / 1000), provider: 'github' }];
  expect(reauthChannel(google, 'web')).toBe('google');
  expect(reauthChannel(github, 'web')).toBe('github');
  expect(reauthChannel([entry(0, 'otp')], 'web')).toBe('email');
  expect(reauthChannel([{ method: 'oauth', timestamp: Math.floor(nowMs / 1000) }], 'web', 'google')).toBe('google');
  expect(reauthChannel([{ method: 'oauth', timestamp: Math.floor(nowMs / 1000) }], 'web')).toBe('email');
  expect(reauthChannel(google, 'ios')).toBe('email');
  expect(reauthChannel(google, 'android')).toBe('email');
});
