import { lastNLocalDays } from '@/core/local-day';
import { earliestPerDay, formatKg, recordsOnDay, sevenDayAverageView, type WeightRecord } from '@/core/weight-stats';

export const LOADING_TEXT = '读取中';
export const FIRST_RECORD_TITLE = '先记第一笔';

export type AverageCaption = {
  headline: string;
  detail: string;
};

export type WeightColumnPhase = 'dash' | 'skeleton' | 'wait' | 'content';

/**
 * Today weight column and the 7-day average (§17.2). An error or the load-gate
 * timeout is a muted dash, not a second error card. The skeleton waits until
 * the gate says it is on screen, and leaves as soon as the gate times out.
 */
export function weightColumnPhase(input: {
  ready: boolean;
  failed: boolean;
  showSkeleton: boolean;
  timedOut: boolean;
}): WeightColumnPhase {
  if (input.failed || input.timedOut) return 'dash';
  if (!input.ready && input.showSkeleton) return 'skeleton';
  if (!input.ready) return 'wait';
  return 'content';
}

/** What 今日 may show before the list arrives. The empty title stays hidden until ready. */
export function todayReadout(
  ready: boolean,
  todayCount: number,
  hasHistory: boolean,
): { loading: string | null; firstRecord: string | null } {
  if (!ready) return { loading: LOADING_TEXT, firstRecord: null };
  if (todayCount === 0 && !hasHistory) return { loading: null, firstRecord: FIRST_RECORD_TITLE };
  return { loading: null, firstRecord: null };
}

export function recordedDaysInWeek(records: readonly WeightRecord[], endDay: string): number {
  const window = new Set(lastNLocalDays(endDay, 7));
  return earliestPerDay(records.filter((record) => window.has(record.localDay))).length;
}

export function averageCaption(records: readonly WeightRecord[], endDay: string): AverageCaption {
  const view = sevenDayAverageView(records, endDay);
  if (view.status === 'insufficient') {
    const count = recordedDaysInWeek(records, endDay);
    return {
      headline: '数据不足',
      detail: `近 7 天有 ${count} 天记录，满 4 天后显示均重`,
    };
  }
  return {
    headline: formatKg(view.kilograms),
    detail: 'kg · 每天最早的一笔，没有记录的日子不计入',
  };
}

/** First row of a local day is the morning weigh-in. Later rows that day are repeats. */
export function weighInLabel(index: number): string {
  return index === 0 ? '晨重' : '复测';
}

/** Pending deletes stay in memory for undo and stay out of numbering and the average. */
export function excludePending<T extends { id: string }>(
  records: readonly T[],
  pendingIds: ReadonlySet<string>,
): readonly T[] {
  if (pendingIds.size === 0) return records;
  return records.filter((record) => !pendingIds.has(record.id));
}

export function labelsForDay(records: readonly WeightRecord[], localDay: string): string[] {
  return recordsOnDay(records, localDay).map((_, index) => weighInLabel(index));
}
