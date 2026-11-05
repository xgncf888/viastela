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
const LOCAL_MODE_STORAGE_KEY = 'viastela.local_mode';
const localModeListeners = new Set<(session: AuthSession | null) => void>();

let activeAuthSession: AuthSession | null | undefined;

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email ?? null };
}

export function isLocalOnlySession(session: AuthSession | null): boolean {
  if (!session) return false;
  return session.userId === LOCAL_OFFLINE_USER_ID || session.email === LOCAL_OFFLINE_EMAIL;
}

export function isLocalModeSelected(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    if (localStorage.getItem(LOCAL_MODE_STORAGE_KEY) === '1') return true;
    if (
      localStorage.getItem('viastela.desktop.signed_out') !== '1' &&
      typeof window !== 'undefined' &&
      (window.location?.search?.includes('shell=native') ||
        (window.navigator as { standalone?: boolean })?.standalone === true)
    ) {
      localStorage.setItem(LOCAL_MODE_STORAGE_KEY, '1');
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function buildLocalAuthSession(): AuthSession {
  const win = globalThis as unknown as {
    __VIASTELA_ENTER_LOCAL_MODE__?: () => AuthSession;
  };
  return win.__VIASTELA_ENTER_LOCAL_MODE__
    ? win.__VIASTELA_ENTER_LOCAL_MODE__()
    : { userId: LOCAL_OFFLINE_USER_ID, email: LOCAL_OFFLINE_EMAIL };
}

function clearLocalModeFlag(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LOCAL_MODE_STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Returns the authenticated remote Supabase session if and only if:
 * 1. Supabase is configured,
 * 2. The current session is NOT a local-only session (`isLocalOnlySession`), and
 * 3. A valid remote Supabase session exists.
 * Returns `null` in Local Mode or when unauthenticated so data modules never issue remote requests.
 */
export async function getAuthenticatedRemoteSession(): Promise<AuthSession | null> {
  if (!isSupabaseConfigured()) return null;
  if (activeAuthSession !== undefined && isLocalOnlySession(activeAuthSession)) {
    return null;
  }
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error || !data.session) return null;
    const session = toAuthSession(data.session);
    if (!session || isLocalOnlySession(session)) return null;
    return session;
  } catch {
    return null;
  }
}

export async function requireRemoteUserId(): Promise<string> {
  const session = await getAuthenticatedRemoteSession();
  if (!session || isLocalOnlySession(session)) {
    throw new Error('Not signed in');
  }
  return session.userId;
}

export function applyCustomSupabaseConfig(url: string, anonKey: string): void {
  saveCustomSupabaseEnv(url, anonKey);
  resetSupabaseClient();
}

export function enterLocalMode(): AuthSession {
  const session = buildLocalAuthSession();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('viastela.desktop.signed_out');
      localStorage.setItem(LOCAL_MODE_STORAGE_KEY, '1');
    }
  } catch {
    // Ignore storage errors
  }
  activeAuthSession = session;
  for (const listener of localModeListeners) {
    listener(session);
  }
  return session;
}

export function subscribeAuth(listener: (session: AuthSession | null) => void): () => void {
  const emit = (next: AuthSession | null) => {
    activeAuthSession = next;
    listener(next);
  };
  localModeListeners.add(emit);

  if (!isSupabaseConfigured()) {
    emit(isLocalModeSelected() ? buildLocalAuthSession() : null);
    return () => {
      localModeListeners.delete(emit);
    };
  }

  const supabase = getSupabase();
  let active = true;
  void supabase.auth
    .getSession()
    .then(({ data }) => {
      if (!active) return;
      const realSession = toAuthSession(data.session);
      if (realSession && !isLocalOnlySession(realSession)) {
        clearLocalModeFlag();
        emit(realSession);
        return;
      }
      if (isLocalModeSelected()) {
        emit(buildLocalAuthSession());
        return;
      }
      emit(null);
    })
    .catch(() => {
      if (!active) return;
      emit(isLocalModeSelected() ? buildLocalAuthSession() : null);
    });

  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    const realSession = toAuthSession(session);
    if (realSession && !isLocalOnlySession(realSession)) {
      clearLocalModeFlag();
      emit(realSession);
      return;
    }
    if (isLocalModeSelected()) {
      emit(buildLocalAuthSession());
      return;
    }
    emit(null);
  });

  return () => {
    active = false;
    localModeListeners.delete(emit);
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
  const session = await getAuthenticatedRemoteSession();
  if (!session || isLocalOnlySession(session)) return null;
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
  const session = await getAuthenticatedRemoteSession();
  return session?.userId ?? null;
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
  if (isLocalOnlySession(activeAuthSession ?? null) || isLocalModeSelected()) {
    try {
      const win = globalThis as unknown as { __VIASTELA_EXIT_LOCAL_MODE__?: () => void };
      if (win.__VIASTELA_EXIT_LOCAL_MODE__) win.__VIASTELA_EXIT_LOCAL_MODE__();
      else if (typeof localStorage !== 'undefined') {
        localStorage.setItem('viastela.desktop.signed_out', '1');
        localStorage.removeItem(LOCAL_MODE_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
    activeAuthSession = null;
    for (const listener of localModeListeners) {
      listener(null);
    }
    return;
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
