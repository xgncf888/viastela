import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

// Deno requires the .ts specifier. The app typecheck rejects that extension.
// @ts-ignore TS5097
import { deleteAccountAllowedOriginsEnv, parseAllowedOrigins } from '../../../src/core/delete-account-origin.ts';
// @ts-ignore TS5097
import { amrClaim } from '../../../src/core/recent-sign-in.ts';
import { handleDeleteAccount, unavailableDeleteAccountResponse } from './handler.ts';

Deno.serve((request) => {
  const allowedOrigins = parseAllowedOrigins(Deno.env.get(deleteAccountAllowedOriginsEnv));
  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) {
    return unavailableDeleteAccountResponse(request, allowedOrigins);
  }

  return handleDeleteAccount(request, {
    allowedOrigins,
    async getUser(jwt) {
      const client = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { Authorization: `Bearer ${jwt}` } },
      });
      const { data, error } = await client.auth.getUser(jwt);
      if (error || !data.user?.id) return null;
      // The signature is already accepted. Read `amr` from this token, not `iat`.
      return { id: data.user.id, amr: amrClaim(jwt) };
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
