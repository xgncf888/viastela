/**
 * Recent sign-in for account deletion.
 *
 * Supabase puts each authentication method on the session JWT's `amr` claim,
 * with a unix-second `timestamp` from that sign-in. A refresh-token grant
 * updates `iat` and may add a `token_refresh` entry. Neither is a new sign-in,
 * so `iat` is ignored and `token_refresh` entries are skipped. `last_sign_in_at`
 * is the user row, shared across sessions, and is not read.
 *
 * Exactly 10:00 after the newest remaining timestamp passes. Only a gap longer
 * than 10 minutes is rejected. A missing claim, an empty list, or no usable
 * timestamp is stale.
 */

export const recentSignInWindowMs = 10 * 60 * 1000;

const refreshMethod = 'token_refresh';

export type Authentication = {
  method: string;
  timestampMs: number;
  provider: string | null;
};

export type ReauthChannel = 'email' | 'google' | 'github';

export function jwtPayload(token: string): Record<string, unknown> | null {
  const segment = token.split('.')[1];
  if (!segment) return null;
  try {
    const parsed: unknown = JSON.parse(decodeBase64Url(segment));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * The raw `amr` claim from a JWT payload.
 * Call this only after `getUser` (or the local session store) has accepted the token.
 * The payload is not signature-checked here.
 */
export function amrClaim(token: string): unknown {
  const payload = jwtPayload(token);
  if (!payload || !Object.prototype.hasOwnProperty.call(payload, 'amr')) return null;
  return payload.amr;
}

/** `app_metadata.provider` from the same verified payload, when it is a string. */
export function identityProvider(token: string): string | null {
  const payload = jwtPayload(token);
  const meta = payload?.app_metadata;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  const provider = (meta as { provider?: unknown }).provider;
  return typeof provider === 'string' ? provider : null;
}

function parseEntry(value: unknown): Authentication | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entry = value as { method?: unknown; timestamp?: unknown; provider?: unknown };
  const timestamp = entry.timestamp;
  if (typeof timestamp !== 'number' || !Number.isInteger(timestamp)) return null;
  if (timestamp < 0 || timestamp >= 1_000_000_000_000) return null;
  const method = typeof entry.method === 'string' ? entry.method.toLowerCase() : '';
  const provider = typeof entry.provider === 'string' ? entry.provider.toLowerCase() : null;
  return { method, timestampMs: timestamp * 1000, provider };
}

/**
 * Newest `amr` entry that is not `token_refresh`.
 * Array order is ignored. Entries with an invalid timestamp are skipped.
 * Returns null when nothing usable remains, which the recency check treats as stale.
 */
export function newestAuthentication(amr: unknown): Authentication | null {
  if (!Array.isArray(amr)) return null;
  let newest: Authentication | null = null;
  for (const value of amr) {
    const parsed = parseEntry(value);
    if (!parsed || parsed.method === refreshMethod) continue;
    if (!newest || parsed.timestampMs > newest.timestampMs) newest = parsed;
  }
  return newest;
}

/**
 * True when the newest usable `amr` timestamp is at most 10 minutes before `nowMs`.
 * Exactly 10:00 passes. Only more than 10 minutes is rejected.
 * A missing claim, an empty array, or an invalid timestamp (with nothing newer
 * that is valid and not `token_refresh`) is not recent.
 */
export function isRecentSignIn(amr: unknown, nowMs: number): boolean {
  const newest = newestAuthentication(amr);
  if (!newest) return false;
  return nowMs - newest.timestampMs <= recentSignInWindowMs;
}

/**
 * Web OAuth goes back to Google or GitHub when that provider is the newest sign-in.
 * The provider is `amr.provider` when present, otherwise `fallbackProvider`
 * (the JWT `app_metadata.provider`). Every other method, an unknown OAuth
 * provider, and every native platform use the email code.
 */
export function reauthChannel(amr: unknown, os: string, fallbackProvider?: string | null): ReauthChannel {
  if (os !== 'web') return 'email';
  const newest = newestAuthentication(amr);
  if (!newest || newest.method !== 'oauth') return 'email';
  const provider = newest.provider ?? fallbackProvider?.toLowerCase() ?? null;
  if (provider === 'google' || provider === 'github') return provider;
  return 'email';
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
