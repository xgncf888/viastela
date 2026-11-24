import { validateSupabaseConfig } from '@/core/supabase-config';

function readCustomEnv(key: string): string | null {
  if (!__DEV__) return null;
  try {
    if (typeof localStorage === 'undefined') return null;
    const val = localStorage.getItem(key)?.trim();
    return val ? val : null;
  } catch {
    return null;
  }
}

/** Raw saved fields for the dev form, including values the client must ignore. */
export function readStoredSupabaseDraft(): { url: string; anonKey: string } {
  if (!__DEV__) return { url: '', anonKey: '' };
  return {
    url: readCustomEnv('viastela.custom_supabase_url') ?? '',
    anonKey: readCustomEnv('viastela.custom_supabase_anon_key') ?? '',
  };
}

/**
 * Valid dev-only override. Production builds and invalid stored values are ignored
 * and are not deleted.
 */
export function readCustomSupabaseConfig(): { url: string; anonKey: string } | null {
  if (!__DEV__) return null;
  const url = readCustomEnv('viastela.custom_supabase_url');
  const anonKey = readCustomEnv('viastela.custom_supabase_anon_key');
  if (!url || !anonKey) return null;
  const verdict = validateSupabaseConfig(url, anonKey);
  if (!verdict.ok) return null;
  return { url: verdict.url, anonKey: verdict.anonKey };
}

/** Persists a validated dev override. Invalid input is left untouched. */
export function saveCustomSupabaseEnv(url: string, anonKey: string): boolean {
  if (!__DEV__ || typeof localStorage === 'undefined') return false;
  const verdict = validateSupabaseConfig(url, anonKey);
  if (!verdict.ok) return false;
  localStorage.setItem('viastela.custom_supabase_url', verdict.url);
  localStorage.setItem('viastela.custom_supabase_anon_key', verdict.anonKey);
  return true;
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

export function configuredSupabaseUrl(): string {
  const custom = readCustomSupabaseConfig();
  if (custom) return custom.url;
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  return url ? url : 'http://127.0.0.1:54321';
}
