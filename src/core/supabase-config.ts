const SERVICE_ROLE = ['service', 'role'].join('_');
const PUBLISHABLE_PREFIX = 'sb_publishable_';
const SECRET_PREFIX = 'sb_secret_';

export const SUPABASE_URL_ERROR = '只接受 https 地址';
export const SUPABASE_KEY_ERROR = '只接受 sb_publishable_ 或 anon 公钥';
export const SUPABASE_SECRET_KEY_ERROR = `不能使用 ${SECRET_PREFIX} 或 ${SERVICE_ROLE} 密钥`;

export type SupabaseConfigVerdict =
  | { ok: true; url: string; anonKey: string }
  | { ok: false; urlError: string | null; keyError: string | null };

function decodeBase64Url(segment: string): string {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return atob(normalized + pad);
}

function jwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(parts[1])) as { role?: unknown };
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

function keyError(anonKey: string): string | null {
  const key = anonKey.trim();
  if (!key) return SUPABASE_KEY_ERROR;
  if (key.startsWith(SECRET_PREFIX)) return SUPABASE_SECRET_KEY_ERROR;
  const role = jwtRole(key);
  if (role === SERVICE_ROLE) return SUPABASE_SECRET_KEY_ERROR;
  if (key.startsWith(PUBLISHABLE_PREFIX) && key.length > PUBLISHABLE_PREFIX.length) return null;
  if (role === 'anon') return null;
  return SUPABASE_KEY_ERROR;
}

/** https URL, and a publishable or anon key. http, a secret key, and a service role are rejected. */
export function validateSupabaseConfig(url: string, anonKey: string): SupabaseConfigVerdict {
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  let urlError: string | null = null;
  if (!cleanUrl) {
    urlError = SUPABASE_URL_ERROR;
  } else {
    try {
      const parsed = new URL(cleanUrl);
      if (parsed.protocol !== 'https:') urlError = SUPABASE_URL_ERROR;
    } catch {
      urlError = SUPABASE_URL_ERROR;
    }
  }
  const keyProblem = keyError(cleanKey);
  if (urlError || keyProblem) return { ok: false, urlError, keyError: keyProblem };
  return { ok: true, url: cleanUrl, anonKey: cleanKey };
}
