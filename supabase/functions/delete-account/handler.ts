/**
 * Account deletion, without the Deno runtime or the service key.
 * The caller is whoever `getUser` returns for the bearer token.
 * The body, query string, and any other header are not a user id.
 *
 * `amr` is the claim from that same token after `getUser` has verified it.
 * `isRecentSignIn` accepts exactly 10:00 and rejects anything older.
 */

// Deno requires the .ts specifier. The app typecheck rejects that extension.
// @ts-ignore TS5097
import { isAllowedDeleteOrigin } from '../../../src/core/delete-account-origin.ts';
// @ts-ignore TS5097
import { isRecentSignIn } from '../../../src/core/recent-sign-in.ts';

const allowHeaders = 'authorization, x-client-info, apikey, content-type';
const allowMethods = 'POST, OPTIONS';

export type DeleteAccountUser = {
  id: string;
  /** Verified JWT `amr` claim. Missing, empty, or stale skips deletion. */
  amr?: unknown;
};

export type DeleteAccountDependencies = {
  getUser: (jwt: string) => Promise<DeleteAccountUser | null>;
  deleteUser: (userId: string) => Promise<void>;
  now?: () => number;
  /** Exact origins from `DELETE_ACCOUNT_ALLOWED_ORIGINS`. Previews use the fixed pattern. */
  allowedOrigins?: readonly string[];
};

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
}

/**
 * `Vary: Origin` on every response. `Access-Control-Allow-Origin` is the
 * request origin only when it is allowlisted. Unlisted origins, including
 * the literal `null`, get no allow header. A missing Origin gets none either.
 */
export function deleteAccountCorsHeaders(
  origin: string | null,
  allowedOrigins: readonly string[],
): Record<string, string> {
  const headers: Record<string, string> = { vary: 'Origin' };
  if (origin && isAllowedDeleteOrigin(origin, allowedOrigins)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-headers'] = allowHeaders;
    headers['access-control-allow-methods'] = allowMethods;
  }
  return headers;
}

export function unavailableDeleteAccountResponse(
  request: Request,
  allowedOrigins: readonly string[],
): Response {
  return json({ error: 'unavailable' }, 500, request, allowedOrigins);
}

function json(
  body: Record<string, string | boolean>,
  status: number,
  request: Request,
  allowedOrigins: readonly string[],
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...deleteAccountCorsHeaders(request.headers.get('Origin'), allowedOrigins),
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function originAllowed(request: Request, allowedOrigins: readonly string[]): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return isAllowedDeleteOrigin(origin, allowedOrigins);
}

export async function handleDeleteAccount(
  request: Request,
  dependencies: DeleteAccountDependencies,
): Promise<Response> {
  const allowedOrigins = dependencies.allowedOrigins ?? [];
  const permitted = originAllowed(request, allowedOrigins);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: permitted ? 204 : 403,
      headers: deleteAccountCorsHeaders(request.headers.get('Origin'), allowedOrigins),
    });
  }
  if (!permitted) {
    return json({ error: 'origin_not_allowed' }, 403, request, allowedOrigins);
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, request, allowedOrigins);
  }

  const jwt = bearerToken(request.headers.get('Authorization'));
  if (!jwt) return json({ error: 'unauthorized' }, 401, request, allowedOrigins);

  let user: DeleteAccountUser | null;
  try {
    user = await dependencies.getUser(jwt);
  } catch {
    return json({ error: 'unauthorized' }, 401, request, allowedOrigins);
  }
  if (!user?.id) return json({ error: 'unauthorized' }, 401, request, allowedOrigins);

  const now = dependencies.now?.() ?? Date.now();
  if (!isRecentSignIn(user.amr, now)) {
    return json({ error: 'reauth_required' }, 403, request, allowedOrigins);
  }

  try {
    await dependencies.deleteUser(user.id);
  } catch {
    return json({ error: 'delete_failed' }, 500, request, allowedOrigins);
  }
  return json({ ok: true }, 200, request, allowedOrigins);
}
