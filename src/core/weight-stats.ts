import { lastNLocalDays } from './local-day';

export type WeightRecord = {
  id: string;
  weightKg: number;
  recordedAt: string;
  tz: string;
  localDay: string;
  updatedAt: string;
};

export type DaySummary = {
  localDay: string;
  primary: WeightRecord | null;
  notes: WeightRecord[];
};

function isEarlier(left: WeightRecord, right: WeightRecord): boolean {
  const leftTime = Date.parse(left.recordedAt);
  const rightTime = Date.parse(right.recordedAt);
  if (leftTime !== rightTime) return leftTime < rightTime;
  return left.id < right.id;
}

/** Earliest row of each local day. That row is the morning fasted weigh-in used in averages. */
export function earliestPerDay(records: readonly WeightRecord[]): WeightRecord[] {
  const chosen = new Map<string, WeightRecord>();
  for (const record of records) {
    const current = chosen.get(record.localDay);
    if (!current || isEarlier(record, current)) chosen.set(record.localDay, record);
  }
  return [...chosen.values()].sort((left, right) => left.localDay.localeCompare(right.localDay));
}

export function notesForDay(records: readonly WeightRecord[], localDay: string): WeightRecord[] {
  const sameDay = records.filter((record) => record.localDay === localDay);
  const primary = earliestPerDay(sameDay)[0];
  if (!primary) return [];
  return sameDay
    .filter((record) => record.id !== primary.id)
    .sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt));
}

export const MIN_DAYS_FOR_AVERAGE = 4;

/** Local days the trend chart plots. The 7-day average keeps its own window. */
export const TREND_WINDOW_DAYS = 28;

export type SevenDayAverage =
  | { status: 'insufficient' }
  | { status: 'value'; kilograms: number };

/** Inclusive `local_day` bounds ending on `endDay`, `days` long. */
export function weightListWindow(endDay: string, days: number): { fromDay: string; toDay: string } {
  if (!Number.isInteger(days) || days < 1) {
    throw new Error('Day count must be a positive integer');
  }
  const span = lastNLocalDays(endDay, days);
  return { fromDay: span[0] ?? endDay, toDay: endDay };
}

function earliestInWindow(records: readonly WeightRecord[], endDay: string): WeightRecord[] {
  const window = new Set(lastNLocalDays(endDay, 7));
  return earliestPerDay(records.filter((record) => window.has(record.localDay)));
}

/**
 * Headline 7-day figure. Below 4 local days with a weigh-in the result is
 * insufficient data, not a short average. Days with no row are left out of
 * both the sum and the count. `localDay` is trusted and is not recomputed.
 */
export function sevenDayAverageView(records: readonly WeightRecord[], endDay: string): SevenDayAverage {
  const earliest = earliestInWindow(records, endDay);
  if (earliest.length < MIN_DAYS_FOR_AVERAGE) return { status: 'insufficient' };
  const sum = earliest.reduce((total, record) => total + record.weightKg, 0);
  return { status: 'value', kilograms: sum / earliest.length };
}

export function sevenDayAverage(records: readonly WeightRecord[], endDay: string): number | null {
  const view = sevenDayAverageView(records, endDay);
  return view.status === 'value' ? view.kilograms : null;
}

export function summarizeWindow(records: readonly WeightRecord[], endDay: string): DaySummary[] {
  return lastNLocalDays(endDay, 7).map((localDay) => ({
    localDay,
    primary: earliestPerDay(records.filter((record) => record.localDay === localDay))[0] ?? null,
    notes: notesForDay(records, localDay),
  }));
}

export function recordsOnDay(records: readonly WeightRecord[], localDay: string): WeightRecord[] {
  return records
    .filter((record) => record.localDay === localDay)
    .sort((left, right) => Date.parse(left.recordedAt) - Date.parse(right.recordedAt));
}

export function latestRecord(records: readonly WeightRecord[]): WeightRecord | null {
  return records.reduce<WeightRecord | null>((latest, record) => {
    if (!latest || Date.parse(record.recordedAt) >= Date.parse(latest.recordedAt)) return record;
    return latest;
  }, null);
}

export function formatKg(weightKg: number): string {
  return weightKg.toFixed(1);
}
