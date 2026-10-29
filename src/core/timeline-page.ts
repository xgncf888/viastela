import { accountingDayStart, timelineDayKey, type TimelineCursor } from './timeline-day';

export const TIMELINE_PAGE_SIZE = 50;

export type TimelineFilter = 'all' | 'money' | 'journal';

export type TimelineSortRow = {
  dayKey: string;
  occurredAt: string;
  id: string;
};

export function compareTimelineDesc(a: TimelineSortRow, b: TimelineSortRow): number {
  if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? 1 : -1;
  if (a.occurredAt !== b.occurredAt) return a.occurredAt < b.occurredAt ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

export function isOlderThan(row: TimelineSortRow, cursor: TimelineCursor): boolean {
  return compareTimelineDesc(row, cursor) > 0;
}

/**
 * Pages are newest first. A page takes `limit` rows and then keeps going until the
 * day changes, so the cut never leaves part of a day on the next page.
 */
export function pageTimeline<T extends TimelineSortRow>(
  rows: readonly T[],
  cursor: TimelineCursor | null,
  limit = TIMELINE_PAGE_SIZE,
): { page: T[]; nextCursor: TimelineCursor | null } {
  const sorted = [...rows].sort(compareTimelineDesc);
  const eligible = cursor ? sorted.filter((row) => isOlderThan(row, cursor)) : sorted;
  if (eligible.length === 0) return { page: [], nextCursor: null };
  let end = Math.min(limit, eligible.length);
  const day = eligible[end - 1].dayKey;
  while (end < eligible.length && eligible[end].dayKey === day) end += 1;
  const page = eligible.slice(0, end);
  const last = page[page.length - 1];
  const nextCursor =
    end < eligible.length ? { dayKey: last.dayKey, occurredAt: last.occurredAt, id: last.id } : null;
  return { page, nextCursor };
}

type FetchedRow = {
  id: string;
  occurredAt: string;
  localDay: string | null;
};

export type KeyedTimelineRow<T extends FetchedRow> = T & { dayKey: string };

function keyed<T extends FetchedRow>(row: T, timeZone: string, daySwitch: string): KeyedTimelineRow<T> {
  return { ...row, dayKey: timelineDayKey(row, timeZone, daySwitch) };
}

/**
 * Both streams are read newest-first from the timeline view. Dated rows keyset on
 * `local_day`. Asset events keyset on the day computed from `occurred_at`. A page
 * is returned only once each stream has moved past the page's last day (or run out),
 * so the day boundary is complete.
 */
export async function collectTimelinePage<T extends FetchedRow>(input: {
  cursor: TimelineCursor | null;
  timeZone: string;
  daySwitch: string;
  batch: number;
  limit?: number;
  includeAssets: boolean;
  fetchDated: (after: TimelineCursor | null) => Promise<T[]>;
  fetchAssets: (after: TimelineCursor | null, mode: 'page' | 'stream') => Promise<T[]>;
}): Promise<{ page: KeyedTimelineRow<T>[]; nextCursor: TimelineCursor | null }> {
  const bag = new Map<string, KeyedTimelineRow<T>>();
  let datedAfter = input.cursor;
  let assetAfter = input.cursor;
  let assetMode: 'page' | 'stream' = 'page';
  let datedExhausted = false;
  let assetExhausted = !input.includeAssets;

  for (let round = 0; round < 40; round += 1) {
    const before = bag.size;
    if (!datedExhausted) {
      const rows = await input.fetchDated(datedAfter);
      if (rows.length < input.batch) datedExhausted = true;
      for (const row of rows) {
        if (row.localDay == null) continue;
        const next = keyed(row, input.timeZone, input.daySwitch);
        bag.set(next.id, next);
        datedAfter = { dayKey: next.dayKey, occurredAt: next.occurredAt, id: next.id };
      }
    }
    if (!assetExhausted) {
      const rows = await input.fetchAssets(assetAfter, assetMode);
      if (rows.length < input.batch) assetExhausted = true;
      for (const row of rows) {
        if (row.localDay != null) continue;
        const next = keyed(row, input.timeZone, input.daySwitch);
        bag.set(next.id, next);
        assetAfter = { dayKey: next.dayKey, occurredAt: next.occurredAt, id: next.id };
        assetMode = 'stream';
      }
    }

    const accumulated = [...bag.values()];
    const paged = pageTimeline(accumulated, input.cursor, input.limit ?? TIMELINE_PAGE_SIZE);
    if (
      pageIsSettled({
        page: paged.page,
        accumulated,
        datedExhausted,
        assetExhausted,
        timeZone: input.timeZone,
        daySwitch: input.daySwitch,
        limit: input.limit ?? TIMELINE_PAGE_SIZE,
      })
    ) {
      return paged;
    }
    if ((datedExhausted && assetExhausted) || bag.size === before) return paged;
  }

  return pageTimeline([...bag.values()], input.cursor, input.limit ?? TIMELINE_PAGE_SIZE);
}

export function pageIsSettled(input: {
  page: readonly { dayKey: string }[];
  accumulated: readonly { dayKey: string; occurredAt: string; localDay: string | null }[];
  datedExhausted: boolean;
  assetExhausted: boolean;
  timeZone: string;
  daySwitch: string;
  limit: number;
}): boolean {
  if (input.datedExhausted && input.assetExhausted) return true;
  if (input.page.length === 0) return false;
  const lastDay = input.page[input.page.length - 1].dayKey;
  const start = accountingStartMs(lastDay, input.timeZone, input.daySwitch);
  const datedPast =
    input.datedExhausted || input.accumulated.some((row) => row.localDay != null && row.dayKey < lastDay);
  const assetPast =
    input.assetExhausted ||
    input.accumulated.some((row) => row.localDay == null && Date.parse(row.occurredAt) < start);
  if (!datedPast || !assetPast) return false;
  if (input.page.length < input.limit && !input.accumulated.some((row) => row.dayKey < lastDay)) return false;
  return true;
}

function accountingStartMs(dayKey: string, timeZone: string, daySwitch: string): number {
  return accountingDayStart(dayKey, timeZone, daySwitch).getTime();
}
