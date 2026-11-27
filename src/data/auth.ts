import type { Session } from '@supabase/supabase-js';

import { configuredSupabaseUrl, isSupabaseConfigured, saveCustomSupabaseEnv } from '@/config/env';
import {
  hasStoredRemoteSession,
  isLocalOfflineUser,
  LOCAL_OFFLINE_EMAIL,
  LOCAL_OFFLINE_USER_ID,
  storedTokenIsLocalUser,
  supabaseAuthStorageKey,
} from '@/core/local-session';

import { getSupabase, resetSupabaseClient } from './client';
import { clearLocalDb } from './local-db';
import { currentOrigin, oauthRedirectTo, type OAuthProvider } from './oauth';
import { clearQuoteCache } from './quoteCache';
import { clearRecordOutbox } from './record-outbox';
import { clearServiceWorkerRuntimeCache } from './runtime-cache';

export type AuthSession = {
  userId: string;
  email: string | null;
};

const LEGACY_STANDALONE_DB_KEY = 'viastela.desktop.standalone.db.v1';
const localModeListeners = new Set<(session: AuthSession | null) => void>();

let activeAuthSession: AuthSession | null | undefined;

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session?.user?.id) return null;
  return { userId: session.user.id, email: session.user.email ?? null };
}

export function isLocalOnlySession(session: AuthSession | null): boolean {
  if (!session) return false;
  return isLocalOfflineUser(session.userId, session.email);
}

function readStorageItem(key: string): string | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Cloud session stored under the current client's real auth key. */
export function hasStoredCloudSession(): boolean {
  return hasStoredRemoteSession(readStorageItem, configuredSupabaseUrl());
}

function locationHasAuthCallback(): boolean {
  const loc = (globalThis as { location?: { search?: string; hash?: string } }).location;
  if (!loc) return false;
  const search = loc.search ?? '';
  const hash = loc.hash ?? '';
  try {
    if (new URLSearchParams(search).has('code')) return true;
  } catch {
    return false;
  }
  return hash.includes('access_token=') || hash.includes('code=');
}

/**
 * Local mode is on only after the person taps the dev-build button.
 * Home-screen, native-shell, and packaged-scheme launches never turn it on.
 * Production builds ignore the flag.
 */
export function isLocalModeSelected(): boolean {
  if (!__DEV__) return false;
  return readStorageItem('viastela.local_mode') === '1';
}

function buildLocalAuthSession(): AuthSession {
  return { userId: LOCAL_OFFLINE_USER_ID, email: LOCAL_OFFLINE_EMAIL };
}

function clearLocalModeFlag(): void {
  if (!__DEV__) return;
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem('viastela.local_mode');
  } catch {
    // Ignore storage errors
  }
}

export const NOT_SIGNED_IN = 'Not signed in';

let explicitLeave = false;
let holdApp = false;
let sawCloudSession = false;

export function readHoldApp(): boolean {
  return holdApp;
}

export function writeHoldApp(next: boolean): void {
  holdApp = next;
}

export function readSawCloudSession(): boolean {
  return sawCloudSession;
}

export function rememberCloudSession(): void {
  sawCloudSession = true;
}

export function beginExplicitLeave(): void {
  explicitLeave = true;
  sawCloudSession = false;
  holdApp = false;
}

export function takeExplicitLeave(): boolean {
  const leaving = explicitLeave;
  explicitLeave = false;
  return leaving;
}

const reauthListeners = new Set<() => void>();

export function noteSessionExpired(): void {
  for (const listener of reauthListeners) listener();
}

export function subscribeSessionExpired(listener: () => void): () => void {
  reauthListeners.add(listener);
  return () => reauthListeners.delete(listener);
}

export function isSignedOutError(error: unknown): boolean {
  return error instanceof Error && error.message === NOT_SIGNED_IN;
}

function publish(next: AuthSession | null): void {
  activeAuthSession = next;
  for (const listener of localModeListeners) listener(next);
}

function publishRemoteSession(session: Session | null): void {
  const next = toAuthSession(session);
  if (!next || isLocalOnlySession(next)) return;
  clearLocalModeFlag();
  publish(next);
}

/**
 * Returns the authenticated remote Supabase session if and only if a cloud
 * session exists. Local mode and a signed-out browser get null, so data
 * modules do not issue remote requests.
 */
export async function getAuthenticatedRemoteSession(): Promise<AuthSession | null> {
  if (!isSupabaseConfigured()) return null;
  const cloudStored = hasStoredCloudSession();
  const callback = locationHasAuthCallback();
  if (isLocalModeSelected() && !cloudStored && !callback) return null;
  if (!cloudStored && !callback) return null;
  try {
    const { data, error } = await getSupabase().auth.getSession();
    if (error || !data.session) return null;
    const session = toAuthSession(data.session);
    if (!session || isLocalOnlySession(session)) return null;
    clearLocalModeFlag();
    return session;
  } catch {
    return null;
  }
}

export async function requireRemoteUserId(): Promise<string> {
  const session = await getAuthenticatedRemoteSession();
  if (!session || isLocalOnlySession(session)) {
    throw new Error(NOT_SIGNED_IN);
  }
  return session.userId;
}

export function applyCustomSupabaseConfig(url: string, anonKey: string): boolean {
  const saved = saveCustomSupabaseEnv(url, anonKey);
  if (!saved) return false;
  resetSupabaseClient();
  return true;
}

export function enterLocalMode(): AuthSession | null {
  if (!__DEV__ || hasStoredCloudSession()) return null;
  const session = buildLocalAuthSession();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('viastela.desktop.signed_out');
      localStorage.setItem('viastela.local_mode', '1');
    }
  } catch {
    // Ignore storage errors
  }
  publish(session);
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

  const cloudStored = hasStoredCloudSession();
  const callback = locationHasAuthCallback();
  // No stored cloud session: stay on the login screen or in dev local mode
  // without constructing the Supabase client, so nothing calls the network.
  // A later OTP verify publishes the session itself.
  if (!cloudStored && !callback) {
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
  const { data, error } = await getSupabase().auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;
  if (data.session) {
    publishRemoteSession(data.session);
    return;
  }
  const { data: fresh } = await getSupabase().auth.getSession();
  publishRemoteSession(fresh.session);
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

/** Leaves dev local mode and keeps the on-device records. */
export async function leaveLocalMode(): Promise<void> {
  if (!__DEV__) return;
  beginExplicitLeave();
  clearLocalModeFlag();
  publish(null);
}

/** Clears both local stores and any device-only session, then leaves local mode. */
export async function clearLocalModeData(): Promise<void> {
  if (!__DEV__) return;
  await clearLocalDb();
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('viastela.local_mode');
      localStorage.removeItem('viastela.desktop.signed_out');
      localStorage.removeItem(LEGACY_STANDALONE_DB_KEY);
      const keys = new Set([
        supabaseAuthStorageKey(configuredSupabaseUrl()),
        supabaseAuthStorageKey('http://127.0.0.1:54321'),
      ]);
      for (const key of keys) {
        if (storedTokenIsLocalUser(localStorage.getItem(key))) localStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage errors
  }
  publish(null);
}

export async function signOut(): Promise<void> {
  beginExplicitLeave();
  if (__DEV__ && (isLocalOnlySession(activeAuthSession ?? null) || isLocalModeSelected())) {
    await leaveLocalMode();
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
