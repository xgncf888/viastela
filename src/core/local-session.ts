/**
 * The fixed device-only user. It is never a cloud account and must never be
 * sent on a remote request.
 */
export const LOCAL_OFFLINE_USER_ID = '00000000-0000-4000-8000-000000000001';
export const LOCAL_OFFLINE_EMAIL = 'local@device.offline';

type StoredUser = { id?: string; email?: string | null };

export function isLocalOfflineUser(userId: string | null | undefined, email?: string | null): boolean {
  if (userId === LOCAL_OFFLINE_USER_ID) return true;
  return email === LOCAL_OFFLINE_EMAIL;
}

/**
 * Storage key the Supabase client uses for the current project.
 * `@supabase/supabase-js` derives it as `sb-${hostname.split('.')[0]}-auth-token`.
 */
export function supabaseAuthStorageKey(supabaseUrl: string): string {
  let label = '127';
  try {
    const hostname = new URL(supabaseUrl.trim()).hostname;
    const first = hostname.split('.')[0];
    if (first) label = first;
  } catch {
    label = '127';
  }
  return `sb-${label}-auth-token`;
}

function readStoredUser(raw: string | null | undefined): StoredUser | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { user?: StoredUser } | null;
    const user = parsed?.user;
    if (!user || typeof user.id !== 'string' || user.id.length === 0) return null;
    return user;
  } catch {
    return null;
  }
}

/** True when the stored blob is the device-only user, not a cloud account. */
export function storedTokenIsLocalUser(raw: string | null | undefined): boolean {
  const user = readStoredUser(raw);
  if (!user) return false;
  return isLocalOfflineUser(user.id, user.email);
}

/**
 * True when `raw` is a cloud session. The device-only user does not count.
 * Callers must pass the value stored under `supabaseAuthStorageKey(configuredUrl)`.
 */
export function storedTokenIsRemoteUser(raw: string | null | undefined): boolean {
  const user = readStoredUser(raw);
  if (!user?.id) return false;
  return !isLocalOfflineUser(user.id, user.email);
}

export function hasStoredRemoteSession(
  readItem: (key: string) => string | null,
  supabaseUrl: string,
): boolean {
  return storedTokenIsRemoteUser(readItem(supabaseAuthStorageKey(supabaseUrl)));
}
