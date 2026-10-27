import { describe, expect, it } from '@jest/globals';

import { isRecordDeleted, RECORD_DELETED, requireDeletedIds, weightSaveOutcome } from './weight-write';

const rls = {
  code: '42501',
  message: 'new row violates row-level security policy for table "weight_records"',
};

describe('deleted record errors', () => {
  it('recognises only P0001 with the exact record deleted message', () => {
    expect(isRecordDeleted({ code: 'P0001', message: 'record deleted' })).toBe(true);
    expect(isRecordDeleted({ code: 'P0001', message: 'anything' })).toBe(false);
    expect(isRecordDeleted({ code: 'P0001', message: 'record deleted ' })).toBe(false);
    expect(isRecordDeleted({ code: 'P0001' })).toBe(false);
    expect(isRecordDeleted(rls)).toBe(false);
    expect(isRecordDeleted({ code: '42501', message: 'permission denied for table weight_records' })).toBe(false);
    expect(isRecordDeleted({ code: '23505', message: 'duplicate key value violates unique constraint' })).toBe(false);
    expect(isRecordDeleted({ message: 'fetch failed' })).toBe(false);
    expect(isRecordDeleted({ message: 'record deleted' })).toBe(false);
  });

  it('surfaces record deleted and retries every other error', () => {
    expect(weightSaveOutcome(new Error(RECORD_DELETED))).toBe(RECORD_DELETED);
    expect(weightSaveOutcome(new Error('保存失败'))).toBe('retry');
    expect(weightSaveOutcome(rls)).toBe('retry');
    expect(weightSaveOutcome({ code: 'P0001' })).toBe('retry');
    expect(weightSaveOutcome({ code: 'P0001', message: 'other' })).toBe('retry');
    expect(weightSaveOutcome(Object.assign(new Error('other'), { code: 'P0001' }))).toBe('retry');
  });

  it('rejects a soft delete that returned no id', () => {
    expect(() => requireDeletedIds([])).toThrow(/delete matched no row/);
    expect(() => requireDeletedIds(null)).toThrow(/delete matched no row/);
    expect(() => requireDeletedIds([{ id: 'row-1' }])).not.toThrow();
  });
});
