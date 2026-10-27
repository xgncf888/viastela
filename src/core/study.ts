import { formatMonthDay } from './local-day';

export const STUDY_MINUTE_CHOICES = [15, 30, 45, 60] as const;

export const DEFAULT_STUDY_MINUTES = 30;

export const MAX_STUDY_MINUTES = 1440;

export const MAX_STUDY_TOPIC = 40;

export const MAX_STUDY_NOTE = 200;

export type StudyField = 'topic' | 'duration' | 'note';

export type RecentTopicRow = {
  topic: string;
  recordedAt: string;
};

export type StudyRecord = {
  id: string;
  topic: string;
  durationMinutes: number;
  note: string | null;
  recordedAt: string;
  tz: string;
  localDay: string;
  updatedAt: string;
};

export type StudyDraft =
  | { ok: true; topic: string; durationMinutes: number; note: string | null }
  | { ok: false; field: StudyField; error: string };

export function parseStudyDraft(input: { topic: string; minutes: string; note: string }): StudyDraft {
  const topic = input.topic.trim();
  if (topic.length < 1 || topic.length > MAX_STUDY_TOPIC) {
    return { ok: false, field: 'topic', error: `主题请写 1 到 ${MAX_STUDY_TOPIC} 个字` };
  }
  const minutesText = input.minutes.trim();
  if (!/^\d{1,4}$/.test(minutesText)) {
    return { ok: false, field: 'duration', error: `时长要是 1 到 ${MAX_STUDY_MINUTES} 的整数` };
  }
  const durationMinutes = Number(minutesText);
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > MAX_STUDY_MINUTES) {
    return { ok: false, field: 'duration', error: `时长要是 1 到 ${MAX_STUDY_MINUTES} 的整数` };
  }
  const note = input.note.trim();
  if (note.length > MAX_STUDY_NOTE) {
    return { ok: false, field: 'note', error: `收获请写在 ${MAX_STUDY_NOTE} 字以内` };
  }
  return { ok: true, topic, durationMinutes, note: note.length > 0 ? note : null };
}

export function studyRecordsOnDay(records: readonly StudyRecord[], localDay: string): StudyRecord[] {
  return records
    .filter((record) => record.localDay === localDay)
    .sort((left, right) => {
      const byTime = Date.parse(left.recordedAt) - Date.parse(right.recordedAt);
      if (byTime !== 0) return byTime;
      return left.id.localeCompare(right.id);
    });
}

export function studyDaySummary(records: readonly Pick<StudyRecord, 'topic' | 'durationMinutes'>[]): string {
  const totals = new Map<string, number>();
  const order: string[] = [];
  for (const record of records) {
    if (!totals.has(record.topic)) {
      order.push(record.topic);
      totals.set(record.topic, 0);
    }
    totals.set(record.topic, (totals.get(record.topic) ?? 0) + record.durationMinutes);
  }
  return order.map((topic) => `${topic} ${totals.get(topic)} 分钟`).join(' · ');
}

export function recentTopicNames(rows: readonly RecentTopicRow[], limit = 6): string[] {
  const ordered = [...rows].sort((left, right) => {
    const byTime = Date.parse(right.recordedAt) - Date.parse(left.recordedAt);
    if (byTime !== 0) return byTime;
    return left.topic.localeCompare(right.topic);
  });
  const names: string[] = [];
  const seen = new Set<string>();
  for (const row of ordered) {
    const name = row.topic.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
    if (names.length === limit) break;
  }
  return names;
}

export function studySaveToast(topic: string, minutes: number, localDay: string): string {
  return `已记入 ${formatMonthDay(localDay)} · ${topic} ${minutes} 分钟`;
}

export function studyDetail(record: Pick<StudyRecord, 'durationMinutes' | 'note'>): string {
  return record.note ? `${record.durationMinutes} 分钟 · ${record.note}` : `${record.durationMinutes} 分钟`;
}
