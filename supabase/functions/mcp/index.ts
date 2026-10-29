import { handleMcp } from './handler.ts';
import { fetchJwks, projectUrls } from './jwt.ts';

/**
 * Read-only MCP spike. Reads SUPABASE_URL and the project JWKS.
 * Does not read a privileged API key or a signing secret.
 * Does not log the request, its headers, or the bearer token.
 */
Deno.serve((request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) return unavailable();
  let urls;
  try {
    urls = projectUrls(supabaseUrl);
  } catch {
    return unavailable();
  }
  return handleMcp(request, {
    urls,
    now: () => new Date(),
    jwks: () => fetchJwks(urls.jwks),
  });
});

function unavailable(): Response {
  return new Response(JSON.stringify({ error: 'unavailable' }), {
    status: 500,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
