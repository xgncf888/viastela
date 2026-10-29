import { expect, test } from '@jest/globals';

import { oauthRedirectTo } from './oauth';
import {
  clearConsentAuthorization,
  consentLoginHref,
  consentReturnPath,
  decisionFailedMessage,
  invalidAuthorizationMessage,
  loadAuthorization,
  missingAuthorizationMessage,
  peekConsentAuthorization,
  presentAuthorization,
  readAuthorizationId,
  rememberConsentAuthorization,
  safeRedirectUrl,
  sameRedirectTarget,
  submitAuthorizationDecision,
} from './oauth-consent';

const redirectUri = 'https://claude.ai/api/mcp/auth_callback';

function details() {
  return {
    authorization_id: 'auth-1',
    redirect_uri: redirectUri,
    client: { id: 'client-1', name: 'Claude', uri: 'https://claude.ai', logo_uri: '' },
    user: { id: 'user-1', email: 'person@example.com' },
    scope: 'openid email',
  };
}

test('authorization id is preserved on the login and consent paths', () => {
  expect(readAuthorizationId('  abc-1  ')).toBe('abc-1');
  expect(readAuthorizationId('')).toBe('');
  expect(readAuthorizationId('bad\nid')).toBe('');
  expect(consentLoginHref('abc/1')).toBe('/login?authorization_id=abc%2F1');
  expect(consentReturnPath('abc/1')).toBe('/oauth/consent?authorization_id=abc%2F1');
  expect(oauthRedirectTo('https://preview.example', consentReturnPath('abc/1'))).toBe(
    'https://preview.example/oauth/consent?authorization_id=abc%2F1',
  );
});

test('consent details keep the client name, scopes, and redirect URI and drop the email', () => {
  const view = presentAuthorization(details());
  expect(view).toEqual({
    kind: 'consent',
    clientName: 'Claude',
    redirectUri,
    scopes: ['openid', 'email'],
  });
  expect(JSON.stringify(view)).not.toContain('person@example.com');
  expect(presentAuthorization({ redirect_url: `${redirectUri}?code=1&state=s` })).toEqual({
    kind: 'redirect',
    url: `${redirectUri}?code=1&state=s`,
  });
  expect(presentAuthorization({ redirect_url: 'javascript:alert(1)' })).toBeNull();
});

test('a redirect must stay on the URI shown on the consent screen', () => {
  expect(safeRedirectUrl(`${redirectUri}?code=1`)).toBe(`${redirectUri}?code=1`);
  expect(safeRedirectUrl('javascript:alert(1)')).toBeNull();
  expect(sameRedirectTarget(`${redirectUri}?code=1&state=s`, redirectUri)).toBe(true);
  expect(sameRedirectTarget('https://evil.example/callback?code=1', redirectUri)).toBe(false);
});

test('loading details never approves, and a failure is a fixed message', async () => {
  let approvals = 0;
  const loaded = await loadAuthorization('auth-1', {
    async getAuthorizationDetails() {
      return { data: details(), error: null };
    },
  });
  expect(loaded).toEqual({
    view: { kind: 'consent', clientName: 'Claude', redirectUri, scopes: ['openid', 'email'] },
  });
  expect(approvals).toBe(0);

  const failed = await loadAuthorization('gone', {
    async getAuthorizationDetails() {
      return { data: null, error: { message: 'Error: secret\n    at Object.<anonymous> (stack)' } };
    },
  } as unknown as Parameters<typeof loadAuthorization>[1]);
  expect(failed).toEqual({ message: invalidAuthorizationMessage });
  expect(JSON.stringify(failed)).not.toContain('stack');
  expect(missingAuthorizationMessage).not.toContain('Error');
});

test('approve runs only for an explicit approve decision and must match the shown redirect', async () => {
  const calls: string[] = [];
  const oauth = {
    async approveAuthorization() {
      calls.push('approve');
      return { data: { redirect_url: `${redirectUri}?code=1&state=s` }, error: null };
    },
    async denyAuthorization() {
      calls.push('deny');
      return { data: { redirect_url: `${redirectUri}?error=access_denied&state=s` }, error: null };
    },
  };
  const denied = await submitAuthorizationDecision('auth-1', 'deny', redirectUri, oauth);
  expect(denied).toEqual({ url: `${redirectUri}?error=access_denied&state=s` });
  expect(calls).toEqual(['deny']);

  const approved = await submitAuthorizationDecision('auth-1', 'approve', redirectUri, oauth);
  expect(approved).toEqual({ url: `${redirectUri}?code=1&state=s` });
  expect(calls).toEqual(['deny', 'approve']);

  const mismatched = await submitAuthorizationDecision('auth-1', 'approve', redirectUri, {
    async approveAuthorization() {
      return { data: { redirect_url: 'https://evil.example/callback?code=1' }, error: null };
    },
    async denyAuthorization() {
      return { data: null, error: { message: 'unused' } };
    },
  } as unknown as Parameters<typeof submitAuthorizationDecision>[3]);
  expect(mismatched).toEqual({ message: decisionFailedMessage });
});

test('the consent id can be remembered until the consent page clears it', () => {
  const store = new Map<string, string>();
  const host = globalThis as unknown as { sessionStorage?: Storage };
  const previous = host.sessionStorage;
  host.sessionStorage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  };
  try {
    rememberConsentAuthorization('auth-1');
    expect(peekConsentAuthorization()).toBe('auth-1');
    clearConsentAuthorization();
    expect(peekConsentAuthorization()).toBe('');
  } finally {
    host.sessionStorage = previous;
  }
});
