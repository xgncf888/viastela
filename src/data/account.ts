import { getSupabase } from './client';

export async function deleteOwnAccount(): Promise<void> {
  const { error } = await getSupabase().functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
}
