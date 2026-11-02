const CUSTOM_URL_KEY = 'viastela.custom_supabase_url';
const CUSTOM_ANON_KEY = 'viastela.custom_supabase_anon_key';

function readCustomEnv(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const val = localStorage.getItem(key)?.trim();
    return val ? val : null;
  } catch {
    return null;
  }
}

export function saveCustomSupabaseEnv(url: string, anonKey: string): void {
  if (typeof localStorage === 'undefined') return;
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();
  if (cleanUrl && cleanKey) {
    localStorage.setItem(CUSTOM_URL_KEY, cleanUrl);
    localStorage.setItem(CUSTOM_ANON_KEY, cleanKey);
  } else {
    localStorage.removeItem(CUSTOM_URL_KEY);
    localStorage.removeItem(CUSTOM_ANON_KEY);
  }
}

export function readCustomSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = readCustomEnv(CUSTOM_URL_KEY);
  const anonKey = readCustomEnv(CUSTOM_ANON_KEY);
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function isPlaceholderLocalSupabaseUrl(): boolean {
  if (readCustomSupabaseConfig()) return false;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  return url.includes('127.0.0.1:54321') || url.includes('localhost:54321');
}

export function isSupabaseConfigured(): boolean {
  if (readCustomSupabaseConfig()) return true;
  return Boolean(
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() && process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/**
 * Public VAPID key baked in at build time from `EXPO_PUBLIC_VAPID_PUBLIC_KEY`.
 * Playwright can set `__VIASTELA_VAPID_PUBLIC_KEY__` when the export was built
 * without that variable. The value is public; the private key never reaches the client.
 */
export function vapidPublicKey(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY?.trim();
  if (fromEnv) return fromEnv;
  const injected = (globalThis as { __VIASTELA_VAPID_PUBLIC_KEY__?: unknown }).__VIASTELA_VAPID_PUBLIC_KEY__;
  if (typeof injected !== 'string') return null;
  const trimmed = injected.trim();
  return trimmed || null;
}

export function requireSupabaseEnv(): { url: string; anonKey: string } {
  const custom = readCustomSupabaseConfig();
  if (custom) return custom;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error('Supabase is not configured');
  }
  return { url, anonKey };
}
