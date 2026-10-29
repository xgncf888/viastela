import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import test from 'node:test';

import { findingsInText, scanRepository } from './lint-secrets.mjs';

const privilegedRole = ['service', 'role'].join('_');

function token(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = Buffer.from('signature').toString('base64url');
  return `${header}.${body}.${signature}`;
}

function vapidPrivate() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return privateKey.export({ format: 'jwk' }).d;
}

function rules(findings) {
  return findings.map((item) => item.rule);
}

test('the tracked tree has no credentials', () => {
  const findings = scanRepository();
  assert.deepEqual(
    findings.map((item) => `${item.file}:${item.line}: ${item.message}`),
    [],
  );
});

test('a privileged JWT fails and the public demo anon JWT does not', () => {
  const bad = token({ iss: 'test', role: privilegedRole });
  assert.ok(rules(findingsInText('notes.txt', `key=${bad}`)).includes('service-role-jwt'));

  const anon = token({ iss: 'supabase-demo', role: 'anon', exp: 1983812996 });
  assert.deepEqual(rules(findingsInText('notes.txt', anon)), []);

  const demo =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
  assert.deepEqual(rules(findingsInText('.github/workflows/ci.yml', demo)), []);
});

test('a private key block fails and a public key does not', () => {
  const marker = `-----BEGIN ${'RSA'} ${'PRIVATE'} KEY-----`;
  const end = `-----END ${'RSA'} ${'PRIVATE'} KEY-----`;
  assert.ok(rules(findingsInText('key.pem', `${marker}\nMIIE\n${end}\n`)).includes('private-key'));

  const pub = `-----BEGIN ${'PUBLIC'} KEY-----\nMIIB\n-----END ${'PUBLIC'} KEY-----`;
  assert.deepEqual(rules(findingsInText('cert.pem', pub)), []);
  assert.deepEqual(rules(findingsInText('id_rsa', 'not a block')), ['private-key']);
});

test('env files fail and the example file allows only empty values and a loopback URL', () => {
  assert.deepEqual(rules(findingsInText('.env', 'FOO=\n')), ['env-file']);
  assert.deepEqual(rules(findingsInText('supabase/.env.local', '')), ['env-file']);

  const example = [
    'EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY=',
    '# EXPO_PUBLIC_EAS_UPDATE_URL=https://u.expo.dev/<project-uuid>',
  ].join('\n');
  assert.deepEqual(findingsInText('.env.example', example), []);

  const hosted = findingsInText('.env.example', 'EXPO_PUBLIC_SUPABASE_URL=https://example.supabase.co\n');
  assert.deepEqual(rules(hosted), ['example-value']);
});

test('Finnhub and VAPID names are allowed and key values are not', () => {
  assert.deepEqual(findingsInText('index.ts', "const apiKey = Deno.env.get('FINNHUB_API_KEY');"), []);
  assert.deepEqual(findingsInText('sw.js', 'const key = Deno.env.get("VAPID_PRIVATE_KEY");'), []);

  const finnhub = 'c'.repeat(20);
  assert.ok(
    rules(findingsInText('index.ts', `const FINNHUB_API_KEY = '${finnhub}';`)).includes('finnhub-key'),
  );
  assert.deepEqual(
    findingsInText(
      'providers.ts',
      "const apiKey = 'fnk_test_918273';\nconst provider = new FinnhubQuoteProvider(apiKey);\nconst FINNHUB_QUOTE_URL = 'https://finnhub.io/api/v1/quote';\n",
    ),
    [],
  );

  const privateKey = vapidPrivate();
  assert.equal(privateKey.length, 43);
  assert.ok(
    rules(findingsInText('sw.js', `const VAPID_PRIVATE_KEY = '${privateKey}';`)).includes('vapid-private-key'),
  );
  const publicKey = `B${'A'.repeat(86)}`;
  assert.deepEqual(findingsInText('sw.js', `const VAPID_PUBLIC_KEY = '${publicKey}';`), []);
});

test('a Supabase secret key value fails', () => {
  const value = `${['sb', 'secret', ''].join('_')}${'c'.repeat(20)}`;
  assert.ok(rules(findingsInText('notes.txt', `token=${value}`)).includes('supabase-secret-key'));
});
