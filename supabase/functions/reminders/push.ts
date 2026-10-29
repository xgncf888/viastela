import type { PushMessage } from './handler.ts';

export type VapidKeys = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

const RECORD_SIZE = 4096;
const PKCS8_PREFIX = Uint8Array.from([
  0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
  0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
]);

/** A copy backed by a fresh ArrayBuffer. Web Crypto rejects ArrayBufferLike views. */
function owned(value: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new ArrayBuffer(value.byteLength);
  new Uint8Array(copy).set(value);
  return new Uint8Array(copy);
}

function concat(parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const copy = new ArrayBuffer(length);
  const out = new Uint8Array(copy);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function text(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function base64UrlJson(value: Record<string, string | number>): string {
  return bytesToBase64Url(text(JSON.stringify(value)));
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey('raw', owned(ikm), 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: owned(salt), info: owned(info) },
    key,
    length * 8,
  );
  return owned(new Uint8Array(bits));
}

async function vapidJwt(audience: string, subject: string, privateKey: Uint8Array, publicKey: string): Promise<string> {
  const header = base64UrlJson({ typ: 'JWT', alg: 'ES256' });
  const body = base64UrlJson({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: subject });
  const pkcs8 = privateKey.length === 32 ? concat([PKCS8_PREFIX, privateKey]) : owned(privateKey);
  const key = await crypto.subtle.importKey('pkcs8', pkcs8, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, owned(text(`${header}.${body}`))),
  );
  return `${header}.${body}.${bytesToBase64Url(signature)}`;
}

async function encryptPayload(uaPublic: Uint8Array, authSecret: Uint8Array, payload: Uint8Array): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const local = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const localPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const remote = await crypto.subtle.importKey('raw', owned(uaPublic), { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: remote }, local.privateKey, 256),
  );
  const ikm = await hkdf(authSecret, shared, concat([text('WebPush: info\0'), uaPublic, localPublic]), 32);
  const contentKey = await hkdf(salt, ikm, text('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, text('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', owned(contentKey), 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: owned(nonce) }, aes, concat([payload, Uint8Array.of(2)])),
  );
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, RECORD_SIZE, false);
  return concat([salt, recordSize, Uint8Array.of(localPublic.length), localPublic, ciphertext]);
}

/**
 * Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID). Errors stay generic:
 * the endpoint and the keys are not put on the Error or written to a log.
 */
export async function sendWebPush(
  message: PushMessage,
  vapid: VapidKeys,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: number }> {
  let endpoint: URL;
  try {
    endpoint = new URL(message.endpoint);
  } catch {
    throw new Error('push failed');
  }
  if (endpoint.protocol !== 'https:') throw new Error('push failed');
  if (!vapid.subject.startsWith('mailto:') && !vapid.subject.startsWith('https:')) throw new Error('push failed');
  const body = await encryptPayload(
    base64UrlToBytes(message.p256dh),
    base64UrlToBytes(message.auth),
    text(JSON.stringify(message.payload)),
  );
  const publicKey = bytesToBase64Url(base64UrlToBytes(vapid.publicKey));
  const jwt = await vapidJwt(endpoint.origin, vapid.subject, base64UrlToBytes(vapid.privateKey), publicKey);
  let response: Response;
  try {
    response = await fetchImpl(message.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${publicKey}`,
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '86400',
      },
      body: owned(body),
    });
  } catch {
    throw new Error('push failed');
  }
  return { status: response.status };
}
