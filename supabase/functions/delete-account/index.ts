import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

import { handleDeleteAccount } from './handler.ts';

Deno.serve((request) => {
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: 'unavailable' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  return handleDeleteAccount(request, {
    async getUser(jwt) {
      const client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data, error } = await client.auth.getUser(jwt);
      if (error || !data.user) return null;
      return { id: data.user.id };
    },
    async deleteUser(userId) {
      const admin = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) throw new Error('delete failed');
    },
  });
});
