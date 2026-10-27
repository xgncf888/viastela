import { DEFAULT_DAY_SWITCH } from '@/core/local-day';

import { getSupabase } from './client';

function normalizeDaySwitch(value: string): string {
  const match = /^(\d{2}):(\d{2})/.exec(value);
  return match ? `${match[1]}:${match[2]}` : DEFAULT_DAY_SWITCH;
}

async function currentUserId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Not signed in');
  return userId;
}

export async function getDaySwitch(): Promise<string> {
  const supabase = getSupabase();
  const userId = await currentUserId();
  const { data, error } = await supabase.from('profiles').select('day_switch').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  if (data?.day_switch) return normalizeDaySwitch(data.day_switch);
  const { error: insertError } = await supabase.from('profiles').upsert(
    { user_id: userId, day_switch: `${DEFAULT_DAY_SWITCH}:00` },
    { onConflict: 'user_id', ignoreDuplicates: true },
  );
  if (insertError) throw insertError;
  return DEFAULT_DAY_SWITCH;
}

export async function updateDaySwitch(daySwitch: string): Promise<void> {
  const userId = await currentUserId();
  const { error } = await getSupabase()
    .from('profiles')
    .upsert({ user_id: userId, day_switch: `${daySwitch}:00` }, { onConflict: 'user_id' });
  if (error) throw error;
}
