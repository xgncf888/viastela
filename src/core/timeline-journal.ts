import {
  FUTURE_DAY_MESSAGE,
  JOURNAL_BODY_MESSAGE,
  JOURNAL_MOOD_MESSAGE,
  JOURNAL_TAGS_MESSAGE,
} from './timeline-errors';

export const JOURNAL_TITLE_CHARS = 48;

export const MOOD_LABELS = ['很差', '差', '一般', '好', '很好'] as const;

export type JournalDraft = {
  body: string;
  entryDay: string;
  mood: number | null;
  tags: readonly string[];
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** First line of the body, clamped so the shared title line stays within two lines. */
export function journalTitle(body: string): string {
  const line = body.split(/\r?\n/, 1)[0]?.trim() ?? '';
  if (line.length <= JOURNAL_TITLE_CHARS) return line;
  return `${line.slice(0, JOURNAL_TITLE_CHARS)}…`;
}

export function moodLabel(mood: number | null): string | null {
  if (mood == null || !Number.isInteger(mood) || mood < 1 || mood > MOOD_LABELS.length) return null;
  return MOOD_LABELS[mood - 1];
}

export function journalDetail(mood: number | null, tags: readonly string[]): string | null {
  const parts: string[] = [];
  const moodText = moodLabel(mood);
  if (moodText) parts.push(moodText);
  for (const tag of tags) parts.push(tag);
  return parts.length > 0 ? parts.join(' · ') : null;
}

export function validateJournal(draft: JournalDraft, today: string): string | null {
  const body = draft.body.trim();
  if (body.length < 1 || body.length > 2000) return JOURNAL_BODY_MESSAGE;
  if (!DAY.test(draft.entryDay)) return '日期格式不对';
  if (draft.entryDay > today) return FUTURE_DAY_MESSAGE;
  if (draft.mood != null && (draft.mood < 1 || draft.mood > 5 || !Number.isInteger(draft.mood))) {
    return JOURNAL_MOOD_MESSAGE;
  }
  if (draft.tags.length > 5) return JOURNAL_TAGS_MESSAGE;
  for (const tag of draft.tags) {
    if (tag.trim().length < 1 || tag.trim().length > 20) return JOURNAL_TAGS_MESSAGE;
  }
  return null;
}

export function normalizeJournalDraft(draft: JournalDraft): JournalDraft {
  return {
    body: draft.body.trim(),
    entryDay: draft.entryDay,
    mood: draft.mood,
    tags: draft.tags.map((tag) => tag.trim()),
  };
}
