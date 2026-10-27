export type OAuthProvider = 'google' | 'github';

/** Web sends the person back to this origin. Native leaves the redirect to the client. */
export function oauthRedirectTo(origin: string | null | undefined): string | undefined {
  if (!origin) return undefined;
  return origin;
}

export function currentOrigin(): string | null {
  if (typeof globalThis.location === 'undefined') return null;
  return globalThis.location.origin || null;
}

const providerFailureText = '登录没有完成，请重试';

/**
 * Holds a failed provider return only until the login screen copies it into state.
 * The screen clears this after display and again when sign-in succeeds.
 */
let oauthFailureMessage: string | null = null;

function hasProviderError(query: string): boolean {
  const params = new URLSearchParams(query);
  return params.has('error') || params.has('error_code');
}

function hashQuery(hash: string): string {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const splitAt = raw.indexOf('?');
  return splitAt === -1 ? raw : raw.slice(splitAt + 1);
}

/** True when `error` is in the query string or the URL hash. */
export function oauthFailedOnReturn(): boolean {
  if (typeof globalThis.location === 'undefined') return false;
  return hasProviderError(globalThis.location.search) || hasProviderError(hashQuery(globalThis.location.hash));
}

function stripProviderError(): void {
  const url = new URL(globalThis.location.href);
  url.searchParams.delete('error');
  url.searchParams.delete('error_description');
  url.searchParams.delete('error_code');
  const raw = url.hash.startsWith('#') ? url.hash.slice(1) : url.hash;
  if (raw) {
    const splitAt = raw.indexOf('?');
    const prefix = splitAt === -1 ? '' : raw.slice(0, splitAt);
    const hashParams = new URLSearchParams(splitAt === -1 ? raw : raw.slice(splitAt + 1));
    if (hashParams.has('error') || hashParams.has('error_code')) {
      hashParams.delete('error');
      hashParams.delete('error_description');
      hashParams.delete('error_code');
      const nextQuery = hashParams.toString();
      url.hash = prefix ? (nextQuery ? `${prefix}?${nextQuery}` : prefix) : nextQuery;
    }
  }
  globalThis.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
}

/** Read a failed provider return before the router drops the query or hash on the way to login. */
export function captureOAuthFailure(): string | null {
  if (oauthFailureMessage) return oauthFailureMessage;
  if (typeof globalThis.history === 'undefined' || !oauthFailedOnReturn()) return null;
  stripProviderError();
  oauthFailureMessage = providerFailureText;
  return oauthFailureMessage;
}

export function clearOAuthFailureMessage(): void {
  oauthFailureMessage = null;
}
