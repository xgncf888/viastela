import { describe, expect, it } from '@jest/globals';

import { isRecordDeleted, RECORD_DELETED, weightSaveOutcome } from './weight-write';

const rls = {
  code: '42501',
  message: 'new row violates row-level security policy for table "weight_records"',
};

describe('deleted record errors', () => {
  it('recognises only the P0001 code', () => {
    expect(isRecordDeleted({ code: 'P0001', message: 'record deleted' })).toBe(true);
    expect(isRecordDeleted({ code: 'P0001', message: 'anything' })).toBe(true);
    expect(isRecordDeleted(rls)).toBe(false);
    expect(isRecordDeleted({ code: '42501', message: 'permission denied for table weight_records' })).toBe(false);
    expect(isRecordDeleted({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(isRecordDeleted({ message: 'fetch failed' })).toBe(false);
  });

  it('surfaces record deleted and retries every other error', () => {
    expect(weightSaveOutcome(new Error(RECORD_DELETED))).toBe(RECORD_DELETED);
    expect(weightSaveOutcome(new Error('保存失败'))).toBe('retry');
    expect(weightSaveOutcome(rls)).toBe('retry');
    expect(weightSaveOutcome({ code: 'P0001' })).toBe('retry');
  });
});
