import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { isSupabaseConfigured, requireSupabaseEnv } from '@/config/env';
import { LOCAL_OFFLINE_USER_ID } from '@/core/local-session';

import type { Database } from './database.types';

let client: SupabaseClient<Database> | null = null;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

/** Drops any request that would send the device-only user id to a remote host. */
function fetchWithoutLocalUser(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = requestUrl(input);
  const body = typeof init?.body === 'string' ? init.body : '';
  if (url.includes(LOCAL_OFFLINE_USER_ID) || body.includes(LOCAL_OFFLINE_USER_ID)) {
    return Promise.reject(new Error('Not signed in'));
  }
  return fetch(input, init);
}

export function resetSupabaseClient(): void {
  client = null;
}

export function getSupabase(): SupabaseClient<Database> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured');
  }
  if (client) return client;
  const { url, anonKey } = requireSupabaseEnv();
  client = createClient<Database>(url, anonKey, {
    global: { fetch: fetchWithoutLocalUser },
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: typeof window !== 'undefined',
      flowType: 'pkce',
    },
  });
  return client;
}
