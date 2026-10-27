export function isSupabaseConfigured(): boolean {
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
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    throw new Error('Supabase is not configured');
  }
  return { url, anonKey };
}
