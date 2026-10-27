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
