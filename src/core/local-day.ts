export const DEFAULT_DAY_SWITCH = '04:00';

const DAY_SWITCH_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'] as const;

export type CivilTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function parseDaySwitch(value: string): { hour: number; minute: number } {
  const match = DAY_SWITCH_PATTERN.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid day switch: ${value}`);
  }
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

export function isDaySwitch(value: string): boolean {
  return DAY_SWITCH_PATTERN.test(value.trim());
}

export function zonedCivilTime(instant: Date, timeZone: string): CivilTime {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => {
    const part = formatted.find((item) => item.type === type);
    if (!part) {
      throw new Error(`Missing ${type} in ${timeZone}`);
    }
    return Number(part.value);
  };
  let hour = read('hour');
  if (hour === 24) hour = 0;
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour,
    minute: read('minute'),
    second: read('second'),
  };
}

export function formatLocalDay(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function shiftLocalDay(localDay: string, days: number): string {
  const [year, month, day] = localDay.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return formatLocalDay(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate());
}

const DAY_MS = 86_400_000;

/** Signed civil-day span from start to end. The same day is 0. */
export function daysBetween(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split('-').map(Number);
  const [endYear, endMonth, endDay] = end.split('-').map(Number);
  const span = Date.UTC(endYear, endMonth - 1, endDay) - Date.UTC(startYear, startMonth - 1, startDay);
  return Math.round(span / DAY_MS);
}

export function civilLocalDay(instant: Date, timeZone: string): string {
  const civil = zonedCivilTime(instant, timeZone);
  return formatLocalDay(civil.year, civil.month, civil.day);
}

function isBeforeSwitch(civil: CivilTime, daySwitch: string): boolean {
  const boundary = parseDaySwitch(daySwitch);
  return civil.hour < boundary.hour || (civil.hour === boundary.hour && civil.minute < boundary.minute);
}

/** Accounting day frozen at write time. Hours before the day switch belong to the previous local date. */
export function computeLocalDay(instant: Date, timeZone: string, daySwitch: string = DEFAULT_DAY_SWITCH): string {
  const civil = zonedCivilTime(instant, timeZone);
  const calendarDay = formatLocalDay(civil.year, civil.month, civil.day);
  return isBeforeSwitch(civil, daySwitch) ? shiftLocalDay(calendarDay, -1) : calendarDay;
}

export function isBeforeDaySwitch(
  instant: Date,
  timeZone: string,
  daySwitch: string = DEFAULT_DAY_SWITCH,
): boolean {
  return isBeforeSwitch(zonedCivilTime(instant, timeZone), daySwitch);
}

export function formatMonthDay(localDay: string): string {
  const [, month, day] = localDay.split('-').map(Number);
  return `${month}月${day}日`;
}

export function weekdayLabel(localDay: string): string {
  const [year, month, day] = localDay.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

export function lastNLocalDays(endDay: string, count: number): string[] {
  const days: string[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    days.push(shiftLocalDay(endDay, -offset));
  }
  return days;
}

/** Shown on 今日 between midnight and the day switch, e.g. 已记入 10月23日. */
export function headerAccountingLabel(
  instant: Date,
  timeZone: string,
  daySwitch: string = DEFAULT_DAY_SWITCH,
): string | null {
  if (!isBeforeDaySwitch(instant, timeZone, daySwitch)) return null;
  return `已记入 ${formatMonthDay(computeLocalDay(instant, timeZone, daySwitch))}`;
}

export function saveToastMessage(
  instant: Date,
  timeZone: string,
  daySwitch: string = DEFAULT_DAY_SWITCH,
): string {
  return headerAccountingLabel(instant, timeZone, daySwitch) ?? '已记录';
}

export function sheetAccountingHint(
  instant: Date,
  timeZone: string,
  daySwitch: string = DEFAULT_DAY_SWITCH,
): string | null {
  if (!isBeforeDaySwitch(instant, timeZone, daySwitch)) return null;
  return `将记入 ${formatMonthDay(computeLocalDay(instant, timeZone, daySwitch))}`;
}

export function currentTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function formatClock(instantIso: string, timeZone: string): string {
  const civil = zonedCivilTime(new Date(instantIso), timeZone);
  return `${civil.hour}:${String(civil.minute).padStart(2, '0')}`;
}
