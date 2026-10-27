/**
 * Account deletion, without the Deno runtime or the service key.
 * The caller is whoever `getUser` returns for the bearer token.
 * The body, query string, and any other header are not a user id.
 */

const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

export type DeleteAccountUser = {
  id: string;
};

export type DeleteAccountDependencies = {
  getUser: (jwt: string) => Promise<DeleteAccountUser | null>;
  deleteUser: (userId: string) => Promise<void>;
};

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1];
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
}

function json(body: Record<string, string | boolean>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

export async function handleDeleteAccount(
  request: Request,
  dependencies: DeleteAccountDependencies,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const jwt = bearerToken(request.headers.get('Authorization'));
  if (!jwt) return json({ error: 'unauthorized' }, 401);

  let user: DeleteAccountUser | null;
  try {
    user = await dependencies.getUser(jwt);
  } catch {
    return json({ error: 'unauthorized' }, 401);
  }
  if (!user?.id) return json({ error: 'unauthorized' }, 401);

  try {
    await dependencies.deleteUser(user.id);
  } catch {
    return json({ error: 'delete_failed' }, 500);
  }
  return json({ ok: true }, 200);
}
