import { describe, expect, it } from '@jest/globals';

import { beginSave, confirmSave, upsertById, visibleRecords, type SaveState } from './save-state';

type Row = { id: string; weightKg: number };

describe('dedupe', () => {
  it('keeps a single row when the same client id is submitted again', () => {
    const first = upsertById<Row>([], { id: 'same', weightKg: 71.2 });
    const retried = upsertById(first, { id: 'same', weightKg: 71.2 });
    expect(retried).toEqual([{ id: 'same', weightKg: 71.2 }]);
    expect(upsertById(retried, { id: 'other', weightKg: 70 })).toHaveLength(2);
  });

  it('retries a failed optimistic save without a duplicate', () => {
    let state: SaveState<Row> = { saved: [], pending: [] };
    const row = { id: 'abc', weightKg: 71.2 };
    state = beginSave(state, row);
    expect(visibleRecords(state)).toEqual([row]);
    state = beginSave(state, row);
    expect(visibleRecords(state)).toHaveLength(1);
    state = confirmSave(state, row);
    expect(state.pending).toEqual([]);
    expect(visibleRecords(state)).toEqual([row]);
    state = confirmSave(state, row);
    expect(visibleRecords(state)).toHaveLength(1);
  });
});
