import {
  accessTokenAudience,
  projectUrls,
  verifyEs256AccessToken,
  wwwAuthenticate,
  type Jwks,
  type PublicJwk,
} from './jwt.ts';
import { handleMcp, type McpDependencies } from './handler.ts';

const urls = projectUrls('https://project.example');
const now = new Date('2026-10-29T07:00:00.000Z');
const nowSeconds = Math.floor(now.getTime() / 1000);

function eq(actual: unknown, expected: unknown, message?: string): void {
  if (Object.is(actual, expected)) return;
  if (JSON.stringify(actual) === JSON.stringify(expected)) return;
  const prefix = message ? `${message}: ` : '';
  throw new Error(`${prefix}${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
}

function ok(value: unknown, message?: string): void {
  if (!value) throw new Error(message ?? 'expected a truthy value');
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

async function es256Pair(): Promise<{ privateKey: CryptoKey; jwk: PublicJwk }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const exported = await crypto.subtle.exportKey('jwk', pair.publicKey);
  if (typeof exported.x !== 'string' || typeof exported.y !== 'string') throw new Error('missing public key');
  return {
    privateKey: pair.privateKey,
    jwk: { kty: 'EC', crv: 'P-256', alg: 'ES256', use: 'sig', kid: 'test-es256', x: exported.x, y: exported.y },
  };
}

async function signEs256(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
  header: Record<string, unknown> = { alg: 'ES256', typ: 'JWT', kid: 'test-es256' },
): Promise<string> {
  const encodedHeader = base64UrlEncodeJson(header);
  const encodedPayload = base64UrlEncodeJson(payload);
  const signature = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  ));
  return `${encodedHeader}.${encodedPayload}.${base64UrlEncode(signature)}`;
}

function claims(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    iss: urls.issuer,
    aud: accessTokenAudience,
    exp: nowSeconds + 600,
    iat: nowSeconds,
    sub: 'user-1',
    client_id: 'client-1',
    email: 'person@example.com',
    role: 'authenticated',
    session_id: 'session-1',
    ...overrides,
  };
}

function deps(jwks: Jwks): McpDependencies {
  return { urls, now: () => now, jwks: () => Promise.resolve(jwks) };
}

function mcpPost(body: unknown, token?: string, accept = 'application/json, text/event-stream'): Request {
  const headers = new Headers({ accept, 'content-type': 'application/json' });
  if (token) headers.set('authorization', `Bearer ${token}`);
  return new Request(urls.resource, { method: 'POST', headers, body: JSON.stringify(body) });
}

Deno.test('a request without a bearer is 401 and points at protected-resource metadata', async () => {
  const response = await handleMcp(new Request(urls.resource, { method: 'POST' }), deps({ keys: [] }));
  eq(response.status, 401);
  eq(response.headers.get('www-authenticate'), wwwAuthenticate(urls.metadata));
  eq(await response.json(), { error: 'invalid_token' });
});

Deno.test('protected-resource metadata names the authorization server derived from SUPABASE_URL', async () => {
  const response = await handleMcp(new Request(urls.metadata), deps({ keys: [] }));
  eq(response.status, 200);
  eq(await response.json(), {
    resource: urls.resource,
    authorization_servers: [urls.issuer],
    bearer_methods_supported: ['header'],
  });
  eq(urls.issuer, 'https://project.example/auth/v1');
  eq(urls.jwks, 'https://project.example/auth/v1/.well-known/jwks.json');
  eq(urls.resource.includes('project-ref'), false);

  const inserted = new URL('/.well-known/oauth-protected-resource/functions/v1/mcp', urls.issuer);
  const alt = await handleMcp(new Request(inserted), deps({ keys: [] }));
  eq(alt.status, 200);
  eq((await alt.json()).authorization_servers, [urls.issuer]);
});

Deno.test('whoami returns only sub and client_id from a locally signed ES256 token', async () => {
  const { privateKey, jwk } = await es256Pair();
  const token = await signEs256(privateKey, claims());
  const calls: unknown[][] = [];
  const levels = ['log', 'info', 'warn', 'error', 'debug'] as const;
  const original = Object.fromEntries(levels.map((level) => [level, console[level]]));
  for (const level of levels) {
    console[level] = (...args: unknown[]) => {
      calls.push(args);
    };
  }
  try {
    const response = await handleMcp(
      mcpPost({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami', arguments: {} } }, token),
      deps({ keys: [jwk, { kty: 'oct', alg: 'HS256', kid: 'hmac', use: 'sig' } as PublicJwk] }),
    );
    eq(response.status, 200);
    const body = await response.json();
    eq(body.result.structuredContent, { sub: 'user-1', client_id: 'client-1' });
    eq(JSON.parse(body.result.content[0].text), { sub: 'user-1', client_id: 'client-1' });
    eq(Object.keys(body.result.structuredContent), ['sub', 'client_id']);
    const serialized = JSON.stringify(body);
    eq(serialized.includes('person@example.com'), false);
    eq(serialized.includes(token), false);
    eq(calls.length, 0);
  } finally {
    for (const level of levels) console[level] = original[level];
  }
});

Deno.test('whoami returns a null client_id when the claim is absent', async () => {
  const { privateKey, jwk } = await es256Pair();
  const payload = claims();
  delete payload.client_id;
  const token = await signEs256(privateKey, payload);
  const response = await handleMcp(
    mcpPost({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'whoami' } }, token),
    deps({ keys: [jwk] }),
  );
  const body = await response.json();
  eq(body.result.structuredContent, { sub: 'user-1', client_id: null });
});

Deno.test('verification failures are 401, including shared-secret tokens', async () => {
  const { privateKey, jwk } = await es256Pair();
  const secret = crypto.getRandomValues(new Uint8Array(32));
  const hmac = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const encodedHeader = base64UrlEncodeJson({ alg: 'HS256', typ: 'JWT', kid: 'hmac' });
  const encodedPayload = base64UrlEncodeJson(claims());
  const mac = new Uint8Array(await crypto.subtle.sign(
    'HMAC',
    hmac,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  ));
  const hmacToken = `${encodedHeader}.${encodedPayload}.${base64UrlEncode(mac)}`;
  const jwks = {
    keys: [jwk, { kty: 'oct', kid: 'hmac', alg: 'HS256', use: 'sig', k: base64UrlEncode(secret) }],
  } as Jwks;
  const other = await es256Pair();
  const cases = [
    'not-a-token',
    hmacToken,
    await signEs256(other.privateKey, claims()),
    await signEs256(privateKey, claims({ exp: nowSeconds - 10 })),
    await signEs256(privateKey, claims({ iss: 'https://other.example/auth/v1' })),
    await signEs256(privateKey, claims({ aud: 'https://project.example/functions/v1/mcp' })),
    await signEs256(privateKey, claims(), { alg: 'none', typ: 'JWT', kid: 'test-es256' }),
  ];
  for (const token of cases) {
    const direct = await verifyEs256AccessToken(token, { jwks, issuer: urls.issuer, audience: accessTokenAudience, now });
    eq(direct, null, 'verifier');
    const response = await handleMcp(
      mcpPost({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami' } }, token),
      deps(jwks),
    );
    eq(response.status, 401, 'status');
    eq(response.headers.get('www-authenticate'), wwwAuthenticate(urls.metadata));
    const text = await response.text();
    eq(text.includes(token), false);
    eq(text.includes('person@example.com'), false);
  }
});

Deno.test('a JWKS lookup failure is 401 with the same header', async () => {
  const response = await handleMcp(
    mcpPost({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'whoami' } }, 'a.b.c'),
    { urls, now: () => now, jwks: () => Promise.reject(new Error('jwks unavailable')) },
  );
  eq(response.status, 401);
  eq(response.headers.get('www-authenticate'), wwwAuthenticate(urls.metadata));
  eq(await response.json(), { error: 'invalid_token' });
});

Deno.test('the function source does not read a privileged key or log', async () => {
  const files = ['./index.ts', './handler.ts', './jwt.ts'];
  let source = '';
  for (const file of files) source += await Deno.readTextFile(new URL(file, import.meta.url));
  ok(!source.includes('SUPABASE_SERVICE_ROLE_KEY'));
  ok(!source.includes('JWT_SECRET'));
  ok(!source.includes('HMAC'));
  ok(!source.includes('service_role'));
  ok(!/console\./.test(source));
});
