import { describe, expect, it } from '@jest/globals';

import { JOURNAL_TITLE_CHARS, journalTitle, normalizeJournalDraft, validateJournal } from './timeline-journal';

const TODAY = '2026-10-27';

describe('journal draft', () => {
  it('trims the body and rejects an empty, oversized, or future entry', () => {
    expect(validateJournal({ body: '  今天  ', entryDay: TODAY, mood: null, tags: [] }, TODAY)).toBeNull();
    expect(normalizeJournalDraft({ body: '  今天  ', entryDay: TODAY, mood: null, tags: [] }).body).toBe('今天');
    expect(validateJournal({ body: '   ', entryDay: TODAY, mood: null, tags: [] }, TODAY)).toBe('正文需要 1 到 2000 字');
    expect(validateJournal({ body: '字'.repeat(2001), entryDay: TODAY, mood: null, tags: [] }, TODAY)).toBe(
      '正文需要 1 到 2000 字',
    );
    expect(validateJournal({ body: '记', entryDay: '2026-10-28', mood: null, tags: [] }, TODAY)).toBe(
      '不能选择未来的日期',
    );
  });

  it('checks mood and tags', () => {
    expect(validateJournal({ body: '记', entryDay: TODAY, mood: 5, tags: ['一', '二'] }, TODAY)).toBeNull();
    expect(validateJournal({ body: '记', entryDay: TODAY, mood: 6, tags: [] }, TODAY)).toBe('心情只能从 1 到 5 里选');
    expect(validateJournal({ body: '记', entryDay: TODAY, mood: null, tags: ['一', '二', '三', '四', '五', '六'] }, TODAY)).toBe(
      '标签最多 5 个，每个 1 到 20 字',
    );
    expect(validateJournal({ body: '记', entryDay: TODAY, mood: null, tags: ['字'.repeat(21)] }, TODAY)).toBe(
      '标签最多 5 个，每个 1 到 20 字',
    );
  });

  it('uses the first line and clamps the title', () => {
    expect(journalTitle('第一行\n第二行')).toBe('第一行');
    const long = '记'.repeat(JOURNAL_TITLE_CHARS + 4);
    expect(journalTitle(long)).toBe(`${'记'.repeat(JOURNAL_TITLE_CHARS)}…`);
  });
});
