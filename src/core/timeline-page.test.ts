import { describe, expect, it } from '@jest/globals';

import { compareTimelineDesc, collectTimelinePage, pageTimeline, TIMELINE_PAGE_SIZE } from './timeline-page';
import { timelineDayKey, type TimelineCursor } from './timeline-day';

const ZONE = 'Asia/Singapore';
const SWITCH = '06:00';

type Row = {
  id: string;
  kind: string;
  occurredAt: string;
  localDay: string | null;
  refId: string | null;
  payload: Record<string, unknown>;
};

function row(id: string, localDay: string | null, occurredAt: string, kind = 'journal'): Row {
  return { id, kind, occurredAt, localDay, refId: null, payload: {} };
}

function olderDated(row: Row, cursor: TimelineCursor): boolean {
  return compareTimelineDesc({ dayKey: row.localDay ?? '', occurredAt: row.occurredAt, id: row.id }, cursor) > 0;
}

function olderAsset(candidate: Row, cursor: TimelineCursor, mode: 'page' | 'stream'): boolean {
  if (mode === 'stream') {
    return (
      compareTimelineDesc(
        { dayKey: candidate.occurredAt, occurredAt: candidate.occurredAt, id: candidate.id },
        { dayKey: cursor.occurredAt, occurredAt: cursor.occurredAt, id: cursor.id },
      ) > 0
    );
  }
  const dayKey = timelineDayKey(candidate, ZONE, SWITCH);
  return compareTimelineDesc({ dayKey, occurredAt: candidate.occurredAt, id: candidate.id }, cursor) > 0;
}

function fetcher(rows: Row[], batch: number) {
  const dated = rows
    .filter((item) => item.localDay != null)
    .sort((a, b) => compareTimelineDesc({ ...a, dayKey: a.localDay ?? '' }, { ...b, dayKey: b.localDay ?? '' }));
  const assets = rows
    .filter((item) => item.localDay == null)
    .sort((a, b) =>
      compareTimelineDesc(
        { dayKey: a.occurredAt, occurredAt: a.occurredAt, id: a.id },
        { dayKey: b.occurredAt, occurredAt: b.occurredAt, id: b.id },
      ),
    );
  return {
    fetchDated: async (after: TimelineCursor | null) =>
      (after ? dated.filter((item) => olderDated(item, after)) : dated).slice(0, batch),
    fetchAssets: async (after: TimelineCursor | null, mode: 'page' | 'stream') =>
      (after ? assets.filter((item) => olderAsset(item, after, mode)) : assets).slice(0, batch),
  };
}

describe('timeline pages', () => {
  it('extends a page through the day boundary', () => {
    const rows = [
      row('a1', '2026-10-02', '2026-10-02T02:00:00.000Z'),
      row('a2', '2026-10-02', '2026-10-02T01:00:00.000Z'),
      row('b1', '2026-10-01', '2026-10-01T02:00:00.000Z'),
      row('b2', '2026-10-01', '2026-10-01T01:00:00.000Z'),
    ].map((item) => ({ ...item, dayKey: item.localDay ?? '' }));
    const page = pageTimeline(rows, null, 3);
    expect(page.page.map((item) => item.id)).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(page.nextCursor).toBeNull();
  });

  it('keeps a day of more than one page together', () => {
    const rows = Array.from({ length: TIMELINE_PAGE_SIZE + 1 }, (_, index) => ({
      ...row(`id-${index}`, '2026-10-02', `2026-10-02T00:00:${String(index).padStart(2, '0')}.000Z`),
      dayKey: '2026-10-02',
    }));
    const page = pageTimeline(rows, null, TIMELINE_PAGE_SIZE);
    expect(page.page).toHaveLength(TIMELINE_PAGE_SIZE + 1);
    expect(new Set(page.page.map((item) => item.dayKey))).toEqual(new Set(['2026-10-02']));
  });

  it('puts a backfilled journal on its local day, ahead of the earlier asset event', async () => {
    const journal = row('journal', '2026-10-01', '2026-10-27T12:00:00.000Z', 'journal');
    const asset = row('asset', null, '2026-10-01T01:00:00.000Z', 'holding_added');
    const newer = row('newer', '2026-10-02', '2026-10-02T01:00:00.000Z', 'balance_recorded');
    const reads = fetcher([journal, asset, newer], 1);
    const page = await collectTimelinePage({
      cursor: null,
      timeZone: ZONE,
      daySwitch: SWITCH,
      batch: 1,
      limit: 2,
      includeAssets: true,
      ...reads,
    });
    expect(page.page.map((item) => item.id)).toEqual(['newer', 'journal', 'asset']);
    expect(page.page.find((item) => item.id === 'journal')?.dayKey).toBe('2026-10-01');
    expect(page.page.filter((item) => item.dayKey === '2026-10-01').map((item) => item.id)).toEqual(['journal', 'asset']);
    expect(page.nextCursor).toBeNull();
  });

  it('does not leave the rest of a day on the next page when batches are small', async () => {
    const rows = [
      row('a1', '2026-10-02', '2026-10-02T02:00:00.000Z'),
      row('a2', '2026-10-02', '2026-10-02T01:00:00.000Z'),
      row('b1', '2026-10-01', '2026-10-01T02:00:00.000Z'),
      row('b2', '2026-10-01', '2026-10-01T01:00:00.000Z'),
    ];
    const page = await collectTimelinePage({
      cursor: null,
      timeZone: ZONE,
      daySwitch: SWITCH,
      batch: 1,
      limit: 3,
      includeAssets: false,
      ...fetcher(rows, 1),
    });
    expect(page.page.map((item) => item.dayKey)).toEqual(['2026-10-02', '2026-10-02', '2026-10-01', '2026-10-01']);
    expect(page.page.map((item) => item.id)).toEqual(['a1', 'a2', 'b1', 'b2']);
  });
});
