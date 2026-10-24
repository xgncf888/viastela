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

/**
 * Mean of the earliest record on each local day inside the window.
 * Days with no row are left out of both the sum and the count.
 * `localDay` on each record is trusted; this function does not recompute it.
 */
export function sevenDayAverage(records: readonly WeightRecord[], endDay: string): number | null {
  const window = new Set(lastNLocalDays(endDay, 7));
  const earliest = earliestPerDay(records.filter((record) => window.has(record.localDay)));
  if (earliest.length === 0) return null;
  const sum = earliest.reduce((total, record) => total + record.weightKg, 0);
  return sum / earliest.length;
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
