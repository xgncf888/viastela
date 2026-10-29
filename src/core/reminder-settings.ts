import { MONTH_END_REMINDER_PATH, TRAINING_REMINDER_PATH } from './reminder-paths';

export const DEFAULT_TRAINING_TIME = '08:00';
export const DEFAULT_MONTH_END_TIME = '21:30';

export const TRAINING_WEEKDAYS = [
  { day: 1, label: '周一' },
  { day: 2, label: '周二' },
  { day: 3, label: '周三' },
  { day: 4, label: '周四' },
  { day: 5, label: '周五' },
  { day: 6, label: '周六' },
  { day: 7, label: '周日' },
] as const;

export const REMINDER_COPY = {
  section: '提醒',
  training: '训练日提醒',
  monthEnd: '月底更新余额提醒',
  unconfigured: '推送还没配置，月底提醒会先显示在今日页',
  iosInstall: '先添加到主屏幕，才能收到提醒',
  permissionDenied: '通知权限已关闭，可以在系统设置里打开',
  unsupported: '这个浏览器不支持提醒',
  trainingTime: '训练提醒时间',
  monthEndTime: '月底提醒时间',
  trainingTimeHelp: '默认 08:00',
  monthEndTimeHelp: '当月最后一天，默认 21:30',
  weekdayHelp: '选好星期几才会提醒',
  saveFailed: '保存失败，请重试',
} as const;

export type ReminderFlag = 'training' | 'month_end';

/** One note at a time. Unconfigured outranks iOS install, which outranks a denied permission. */
export type ReminderNote = 'unconfigured' | 'ios-install' | 'permission-denied' | 'unsupported' | null;

export type ReminderPermission = 'default' | 'granted' | 'denied' | 'unsupported';

export type ReminderDraft = {
  id: string | null;
  endpoint: string | null;
  p256dh: string | null;
  auth: string | null;
  tz: string;
  trainingEnabled: boolean;
  monthEndEnabled: boolean;
  trainingDays: number[];
  trainingTime: string;
  monthEndTime: string;
};

export type TogglePlan =
  | { type: 'ignore' }
  | { type: 'denied' }
  | { type: 'turn-off'; flag: ReminderFlag }
  | { type: 'turn-on'; flag: ReminderFlag; requestPermission: boolean };

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/;

export function emptyReminderDraft(timeZone = 'UTC'): ReminderDraft {
  return {
    id: null,
    endpoint: null,
    p256dh: null,
    auth: null,
    tz: timeZone,
    trainingEnabled: false,
    monthEndEnabled: false,
    trainingDays: [],
    trainingTime: DEFAULT_TRAINING_TIME,
    monthEndTime: DEFAULT_MONTH_END_TIME,
  };
}

export function reminderNote(input: {
  vapidConfigured: boolean;
  ios: boolean;
  standalone: boolean;
  pushSupported: boolean;
  permission: ReminderPermission;
}): ReminderNote {
  if (!input.vapidConfigured) return 'unconfigured';
  if (input.ios && !input.standalone) return 'ios-install';
  if (input.permission === 'denied') return 'permission-denied';
  if (!input.pushSupported || input.permission === 'unsupported') return 'unsupported';
  return null;
}

export function reminderNoteCopy(note: ReminderNote): string | null {
  if (note === 'unconfigured') return REMINDER_COPY.unconfigured;
  if (note === 'ios-install') return REMINDER_COPY.iosInstall;
  if (note === 'permission-denied') return REMINDER_COPY.permissionDenied;
  if (note === 'unsupported') return REMINDER_COPY.unsupported;
  return null;
}

/** Denied permission still leaves the switches tappable so a later grant can turn them on. */
export function reminderSwitchesEnabled(note: ReminderNote): boolean {
  return note === null || note === 'permission-denied';
}

/** The card is absent unless a public key exists and this browser can receive push. */
export function remindersCardVisible(input: { vapidConfigured: boolean; pushSupported: boolean }): boolean {
  return input.vapidConfigured && input.pushSupported;
}

/** Weekday and time fields show only while that reminder is on. */
export function scheduleFieldsVisible(flagOn: boolean): boolean {
  return flagOn;
}

export function planToggle(input: {
  flag: ReminderFlag;
  turnOn: boolean;
  note: ReminderNote;
  permission: ReminderPermission;
}): TogglePlan {
  if (!reminderSwitchesEnabled(input.note)) return { type: 'ignore' };
  if (!input.turnOn) return { type: 'turn-off', flag: input.flag };
  if (input.permission === 'denied') return { type: 'denied' };
  return {
    type: 'turn-on',
    flag: input.flag,
    requestPermission: input.permission !== 'granted',
  };
}

export function withFlag(draft: ReminderDraft, flag: ReminderFlag, enabled: boolean): ReminderDraft {
  if (flag === 'training') return { ...draft, trainingEnabled: enabled };
  return { ...draft, monthEndEnabled: enabled };
}

export function normalizeTrainingDays(days: readonly number[]): number[] {
  const picked = new Set<number>();
  for (const day of days) {
    if (!Number.isInteger(day) || day < 1 || day > 7) continue;
    picked.add(day);
  }
  return [...picked].sort((left, right) => left - right);
}

export function toggleTrainingDay(days: readonly number[], day: number): number[] {
  const current = normalizeTrainingDays(days);
  if (!Number.isInteger(day) || day < 1 || day > 7) return current;
  if (current.includes(day)) return current.filter((item) => item !== day);
  return normalizeTrainingDays([...current, day]);
}

/** `08:00:00` from Postgres and `08:00` from the field both become `08:00`. */
export function clockFace(value: string): string | null {
  const match = CLOCK.exec(value.trim());
  if (!match) return null;
  return `${match[1]}:${match[2]}`;
}

export function normalizeClock(value: string): string | null {
  return clockFace(value);
}

export function postgresTime(value: string): string | null {
  const face = clockFace(value);
  return face ? `${face}:00` : null;
}

export function shouldSoftDeleteForPermission(hasLiveRow: boolean, permission: ReminderPermission): boolean {
  return hasLiveRow && permission === 'denied';
}

export function pickSubscription<T extends { id: string | null; endpoint: string | null }>(
  rows: readonly T[],
  hint: { endpoint: string | null; id: string | null },
): T | null {
  if (hint.endpoint) {
    const byEndpoint = rows.find((row) => row.endpoint === hint.endpoint);
    if (byEndpoint) return byEndpoint;
  }
  if (hint.id) return rows.find((row) => row.id === hint.id) ?? null;
  return null;
}

export function reminderPath(kind: ReminderFlag): string {
  return kind === 'training' ? TRAINING_REMINDER_PATH : MONTH_END_REMINDER_PATH;
}
