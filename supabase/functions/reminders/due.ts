import { civilLocalDay, zonedCivilTime } from '../../../src/core/local-day.ts';
import { MONTH_END_REMINDER_PATH, TRAINING_REMINDER_PATH } from '../../../src/core/reminder-paths.ts';

export type ReminderKind = 'training' | 'month_end';

export type DueSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  tz: string;
  monthEndTime: string;
  monthEndEnabled: boolean;
  trainingTime: string;
  trainingDays: number[];
  trainingEnabled: boolean;
  deletedAt: string | null;
};

export type ReminderPayload = {
  title: string;
  body: string;
  url: string;
  kind: ReminderKind;
};

const CLOCK = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** A reminder sends only when its own flag is on and the row is still live. */
export function canSend(row: DueSubscription, kind: ReminderKind): boolean {
  if (row.deletedAt) return false;
  if (kind === 'training') return row.trainingEnabled === true;
  return row.monthEndEnabled === true;
}

export function isoWeekday(year: number, month: number, day: number): number {
  const js = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return js === 0 ? 7 : js;
}

export function isLastDayOfMonth(year: number, month: number, day: number): boolean {
  return new Date(Date.UTC(year, month - 1, day + 1)).getUTCDate() === 1;
}

export function clockMinutes(value: string): number | null {
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

/**
 * Due once the subscription's own civil clock has reached the stored time
 * on the right day. A later cron tick still qualifies until the delivery row exists.
 */
export function isDue(row: DueSubscription, kind: ReminderKind, now: Date): boolean {
  if (!canSend(row, kind)) return false;
  let civil;
  try {
    civil = zonedCivilTime(now, row.tz);
  } catch {
    return false;
  }
  const nowMinutes = civil.hour * 60 + civil.minute;
  if (kind === 'training') {
    const target = clockMinutes(row.trainingTime);
    if (target === null || nowMinutes < target) return false;
    return row.trainingDays.includes(isoWeekday(civil.year, civil.month, civil.day));
  }
  const target = clockMinutes(row.monthEndTime);
  if (target === null || nowMinutes < target) return false;
  return isLastDayOfMonth(civil.year, civil.month, civil.day);
}

export function deliveryLocalDay(now: Date, timeZone: string): string {
  return civilLocalDay(now, timeZone);
}

export function reminderPayload(kind: ReminderKind): ReminderPayload {
  if (kind === 'training') {
    return { title: '训练日提醒', body: '今天该训练了', url: TRAINING_REMINDER_PATH, kind };
  }
  return {
    title: '月底更新余额提醒',
    body: '今天是月底，记得更新资产余额',
    url: MONTH_END_REMINDER_PATH,
    kind,
  };
}
