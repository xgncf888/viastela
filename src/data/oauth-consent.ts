import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabase } from './client';

const storageKey = 'oauth-consent-authorization-id';

export const missingAuthorizationMessage = '缺少授权编号';
export const invalidAuthorizationMessage = '授权请求无效或已过期';
export const decisionFailedMessage = '授权没有完成';
export const notConfiguredMessage = '尚未配置 Supabase';

type OAuthServer = SupabaseClient['auth']['oauth'];
type AuthorizationData = NonNullable<Awaited<ReturnType<OAuthServer['getAuthorizationDetails']>>['data']>;

export type AuthorizationView =
  | { kind: 'consent'; clientName: string; redirectUri: string; scopes: string[] }
  | { kind: 'redirect'; url: string };

/** Query value from the consent or login route. Empty when it is missing or unsafe to put back on a URL. */
export function readAuthorizationId(value: string | string[] | null | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 256) return '';
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return '';
  return trimmed;
}

export function consentLoginHref(authorizationId: string): `/login?authorization_id=${string}` {
  return `/login?authorization_id=${encodeURIComponent(authorizationId)}`;
}

export function consentReturnPath(authorizationId: string): `/oauth/consent?authorization_id=${string}` {
  return `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
}

/** Survives the full-page return from provider sign-in when the login URL loses the query. */
export function rememberConsentAuthorization(authorizationId: string): void {
  const id = readAuthorizationId(authorizationId);
  if (!id) return;
  try {
    globalThis.sessionStorage?.setItem(storageKey, id);
  } catch {
    // The query string still carries the id when storage is unavailable.
  }
}

export function peekConsentAuthorization(): string {
  try {
    return readAuthorizationId(globalThis.sessionStorage?.getItem(storageKey) ?? undefined);
  } catch {
    return '';
  }
}

export function clearConsentAuthorization(): void {
  try {
    globalThis.sessionStorage?.removeItem(storageKey);
  } catch {
    // Ignore storage failures. The consent URL still has the id.
  }
}

/** http(s) only. Refuses javascript: and other schemes before the browser follows a redirect. */
export function safeRedirectUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The post-consent redirect may add query parameters. Origin and path must match the URI the person saw. */
export function sameRedirectTarget(redirectUrl: string, redirectUri: string): boolean {
  const target = safeRedirectUrl(redirectUrl);
  const allowed = safeRedirectUrl(redirectUri);
  if (!target || !allowed) return false;
  const actual = new URL(target);
  const expected = new URL(allowed);
  return actual.origin === expected.origin && actual.pathname === expected.pathname;
}

export function presentAuthorization(data: AuthorizationData): AuthorizationView | null {
  if ('authorization_id' in data) {
    const clientName = data.client.name.trim();
    const redirectUri = data.redirect_uri.trim();
    if (!clientName || !safeRedirectUrl(redirectUri)) return null;
    const scopes = data.scope.split(' ').map((scope) => scope.trim()).filter(Boolean);
    return { kind: 'consent', clientName, redirectUri, scopes };
  }
  const url = safeRedirectUrl(data.redirect_url);
  if (!url) return null;
  return { kind: 'redirect', url };
}

export async function loadAuthorization(
  authorizationId: string,
  oauth: Pick<OAuthServer, 'getAuthorizationDetails'> = getSupabase().auth.oauth,
): Promise<{ view: AuthorizationView } | { message: string }> {
  try {
    const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
    if (error || !data) return { message: invalidAuthorizationMessage };
    const view = presentAuthorization(data);
    if (!view) return { message: invalidAuthorizationMessage };
    return { view };
  } catch {
    return { message: invalidAuthorizationMessage };
  }
}

/**
 * Approve and deny are separate calls. Nothing in this module invokes approve
 * except `submitAuthorizationDecision(..., 'approve')`, which the consent
 * screen calls from the agree button.
 */
export async function submitAuthorizationDecision(
  authorizationId: string,
  decision: 'approve' | 'deny',
  redirectUri: string,
  oauth: Pick<OAuthServer, 'approveAuthorization' | 'denyAuthorization'> = getSupabase().auth.oauth,
): Promise<{ url: string } | { message: string }> {
  try {
    const result = decision === 'approve'
      ? await oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (result.error || !result.data?.redirect_url) return { message: decisionFailedMessage };
    if (!sameRedirectTarget(result.data.redirect_url, redirectUri)) return { message: decisionFailedMessage };
    const url = safeRedirectUrl(result.data.redirect_url);
    if (!url) return { message: decisionFailedMessage };
    return { url };
  } catch {
    return { message: decisionFailedMessage };
  }
}

export function followAuthorizationRedirect(url: string): boolean {
  const safe = safeRedirectUrl(url);
  if (!safe) return false;
  const assign = globalThis.location?.assign?.bind(globalThis.location);
  if (!assign) return false;
  assign(safe);
  return true;
}
