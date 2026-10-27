import {
  computeLocalDay,
  formatMonthDay,
  parseDaySwitch,
  shiftLocalDay,
  weekdayLabel,
  zonedCivilTime,
  type CivilTime,
} from './local-day';

export type TimelineCursor = {
  dayKey: string;
  occurredAt: string;
  id: string;
};

/** Stored `local_day` wins. Asset events have none, so the current zone and day switch decide. */
export function timelineDayKey(
  row: { localDay: string | null; occurredAt: string },
  timeZone: string,
  daySwitch: string,
): string {
  if (row.localDay) return row.localDay;
  return computeLocalDay(new Date(row.occurredAt), timeZone, daySwitch);
}

export function timelineClock(occurredAt: string, timeZone: string): string {
  const civil = zonedCivilTime(new Date(occurredAt), timeZone);
  return `${String(civil.hour).padStart(2, '0')}:${String(civil.minute).padStart(2, '0')}`;
}

export function timelineDayLabel(dayKey: string, today: string): string {
  if (dayKey === today) return '今天';
  if (dayKey === shiftLocalDay(today, -1)) return '昨天';
  return `${formatMonthDay(dayKey)} ${weekdayLabel(dayKey).replace('星期', '周')}`;
}

function offsetMs(instant: Date, timeZone: string): number {
  const civil = zonedCivilTime(instant, timeZone);
  const asUtc = Date.UTC(civil.year, civil.month - 1, civil.day, civil.hour, civil.minute, civil.second);
  return asUtc - instant.getTime();
}

/** UTC instant of a civil time in `timeZone`. */
export function zonedInstant(civil: CivilTime, timeZone: string): Date {
  const utcGuess = Date.UTC(civil.year, civil.month - 1, civil.day, civil.hour, civil.minute, civil.second);
  let epoch = utcGuess - offsetMs(new Date(utcGuess), timeZone);
  const corrected = utcGuess - offsetMs(new Date(epoch), timeZone);
  if (corrected !== epoch) epoch = corrected;
  return new Date(epoch);
}

/** First instant of an accounting day. The switch time belongs to the new day. */
export function accountingDayStart(dayKey: string, timeZone: string, daySwitch: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  const boundary = parseDaySwitch(daySwitch);
  return zonedInstant({ year, month, day, hour: boundary.hour, minute: boundary.minute, second: 0 }, timeZone);
}

export function quoteFilterValue(value: string): string {
  return `"${value.replace(/"/g, '')}"`;
}

/** Keyset for rows that already store `local_day`, newest first. */
export function datedKeyset(cursor: TimelineCursor): string {
  const day = quoteFilterValue(cursor.dayKey);
  const at = quoteFilterValue(cursor.occurredAt);
  const id = quoteFilterValue(cursor.id);
  return `local_day.lt.${day},and(local_day.eq.${day},occurred_at.lt.${at}),and(local_day.eq.${day},occurred_at.eq.${at},id.lt.${id})`;
}

/**
 * Asset events have a null `local_day`. Compare their computed day, not the cursor's
 * `occurred_at` alone: a backfilled journal's `occurred_at` is `created_at`.
 */
export function assetPageKeyset(cursor: TimelineCursor, timeZone: string, daySwitch: string): string {
  const start = quoteFilterValue(accountingDayStart(cursor.dayKey, timeZone, daySwitch).toISOString());
  const end = quoteFilterValue(accountingDayStart(shiftLocalDay(cursor.dayKey, 1), timeZone, daySwitch).toISOString());
  const at = quoteFilterValue(cursor.occurredAt);
  const id = quoteFilterValue(cursor.id);
  return `occurred_at.lt.${start},and(occurred_at.gte.${start},occurred_at.lt.${end},or(occurred_at.lt.${at},and(occurred_at.eq.${at},id.lt.${id})))`;
}

/** Continue an asset-event scan after a row already known to be in order. */
export function instantKeyset(cursor: Pick<TimelineCursor, 'occurredAt' | 'id'>): string {
  const at = quoteFilterValue(cursor.occurredAt);
  const id = quoteFilterValue(cursor.id);
  return `occurred_at.lt.${at},and(occurred_at.eq.${at},id.lt.${id})`;
}
