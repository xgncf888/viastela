import { describe, expect, it } from '@jest/globals';

import {
  parseStudyDraft,
  recentTopicNames,
  studyDaySummary,
  studyRecordsOnDay,
  studySaveToast,
  type StudyRecord,
} from './study';

function record(id: string, topic: string, minutes: number, hour: number): StudyRecord {
  return {
    id,
    topic,
    durationMinutes: minutes,
    note: null,
    recordedAt: `2026-10-27T${String(hour).padStart(2, '0')}:00:00.000Z`,
    tz: 'UTC',
    localDay: '2026-10-27',
    updatedAt: `2026-10-27T${String(hour).padStart(2, '0')}:00:00.000Z`,
  };
}

describe('study draft', () => {
  it('accepts a topic, a positive duration, and an optional note', () => {
    expect(parseStudyDraft({ topic: ' AI Infra ', minutes: '30', note: ' 一句话 ' })).toEqual({
      ok: true,
      topic: 'AI Infra',
      durationMinutes: 30,
      note: '一句话',
    });
    expect(parseStudyDraft({ topic: '英语', minutes: '15', note: '   ' })).toEqual({
      ok: true,
      topic: '英语',
      durationMinutes: 15,
      note: null,
    });
  });

  it('rejects an empty topic, a zero duration, and a note that is too long', () => {
    const topic = parseStudyDraft({ topic: ' ', minutes: '30', note: '' });
    const duration = parseStudyDraft({ topic: '英语', minutes: '0', note: '' });
    const note = parseStudyDraft({ topic: '英语', minutes: '30', note: '字'.repeat(201) });
    expect(topic.ok).toBe(false);
    expect(duration.ok).toBe(false);
    expect(note.ok).toBe(false);
    if (!topic.ok) expect(topic.field).toBe('topic');
    if (!duration.ok) expect(duration.field).toBe('duration');
    if (!note.ok) expect(note.field).toBe('note');
  });
});

describe('study list', () => {
  it('keeps today in recorded order and summarises minutes by topic', () => {
    const later = record('b', '英语', 15, 9);
    const earlier = record('a', 'AI Infra', 30, 8);
    const otherDay = { ...record('c', '英语', 45, 7), localDay: '2026-10-26' };
    expect(studyRecordsOnDay([later, otherDay, earlier], '2026-10-27').map((item) => item.id)).toEqual(['a', 'b']);
    expect(studyDaySummary([earlier, later, { topic: 'AI Infra', durationMinutes: 45 }])).toBe(
      'AI Infra 75 分钟 · 英语 15 分钟',
    );
  });

  it('keeps the six most recent distinct topics', () => {
    const rows = [
      { topic: '英语', recordedAt: '2026-10-27T06:00:00.000Z' },
      { topic: 'AI Infra', recordedAt: '2026-10-27T08:00:00.000Z' },
      { topic: 'AI Infra', recordedAt: '2026-10-27T07:00:00.000Z' },
      { topic: '数学', recordedAt: '2026-10-26T08:00:00.000Z' },
      { topic: '阅读', recordedAt: '2026-10-25T08:00:00.000Z' },
      { topic: '写作', recordedAt: '2026-10-24T08:00:00.000Z' },
      { topic: '历史', recordedAt: '2026-10-23T08:00:00.000Z' },
      { topic: '物理', recordedAt: '2026-10-22T08:00:00.000Z' },
    ];
    expect(recentTopicNames(rows)).toEqual(['AI Infra', '英语', '数学', '阅读', '写作', '历史']);
  });

  it('names the saved topic and the accounting day', () => {
    expect(studySaveToast('AI Infra', 30, '2026-10-27')).toBe('已记入 10月27日 · AI Infra 30 分钟');
  });
});
