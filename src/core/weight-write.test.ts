import { describe, expect, it } from '@jest/globals';

import { isSoftDeletedUpsert, RECORD_DELETED, weightSaveOutcome } from './weight-write';

const rls = {
  code: '42501',
  message: 'new row violates row-level security policy for table "weight_records"',
};

describe('soft-deleted upsert', () => {
  it('recognizes the row-level security error from writing a deleted id', () => {
    expect(isSoftDeletedUpsert(rls)).toBe(true);
  });

  it('ignores permission denied and unique violations', () => {
    expect(isSoftDeletedUpsert({ code: '42501', message: 'permission denied for table weight_records' })).toBe(false);
    expect(isSoftDeletedUpsert({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(isSoftDeletedUpsert({ message: 'fetch failed' })).toBe(false);
  });

  it('surfaces record deleted and does not ask for another retry', () => {
    expect(weightSaveOutcome(new Error(RECORD_DELETED))).toBe('record deleted');
    expect(weightSaveOutcome(new Error(RECORD_DELETED))).toBe(RECORD_DELETED);
    expect(weightSaveOutcome(new Error('保存失败'))).toBe('retry');
    expect(weightSaveOutcome(rls)).toBe('retry');
  });
});
