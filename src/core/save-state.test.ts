import { describe, expect, it } from '@jest/globals';

import { beginSave, confirmSave, reconcileServerRows, upsertById, visibleRecords, type SaveState } from './save-state';

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

  it('keeps a locally confirmed row when a server read has not caught up', () => {
    const local = { id: 'new', weightKg: 76.4 };
    const server = [{ id: 'old', weightKg: 73.7 }];
    const state = reconcileServerRows({ saved: [local], pending: [] }, server, new Set(['new']));
    expect(state.saved).toEqual([...server, local]);
    expect(reconcileServerRows({ saved: [local], pending: [] }, server, new Set()).saved).toEqual(server);
    const caughtUp = reconcileServerRows(
      { saved: [local], pending: [{ id: 'new', weightKg: 76.4 }] },
      [local],
      new Set(['new']),
    );
    expect(caughtUp).toEqual({ saved: [local], pending: [] });
  });
});
