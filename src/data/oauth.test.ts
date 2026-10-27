import { expect, test } from '@jest/globals';

import { captureOAuthFailure, clearOAuthFailureMessage, oauthFailedOnReturn, oauthRedirectTo } from './oauth';

test('web OAuth returns to the current origin and native does not invent one', () => {
  expect(oauthRedirectTo('https://app.example')).toBe('https://app.example');
  expect(oauthRedirectTo('https://viastela.vercel.app', '/account/delete')).toBe(
    'https://viastela.vercel.app/account/delete',
  );
  expect(oauthRedirectTo(null)).toBeUndefined();
  expect(oauthRedirectTo(undefined)).toBeUndefined();
  expect(oauthRedirectTo('')).toBeUndefined();
});

function withLocation(initial: string, run: (current: () => string) => void) {
  const host = globalThis as unknown as Record<string, unknown>;
  const previousLocation = host.location;
  const previousHistory = host.history;
  clearOAuthFailureMessage();
  let href = initial;
  host.location = {
    get href() {
      return href;
    },
    get search() {
      return new URL(href).search;
    },
    get hash() {
      return new URL(href).hash;
    },
  };
  host.history = {
    replaceState(_data: unknown, _unused: string, url?: string | URL | null) {
      href = new URL(url ?? href, href).toString();
    },
  };
  try {
    run(() => href);
  } finally {
    host.location = previousLocation;
    host.history = previousHistory;
    clearOAuthFailureMessage();
  }
}

test('a failed provider return in the query is remembered until the login screen clears it', () => {
  withLocation('https://app.example/?error=access_denied&error_code=access_denied', (href) => {
    expect(oauthFailedOnReturn()).toBe(true);
    expect(captureOAuthFailure()).toBe('登录没有完成，请重试');
    expect(new URL(href()).search).toBe('');
    expect(oauthFailedOnReturn()).toBe(false);
    clearOAuthFailureMessage();
    expect(captureOAuthFailure()).toBeNull();
  });
});

test('a failed provider return in the URL hash is detected and removed', () => {
  withLocation('https://app.example/#error=access_denied&error_code=access_denied', (href) => {
    expect(oauthFailedOnReturn()).toBe(true);
    expect(captureOAuthFailure()).toBe('登录没有完成，请重试');
    expect(new URL(href()).hash).toBe('');
    expect(new URL(href()).search).toBe('');
    clearOAuthFailureMessage();
    expect(captureOAuthFailure()).toBeNull();
  });
});
