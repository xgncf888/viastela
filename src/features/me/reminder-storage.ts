import type { ReminderDraft } from '@/core/reminder-settings';
import { clockFace, normalizeTrainingDays } from '@/core/reminder-settings';

export const PUSH_SUBSCRIPTION_ID_KEY = 'viastela.push-subscription-id';
export const REMINDER_SCHEDULE_KEY = 'viastela.reminder-schedule';

export type LocalSchedule = {
  trainingTime: string;
  monthEndTime: string;
  trainingDays: number[];
};

function store(): Storage | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage;
}

export function readSubscriptionId(): string | null {
  const value = store()?.getItem(PUSH_SUBSCRIPTION_ID_KEY);
  return value || null;
}

export function writeSubscriptionId(id: string): void {
  store()?.setItem(PUSH_SUBSCRIPTION_ID_KEY, id);
}

export function clearSubscriptionId(): void {
  store()?.removeItem(PUSH_SUBSCRIPTION_ID_KEY);
}

export function readLocalSchedule(): LocalSchedule | null {
  const raw = store()?.getItem(REMINDER_SCHEDULE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LocalSchedule>;
    const trainingTime = typeof parsed.trainingTime === 'string' ? clockFace(parsed.trainingTime) : null;
    const monthEndTime = typeof parsed.monthEndTime === 'string' ? clockFace(parsed.monthEndTime) : null;
    if (!trainingTime || !monthEndTime) return null;
    return {
      trainingTime,
      monthEndTime,
      trainingDays: normalizeTrainingDays(Array.isArray(parsed.trainingDays) ? parsed.trainingDays : []),
    };
  } catch {
    return null;
  }
}

export function writeLocalSchedule(draft: ReminderDraft): void {
  const trainingTime = clockFace(draft.trainingTime);
  const monthEndTime = clockFace(draft.monthEndTime);
  if (!trainingTime || !monthEndTime) return;
  const schedule: LocalSchedule = {
    trainingTime,
    monthEndTime,
    trainingDays: normalizeTrainingDays(draft.trainingDays),
  };
  store()?.setItem(REMINDER_SCHEDULE_KEY, JSON.stringify(schedule));
}

export function applyLocalSchedule(draft: ReminderDraft, schedule: LocalSchedule | null): ReminderDraft {
  if (!schedule) return draft;
  return {
    ...draft,
    trainingTime: schedule.trainingTime,
    monthEndTime: schedule.monthEndTime,
    trainingDays: schedule.trainingDays,
  };
}
