import {
  collectTimelinePage,
  TIMELINE_PAGE_SIZE,
  type KeyedTimelineRow,
  type TimelineFilter,
} from '@/core/timeline-page';
import { assetPageKeyset, datedKeyset, instantKeyset, type TimelineCursor } from '@/core/timeline-day';
import { requireDeletedIds } from '@/core/weight-write';

import { readAmountMasked } from './amount-mask';
import { getSupabase } from './client';
import type { Json } from './database.types';
import { liveRows } from './live-rows';

export type TimelineRecord = {
  id: string;
  kind: string;
  occurredAt: string;
  localDay: string | null;
  refId: string | null;
  payload: Record<string, unknown>;
};

export type TimelineAccountRow = {
  id: string;
  name: string;
  currency: string;
};

export type JournalWrite = {
  id: string;
  body: string;
  entryDay: string;
  tz: string;
  mood: number | null;
  tags: string[];
};

type ViewRow = {
  id: string | null;
  kind: string | null;
  occurred_at: string | null;
  local_day: string | null;
  ref_id: string | null;
  payload: Json | null;
};

/**
 * One read path: `public.timeline` (select only). Dated rows and asset events are
 * two keyset scans of that view, merged by (day key, occurred_at, id). The page
 * keeps fetching until the last day is complete, so a day is never split.
 * Asset-event days are computed here from `occurred_at` plus the caller's zone
 * and day switch. Journal and balance rows keep their stored day.
 */
export async function loadTimelinePage(input: {
  timeZone: string;
  daySwitch: string;
  filter: TimelineFilter;
  cursor: TimelineCursor | null;
}): Promise<{ records: KeyedTimelineRow<TimelineRecord>[]; nextCursor: TimelineCursor | null }> {
  const kind = input.filter === 'journal' ? 'journal' : input.filter === 'money' ? 'balance_recorded' : null;
  const collected = await collectTimelinePage({
    cursor: input.cursor,
    timeZone: input.timeZone,
    daySwitch: input.daySwitch,
    batch: TIMELINE_PAGE_SIZE,
    includeAssets: input.filter !== 'journal',
    fetchDated: (after) => selectTimeline({ localDay: 'present', kind, keyset: after ? datedKeyset(after) : null }),
    fetchAssets: (after, mode) =>
      selectTimeline({
        localDay: 'null',
        kind: null,
        keyset: after
          ? mode === 'page'
            ? assetPageKeyset(after, input.timeZone, input.daySwitch)
            : instantKeyset(after)
          : null,
      }),
  });
  return { records: collected.page, nextCursor: collected.nextCursor };
}

export async function listTimelineAccounts(): Promise<TimelineAccountRow[]> {
  const { data, error } = await liveRows(getSupabase().from('asset_accounts').select('id, name, currency'));
  if (error) throw error;
  return (data ?? []).map((row) => ({ id: row.id, name: row.name, currency: row.currency }));
}

export async function saveJournal(entry: JournalWrite): Promise<void> {
  const { data, error: sessionError } = await getSupabase().auth.getSession();
  if (sessionError) throw sessionError;
  const userId = data.session?.user.id;
  if (!userId) throw new Error('Not signed in');
  const { error } = await getSupabase().from('journal_entries').upsert(
    {
      id: entry.id,
      user_id: userId,
      body: entry.body,
      entry_day: entry.entryDay,
      tz: entry.tz,
      mood: entry.mood,
      tags: entry.tags,
    },
    { onConflict: 'id' },
  );
  if (error) throw error;
}

export async function softDeleteJournal(id: string): Promise<void> {
  const { data, error } = await getSupabase()
    .from('journal_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  requireDeletedIds(data);
}

/** Same store as the assets screen. Missing means hidden. */
export async function readTimelineAmountsHidden(userId: string): Promise<boolean> {
  return readAmountMasked(userId);
}

async function selectTimeline(input: {
  localDay: 'null' | 'present';
  kind: 'journal' | 'balance_recorded' | null;
  keyset: string | null;
}): Promise<TimelineRecord[]> {
  let query = getSupabase().from('timeline').select('id, kind, occurred_at, local_day, ref_id, payload');
  query = input.localDay === 'null' ? query.is('local_day', null) : query.not('local_day', 'is', null);
  if (input.kind) query = query.eq('kind', input.kind);
  if (input.keyset) query = query.or(input.keyset);
  const ordered =
    input.localDay === 'present'
      ? query
          .order('local_day', { ascending: false })
          .order('occurred_at', { ascending: false })
          .order('id', { ascending: false })
      : query.order('occurred_at', { ascending: false }).order('id', { ascending: false });
  const { data, error } = await ordered.limit(TIMELINE_PAGE_SIZE);
  if (error) throw error;
  return (data ?? []).flatMap((row) => parseViewRow(row, input));
}

function parseViewRow(
  row: ViewRow,
  input: { localDay: 'null' | 'present'; kind: 'journal' | 'balance_recorded' | null },
): TimelineRecord[] {
  if (!row.id || !row.kind || !row.occurred_at) return [];
  if (input.kind && row.kind !== input.kind) return [];
  if (input.localDay === 'null' && row.local_day != null) return [];
  if (input.localDay === 'present' && row.local_day == null) return [];
  if (input.localDay === 'present' && row.kind !== 'journal' && row.kind !== 'balance_recorded') return [];
  return [
    {
      id: row.id,
      kind: row.kind,
      occurredAt: row.occurred_at,
      localDay: row.local_day,
      refId: row.ref_id,
      payload: payloadOf(row.payload),
    },
  ];
}

function payloadOf(value: Json | null): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}
