import { spawnSync } from 'child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'fs';
import { expect, test } from '@jest/globals';
import { extname, join, resolve } from 'path';

import {
  deleteAccountAllowedOriginsEnv,
  deleteAccountLocalOrigins,
  deleteAccountPreviewExample,
  deleteAccountProductionOrigin,
} from './delete-account-origin';
import {
  handleDeleteAccount,
  unavailableDeleteAccountResponse,
  type DeleteAccountDependencies,
} from '../../supabase/functions/delete-account/handler';

const caller = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const nowMs = 1_700_000_000_000;
const root = resolve(process.cwd());

function freshAmr(at = nowMs): { method: string; timestamp: number }[] {
  return [{ method: 'otp', timestamp: Math.floor(at / 1000) }];
}

function staleAmr(): { method: string; timestamp: number }[] {
  return [{ method: 'otp', timestamp: Math.floor((nowMs - 10 * 60 * 1000 - 1000) / 1000) }];
}

declare const process: { cwd(): string };
const roleName = ['service', 'role'].join('_');
const envName = ['SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');

function request(headers: Record<string, string> = {}, body?: string): Request {
  return new Request(`https://example.test/delete-account?user_id=${other}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body ?? JSON.stringify({ user_id: other, userId: other }),
  });
}

function deps(overrides: Partial<DeleteAccountDependencies> = {}): {
  dependencies: DeleteAccountDependencies;
  deleted: string[];
  seenTokens: string[];
} {
  const deleted: string[] = [];
  const seenTokens: string[] = [];
  return {
    deleted,
    seenTokens,
    dependencies: {
      now: () => nowMs,
      allowedOrigins: [deleteAccountProductionOrigin],
      async getUser(jwt) {
        seenTokens.push(jwt);
        return { id: caller, amr: freshAmr() };
      },
      async deleteUser(userId) {
        deleted.push(userId);
      },
      ...overrides,
    },
  };
}

async function captureLogs(run: () => Promise<void>): Promise<string> {
  const lines: string[] = [];
  const methods = ['log', 'info', 'warn', 'error', 'debug'] as const;
  const originals = methods.map((method) => console[method]);
  for (const method of methods) {
    console[method] = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };
  }
  try {
    await run();
  } finally {
    methods.forEach((method, index) => {
      console[method] = originals[index];
    });
  }
  return lines.join('\n');
}

test('no JWT is a 401 and does not delete anyone', async () => {
  const missing = deps();
  const missingResponse = await handleDeleteAccount(request(), missing.dependencies);
  expect(missingResponse.status).toBe(401);
  expect(missing.deleted).toEqual([]);
  expect(missing.seenTokens).toEqual([]);

  const blank = deps();
  const blankResponse = await handleDeleteAccount(request({ Authorization: 'Bearer ' }), blank.dependencies);
  expect(blankResponse.status).toBe(401);
  expect(blank.deleted).toEqual([]);

  const rejected = deps({
    async getUser() {
      return null;
    },
  });
  const rejectedResponse = await handleDeleteAccount(
    request({ Authorization: 'Bearer not-a-user' }),
    rejected.dependencies,
  );
  expect(rejectedResponse.status).toBe(401);
  expect(rejected.deleted).toEqual([]);
  expect(await rejectedResponse.text()).not.toContain('not-a-user');
});

test('user A cannot delete user B', async () => {
  const { dependencies, deleted, seenTokens } = deps();
  const logs = await captureLogs(async () => {
    const response = await handleDeleteAccount(
      request({ Authorization: 'Bearer caller-token', 'x-user-id': other }),
      dependencies,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
  expect(seenTokens).toEqual(['caller-token']);
  expect(deleted).toEqual([caller]);
  expect(deleted).not.toContain(other);
  expect(logs).not.toContain(roleName);
  expect(logs).not.toContain(envName);
});

test('empty, forged, and expired tokens are 401 and do not delete', async () => {
  const empty = deps();
  const emptyResponse = await handleDeleteAccount(request({ Authorization: 'Bearer ' }), empty.dependencies);
  expect(emptyResponse.status).toBe(401);
  expect(empty.deleted).toEqual([]);

  const forged = deps({
    async getUser() {
      throw new Error('bad signature');
    },
  });
  const forgedResponse = await handleDeleteAccount(
    request({ Authorization: 'Bearer forged-token' }),
    forged.dependencies,
  );
  expect(forgedResponse.status).toBe(401);
  expect(forged.deleted).toEqual([]);
  expect(await forgedResponse.text()).not.toContain('forged-token');

  const expired = deps({
    async getUser() {
      return null;
    },
  });
  const expiredResponse = await handleDeleteAccount(
    request({ Authorization: 'Bearer expired-token' }),
    expired.dependencies,
  );
  expect(expiredResponse.status).toBe(401);
  expect(expired.deleted).toEqual([]);
  expect(await expiredResponse.text()).not.toContain('expired-token');
});

test('a fresh amr deletes and a stale amr returns reauth_required without deleting', async () => {
  const fresh = deps();
  const freshResponse = await handleDeleteAccount(
    request({ Authorization: 'Bearer caller-token', Origin: deleteAccountProductionOrigin }),
    fresh.dependencies,
  );
  expect(freshResponse.status).toBe(200);
  expect(fresh.deleted).toEqual([caller]);
  expect(freshResponse.headers.get('access-control-allow-origin')).toBe(deleteAccountProductionOrigin);
  expect(freshResponse.headers.get('vary')).toBe('Origin');

  const stale = deps({
    async getUser(jwt) {
      expect(jwt).toBe('caller-token');
      return { id: caller, amr: staleAmr() };
    },
  });
  const staleResponse = await handleDeleteAccount(
    request({ Authorization: 'Bearer caller-token' }),
    stale.dependencies,
  );
  expect(staleResponse.status).toBe(403);
  expect(await staleResponse.json()).toEqual({ error: 'reauth_required' });
  expect(stale.deleted).toEqual([]);
});

test('a refresh-token entry does not make an older sign-in recent', async () => {
  const { dependencies, deleted } = deps({
    async getUser() {
      return {
        id: caller,
        amr: [
          { method: 'otp', timestamp: Math.floor((nowMs - 11 * 60 * 1000) / 1000) },
          { method: 'token_refresh', timestamp: Math.floor(nowMs / 1000) },
        ],
      };
    },
  });
  const response = await handleDeleteAccount(request({ Authorization: 'Bearer caller-token' }), dependencies);
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: 'reauth_required' });
  expect(deleted).toEqual([]);
});

test('an allowed origin is echoed and a missing Origin still deletes without an allow header', async () => {
  const preview = deps({ allowedOrigins: [] });
  const previewResponse = await handleDeleteAccount(
    request({ Authorization: 'Bearer caller-token', Origin: deleteAccountPreviewExample }),
    preview.dependencies,
  );
  expect(previewResponse.status).toBe(200);
  expect(preview.deleted).toEqual([caller]);
  expect(previewResponse.headers.get('access-control-allow-origin')).toBe(deleteAccountPreviewExample);
  expect(previewResponse.headers.get('vary')).toBe('Origin');

  const native = deps();
  const nativeResponse = await handleDeleteAccount(
    request({ Authorization: 'Bearer caller-token' }),
    native.dependencies,
  );
  expect(nativeResponse.status).toBe(200);
  expect(native.deleted).toEqual([caller]);
  expect(nativeResponse.headers.get('access-control-allow-origin')).toBeNull();
  expect(nativeResponse.headers.get('vary')).toBe('Origin');
});

test('a rejected Origin, including the literal null, gets no allow header and does not delete', async () => {
  for (const origin of ['https://evil.example', 'null']) {
    const { dependencies, deleted, seenTokens } = deps();
    const response = await handleDeleteAccount(
      request({ Authorization: 'Bearer caller-token', Origin: origin }),
      dependencies,
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'origin_not_allowed' });
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(response.headers.get('vary')).toBe('Origin');
    expect(deleted).toEqual([]);
    expect(seenTokens).toEqual([]);
  }

  const sneaky = deps();
  const sneakyResponse = await handleDeleteAccount(
    request({
      Authorization: 'Bearer caller-token',
      Origin: 'https://viastela.vercel.app.evil.example',
    }),
    sneaky.dependencies,
  );
  expect(sneakyResponse.headers.get('access-control-allow-origin')).toBeNull();
  expect(sneaky.deleted).toEqual([]);

  const commitPreview = deps({ allowedOrigins: [] });
  const commitResponse = await handleDeleteAccount(
    request({
      Authorization: 'Bearer caller-token',
      Origin: 'https://viastela-9f3a1c2-xgncf888.vercel.app',
    }),
    commitPreview.dependencies,
  );
  expect(commitResponse.status).toBe(403);
  expect(commitPreview.deleted).toEqual([]);
});

test('localhost is allowed only when the env list includes it', async () => {
  const blocked = deps({ allowedOrigins: [deleteAccountProductionOrigin] });
  const blockedResponse = await handleDeleteAccount(
    request({ Authorization: 'Bearer caller-token', Origin: deleteAccountLocalOrigins[0] }),
    blocked.dependencies,
  );
  expect(blockedResponse.status).toBe(403);
  expect(blocked.deleted).toEqual([]);
  expect(blockedResponse.headers.get('access-control-allow-origin')).toBeNull();

  const local = deps({ allowedOrigins: deleteAccountLocalOrigins });
  const localResponse = await handleDeleteAccount(
    request({ Authorization: 'Bearer caller-token', Origin: deleteAccountLocalOrigins[1] }),
    local.dependencies,
  );
  expect(localResponse.status).toBe(200);
  expect(localResponse.headers.get('access-control-allow-origin')).toBe(deleteAccountLocalOrigins[1]);
  expect(local.deleted).toEqual([caller]);
});

test('preflight echoes an allowed origin and rejects a disallowed one', async () => {
  const allowed = await handleDeleteAccount(
    new Request('https://example.test/delete-account', {
      method: 'OPTIONS',
      headers: { Origin: deleteAccountProductionOrigin },
    }),
    deps().dependencies,
  );
  expect(allowed.status).toBe(204);
  expect(allowed.headers.get('access-control-allow-origin')).toBe(deleteAccountProductionOrigin);
  expect(allowed.headers.get('vary')).toBe('Origin');
  expect(allowed.headers.get('access-control-allow-methods')).toContain('POST');

  const { dependencies, deleted } = deps();
  const rejected = await handleDeleteAccount(
    new Request('https://example.test/delete-account', {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil.example' },
    }),
    dependencies,
  );
  expect(rejected.status).toBe(403);
  expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
  expect(rejected.headers.get('vary')).toBe('Origin');
  expect(deleted).toEqual([]);

  const native = await handleDeleteAccount(
    new Request('https://example.test/delete-account', { method: 'OPTIONS' }),
    deps().dependencies,
  );
  expect(native.status).toBe(204);
  expect(native.headers.get('access-control-allow-origin')).toBeNull();
});

test('a missing runtime env still uses the same CORS rules', async () => {
  const allowed = unavailableDeleteAccountResponse(
    new Request('https://example.test/delete-account', {
      method: 'POST',
      headers: { Origin: deleteAccountPreviewExample },
    }),
    [],
  );
  expect(allowed.status).toBe(500);
  expect(await allowed.json()).toEqual({ error: 'unavailable' });
  expect(allowed.headers.get('access-control-allow-origin')).toBe(deleteAccountPreviewExample);
  expect(allowed.headers.get('vary')).toBe('Origin');

  const rejected = unavailableDeleteAccountResponse(
    new Request('https://example.test/delete-account', {
      method: 'POST',
      headers: { Origin: 'https://evil.example' },
    }),
    [deleteAccountProductionOrigin],
  );
  expect(rejected.status).toBe(500);
  expect(rejected.headers.get('access-control-allow-origin')).toBeNull();

  const native = unavailableDeleteAccountResponse(new Request('https://example.test/delete-account'), []);
  expect(native.headers.get('access-control-allow-origin')).toBeNull();
  expect(native.headers.get('vary')).toBe('Origin');
});

test('index reads the allowlist env and attaches amr only after getUser', () => {
  const indexSource = readFileSync(join(root, 'supabase/functions/delete-account/index.ts'), 'utf8');
  expect(deleteAccountAllowedOriginsEnv).toBe('DELETE_ACCOUNT_ALLOWED_ORIGINS');
  expect(indexSource).toContain('Deno.env.get(deleteAccountAllowedOriginsEnv)');
  const verified = indexSource.indexOf('auth.getUser');
  const claim = indexSource.indexOf('amrClaim(');
  expect(verified).toBeGreaterThan(-1);
  expect(claim).toBeGreaterThan(verified);
  expect(indexSource).toContain('unavailableDeleteAccountResponse');
  expect(indexSource).not.toContain("access-control-allow-origin': '*'");
});

const textExtensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.sql',
  '.md',
  '.yml',
  '.yaml',
  '.toml',
  '.json',
  '.example',
  '.txt',
  '.html',
]);
const clientDirectories = ['src', 'app', 'e2e', '.github', 'scripts'];
const secretKeyPattern = new RegExp(`${['sb', 'secret', ''].join('_')}[A-Za-z0-9_-]{16,}`);

type SecretHit = 'privileged-jwt' | 'supabase-secret-key' | 'service-role-literal' | 'service-key-env-name';

function listRepositoryFiles(): string[] {
  const listed = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (listed.status !== 0) throw new Error('could not list repository files');
  return listed.stdout.split('\0').filter(Boolean);
}

function isTextPath(relative: string): boolean {
  const extension = extname(relative);
  if (extension === '') return true;
  return textExtensions.has(extension);
}

function inClientDirectory(relative: string): boolean {
  return clientDirectories.some((directory) => relative.startsWith(`${directory}/`));
}

function hitsInText(text: string, relative: string): SecretHit[] {
  const hits: SecretHit[] = [];
  if (jwtHasForbiddenRole(text)) hits.push('privileged-jwt');
  if (secretKeyPattern.test(text)) hits.push('supabase-secret-key');
  if (inClientDirectory(relative)) {
    if (text.includes(roleName)) hits.push('service-role-literal');
    if (text.includes(envName)) hits.push('service-key-env-name');
  }
  return hits;
}

function scanTextFile(relative: string): SecretHit[] {
  if (!isTextPath(relative)) return [];
  return hitsInText(readFileSync(join(root, relative), 'utf8'), relative);
}

function removeFixture(relative: string) {
  try {
    unlinkSync(join(root, relative));
  } catch {
    // The fixture is already gone.
  }
}

test('every text file is scanned for a privileged-role JWT and a Supabase secret key', () => {
  const hits: string[] = [];
  for (const relative of listRepositoryFiles()) {
    const found = scanTextFile(relative).filter(
      (hit) => hit === 'privileged-jwt' || hit === 'supabase-secret-key',
    );
    if (found.length > 0) hits.push(`${relative}: ${found.join(', ')}`);
  }
  expect(hits).toEqual([]);
});

test('src, app, e2e, .github, and scripts are scanned for the service role literal and the service key env name', () => {
  const indexSource = readFileSync(join(root, 'supabase/functions/delete-account/index.ts'), 'utf8');
  const handlerSource = readFileSync(join(root, 'supabase/functions/delete-account/handler.ts'), 'utf8');
  expect(indexSource.includes(`Deno.env.get('${envName}')`)).toBe(true);
  expect(handlerSource.includes(envName)).toBe(false);
  expect(indexSource.includes('console.')).toBe(false);

  const hits: string[] = [];
  for (const relative of listRepositoryFiles()) {
    if (!inClientDirectory(relative)) continue;
    const found = scanTextFile(relative).filter(
      (hit) => hit === 'service-role-literal' || hit === 'service-key-env-name',
    );
    if (found.length > 0) hits.push(`${relative}: ${found.join(', ')}`);
  }
  expect(hits).toEqual([]);
});

test('a temporary text file containing a fake Supabase secret key is reported', () => {
  const relative = '.secret-scan-fake-key.txt';
  const fake = `${['sb', 'secret', ''].join('_')}${'c'.repeat(40)}`;
  try {
    writeFileSync(join(root, relative), `token=${fake}\n`);
    expect(scanTextFile(relative)).toContain('supabase-secret-key');
  } finally {
    removeFixture(relative);
  }
});

test('a temporary file under a scanned directory containing the service role literal is reported', () => {
  const relative = 'src/core/.secret-scan-role-literal.txt';
  try {
    writeFileSync(join(root, relative), `role=${roleName}\n`);
    expect(inClientDirectory(relative)).toBe(true);
    expect(scanTextFile(relative)).toContain('service-role-literal');
  } finally {
    removeFixture(relative);
  }
});

function jwtHasForbiddenRole(text: string): boolean {
  const tokens = text.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g) ?? [];
  for (const token of tokens) {
    try {
      const payload = JSON.parse(decodeBase64Url(token.split('.')[1])) as { role?: string };
      if (payload.role === roleName) return true;
    } catch {
      // Not a JSON payload. The literal scan covers the role name itself.
    }
  }
  return false;
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
