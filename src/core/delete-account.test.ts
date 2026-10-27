import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import { expect, test } from '@jest/globals';
import { extname, join, resolve } from 'path';

import { handleDeleteAccount, type DeleteAccountDependencies } from '../../supabase/functions/delete-account/handler';

const caller = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const root = resolve(process.cwd());

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
      async getUser(jwt) {
        seenTokens.push(jwt);
        return { id: caller };
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

test('every file is scanned the same way for a privileged-role key', () => {
  const listed = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (listed.status !== 0) throw new Error('could not list repository files');
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
  const encodedRoleHits: string[] = [];
  for (const relative of listed.stdout.split('\0').filter(Boolean)) {
    const extension = extname(relative);
    if (!textExtensions.has(extension)) continue;
    const text = readFileSync(join(root, relative), 'utf8');
    if (jwtHasForbiddenRole(text)) encodedRoleHits.push(relative);
  }
  if (encodedRoleHits.length > 0) {
    throw new Error(`JWT with the forbidden role found in: ${encodedRoleHits.join(', ')}`);
  }

  const indexSource = readFileSync(join(root, 'supabase/functions/delete-account/index.ts'), 'utf8');
  const handlerSource = readFileSync(join(root, 'supabase/functions/delete-account/handler.ts'), 'utf8');
  if (!indexSource.includes(`Deno.env.get('${envName}')`)) {
    throw new Error('delete-account must read the runtime service key inside the function');
  }
  if (handlerSource.includes(envName) || indexSource.includes('console.')) {
    throw new Error('the service key must stay inside the function entry and must not be logged');
  }
  for (const relative of ['src', 'app', 'e2e', '.github', 'scripts'].flatMap((directory) =>
    listed.stdout
      .split('\0')
      .filter((file: string) => file.startsWith(`${directory}/`) && textExtensions.has(extname(file))),
  )) {
    const text = readFileSync(join(root, relative), 'utf8');
    if (text.includes(envName)) {
      throw new Error(`runtime service key env var leaked into ${relative}`);
    }
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
