/** Supabase access-token audience. Not the MCP resource URI. */
export const accessTokenAudience = 'authenticated';

/** The only signature algorithm this function accepts. */
export const accessTokenAlgorithm = 'ES256';

export type PublicJwk = {
  kty: string;
  crv?: string;
  alg?: string;
  kid?: string;
  x?: string;
  y?: string;
  use?: string;
};

export type Jwks = { keys: PublicJwk[] };

export type VerifiedAccessToken = {
  sub: string;
  clientId: string | null;
};

export type ProjectUrls = {
  resource: string;
  metadata: string;
  issuer: string;
  jwks: string;
};

/** Derive resource, metadata, issuer, and JWKS URLs from SUPABASE_URL. No project ref is hardcoded. */
export function projectUrls(supabaseUrl: string): ProjectUrls {
  const parsed = new URL(supabaseUrl);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('invalid supabase url');
  }
  if (parsed.username || parsed.password) {
    throw new Error('invalid supabase url');
  }
  const origin = parsed.origin;
  const resource = `${origin}/functions/v1/mcp`;
  const issuer = `${origin}/auth/v1`;
  return {
    resource,
    metadata: `${resource}/.well-known/oauth-protected-resource`,
    issuer,
    jwks: `${issuer}/.well-known/jwks.json`,
  };
}

export function wwwAuthenticate(metadataUrl: string): string {
  return `Bearer resource_metadata="${metadataUrl}"`;
}

export async function fetchJwks(url: string, fetcher: typeof fetch = fetch): Promise<Jwks> {
  const response = await fetcher(url, {
    method: 'GET',
    headers: { accept: 'application/json' },
    redirect: 'error',
  });
  if (!response.ok) throw new Error('jwks unavailable');
  const body = await response.json();
  if (!body || typeof body !== 'object' || !Array.isArray((body as { keys?: unknown }).keys)) {
    throw new Error('jwks unavailable');
  }
  return { keys: (body as { keys: PublicJwk[] }).keys };
}

function es256PublicKey(key: PublicJwk): boolean {
  if (key.kty !== 'EC' || key.crv !== 'P-256') return false;
  if (key.alg && key.alg !== accessTokenAlgorithm) return false;
  if (key.use && key.use !== 'sig') return false;
  return typeof key.x === 'string' && key.x.length > 0 && typeof key.y === 'string' && key.y.length > 0;
}

function selectKey(jwks: Jwks, kid: string | undefined): PublicJwk | null {
  const keys = jwks.keys.filter(es256PublicKey);
  if (kid) return keys.find((key) => key.kid === kid) ?? null;
  return keys.length === 1 ? keys[0] : null;
}

function bytesCopy(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(new ArrayBuffer(bytes.byteLength));
  copy.set(bytes);
  return copy;
}

function base64UrlDecode(input: string): Uint8Array {
  if (!input || /[^A-Za-z0-9_-]/.test(input)) throw new Error('invalid token');
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function decodeJson(part: string): unknown {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(base64UrlDecode(part));
  return JSON.parse(text);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function audienceMatches(value: unknown, expected: string): boolean {
  if (typeof value === 'string') return value === expected;
  return Array.isArray(value) && value.some((item) => item === expected);
}

function unexpired(exp: unknown, now: Date): boolean {
  return typeof exp === 'number' && Number.isFinite(exp) && exp * 1000 > now.getTime();
}

function activeNotBefore(nbf: unknown, now: Date): boolean {
  if (nbf === undefined) return true;
  return typeof nbf === 'number' && Number.isFinite(nbf) && nbf * 1000 <= now.getTime();
}

function safeClaim(value: unknown): string | null {
  if (typeof value !== 'string' || !value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

/**
 * Verify a Supabase access token with the project JWKS.
 * ES256 / P-256 public keys only. Shared-secret keys are ignored.
 * Returns null on any failure. The token is not included in errors.
 */
export async function verifyEs256AccessToken(
  token: string,
  options: { jwks: Jwks; issuer: string; audience: string; now: Date },
): Promise<VerifiedAccessToken | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const header = decodeJson(parts[0]);
    const payload = decodeJson(parts[1]);
    if (!isRecord(header) || !isRecord(payload)) return null;
    if (header.alg !== accessTokenAlgorithm) return null;
    if (header.crit !== undefined) return null;
    if (header.typ !== undefined && header.typ !== 'JWT') return null;
    if (header.kid !== undefined && typeof header.kid !== 'string') return null;
    const signature = base64UrlDecode(parts[2]);
    if (signature.byteLength !== 64) return null;
    const key = selectKey(options.jwks, typeof header.kid === 'string' ? header.kid : undefined);
    if (!key) return null;
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      { kty: 'EC', crv: 'P-256', x: key.x, y: key.y, alg: accessTokenAlgorithm, ext: true },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      bytesCopy(signature),
      bytesCopy(signingInput),
    );
    if (!valid) return null;
    if (payload.iss !== options.issuer) return null;
    if (!audienceMatches(payload.aud, options.audience)) return null;
    if (!unexpired(payload.exp, options.now)) return null;
    if (!activeNotBefore(payload.nbf, options.now)) return null;
    const sub = safeClaim(payload.sub);
    if (!sub) return null;
    const clientClaim = payload.client_id;
    const clientId = clientClaim === undefined || clientClaim === null ? null : safeClaim(clientClaim);
    if (clientClaim !== undefined && clientClaim !== null && clientId === null) return null;
    return { sub, clientId };
  } catch {
    return null;
  }
}
