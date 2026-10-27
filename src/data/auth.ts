import type { Session } from '@supabase/supabase-js';

import { isSupabaseConfigured } from '@/config/env';

import { getSupabase } from './client';
import { currentOrigin, oauthRedirectTo, type OAuthProvider } from './oauth';
import { clearServiceWorkerRuntimeCache } from './runtime-cache';

export type AuthSession = {
  userId: string;
  email: string | null;
};

function toAuthSession(session: Session | null): AuthSession | null {
  if (!session) return null;
  return { userId: session.user.id, email: session.user.email ?? null };
}

export function subscribeAuth(listener: (session: AuthSession | null) => void): () => void {
  if (!isSupabaseConfigured()) {
    listener(null);
    return () => undefined;
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

export async function signOut(): Promise<void> {
  const { error } = await getSupabase().auth.signOut();
  if (error) throw error;
  await clearServiceWorkerRuntimeCache();
}

export async function signOutLocal(): Promise<void> {
  const { error } = await getSupabase().auth.signOut({ scope: 'local' });
  if (error) throw error;
  await clearServiceWorkerRuntimeCache();
}
