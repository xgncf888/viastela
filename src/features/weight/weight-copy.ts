import { lastNLocalDays } from '@/core/local-day';
import { earliestPerDay, formatKg, recordsOnDay, sevenDayAverageView, type WeightRecord } from '@/core/weight-stats';

export const LOADING_TEXT = '读取中';
export const FIRST_RECORD_TITLE = '先记第一笔';

export type AverageCaption = {
  headline: string;
  detail: string;
};

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

export function labelsForDay(records: readonly WeightRecord[], localDay: string): string[] {
  return recordsOnDay(records, localDay).map((_, index) => weighInLabel(index));
}
