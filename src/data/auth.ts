import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured, saveCustomSupabaseEnv } from '@/config/env';

import { getSupabase, resetSupabaseClient } from './client';
import { currentOrigin, oauthRedirectTo, type OAuthProvider } from './oauth';
import { clearQuoteCache } from './quoteCache';
import { clearRecordOutbox } from './record-outbox';
import { clearServiceWorkerRuntimeCache } from './runtime-cache';

export type AuthSession = {
  userId: string;
  email: string | null;
};

const LOCAL_OFFLINE_USER_ID = '00000000-0000-4000-8000-000000000001';
const LOCAL_OFFLINE_EMAIL = 'local@device.offline';
const localModeListeners = new Set<(session: AuthSession | null) => void>();

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email ?? null };
}

export function isLocalOnlySession(session: AuthSession | null): boolean {
  if (!session) return false;
  return session.userId === LOCAL_OFFLINE_USER_ID || session.email === LOCAL_OFFLINE_EMAIL;
}

export function applyCustomSupabaseConfig(url: string, anonKey: string): void {
  saveCustomSupabaseEnv(url, anonKey);
  resetSupabaseClient();
}

export function enterLocalMode(): AuthSession {
  const win = globalThis as unknown as {
    __VIASTELA_ENTER_LOCAL_MODE__?: () => AuthSession;
  };
  const session: AuthSession = win.__VIASTELA_ENTER_LOCAL_MODE__
    ? win.__VIASTELA_ENTER_LOCAL_MODE__()
    : { userId: LOCAL_OFFLINE_USER_ID, email: LOCAL_OFFLINE_EMAIL };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('viastela.desktop.signed_out');
      localStorage.setItem('viastela.local_mode', '1');
    }
  } catch {
    // Ignore storage errors
  }
  for (const listener of localModeListeners) {
    listener(session);
  }
  return session;
}

export function subscribeAuth(listener: (session: AuthSession | null) => void): () => void {
  localModeListeners.add(listener);
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('viastela.local_mode') === '1') {
      const win = globalThis as unknown as {
        __VIASTELA_ENTER_LOCAL_MODE__?: () => AuthSession;
      };
      const localSess = win.__VIASTELA_ENTER_LOCAL_MODE__
        ? win.__VIASTELA_ENTER_LOCAL_MODE__()
        : { userId: LOCAL_OFFLINE_USER_ID, email: LOCAL_OFFLINE_EMAIL };
      listener(localSess);
      return () => {
        localModeListeners.delete(listener);
      };
    }
  } catch {
    // Fall through to Supabase auth
  }
  if (!isSupabaseConfigured()) {
    listener(null);
    return () => {
      localModeListeners.delete(listener);
    };
  }
  const supabase = getSupabase();
  let active = true;
  void supabase.auth
    .getSession()
    .then(({ data }) => {
      if (active) listener(toAuthSession(data.session));
    })
    .catch(() => {
      if (active) listener(null);
    });
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    listener(toAuthSession(session));
  });
  return () => {
    active = false;
    localModeListeners.delete(listener);
    data.subscription.unsubscribe();
  };
}

export async function requestEmailOtp(email: string): Promise<void> {
  const { error } = await getSupabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) throw error;
}

export async function verifyEmailOtp(email: string, token: string): Promise<void> {
  const { error } = await getSupabase().auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;
}

export async function currentAccessToken(): Promise<string | null> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error || !data.session?.access_token) return null;
  return data.session.access_token;
}

export async function signInWithProvider(provider: OAuthProvider, returnPath?: string): Promise<void> {
  const redirectTo = oauthRedirectTo(currentOrigin(), returnPath);
  const { error } = await getSupabase().auth.signInWithOAuth({
    provider,
    options: redirectTo ? { redirectTo } : undefined,
  });
  if (error) throw error;
}

async function sessionUserId(): Promise<string | null> {
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error) return null;
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Clears this device after `auth.signOut()`. The quote cache clear is in
 * `finally`, so a thrown sign-out still drops that user's prices.
 */
export async function leaveDeviceSession(userId: string | null, authSignOut: () => Promise<void>): Promise<void> {
  try {
    await authSignOut();
  } finally {
    await clearServiceWorkerRuntimeCache();
    if (userId) {
      await clearQuoteCache(userId);
      await clearRecordOutbox(userId);
    } else {
      await clearQuoteCache();
      await clearRecordOutbox();
    }
  }
}

export async function signOut(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('viastela.local_mode') === '1') {
      const win = globalThis as unknown as { __VIASTELA_EXIT_LOCAL_MODE__?: () => void };
      if (win.__VIASTELA_EXIT_LOCAL_MODE__) win.__VIASTELA_EXIT_LOCAL_MODE__();
      else {
        localStorage.setItem('viastela.desktop.signed_out', '1');
        localStorage.removeItem('viastela.local_mode');
      }
      for (const listener of localModeListeners) {
        listener(null);
      }
      return;
    }
  } catch {
    // Fall through
  }
  const userId = await sessionUserId();
  await leaveDeviceSession(userId, async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw error;
  });
}

export async function signOutLocal(): Promise<void> {
  const userId = await sessionUserId();
  await leaveDeviceSession(userId, async () => {
    const { error } = await getSupabase().auth.signOut({ scope: 'local' });
    if (error) throw error;
  });
}
