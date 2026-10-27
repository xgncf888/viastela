export type SaveState<T extends { id: string }> = {
  saved: readonly T[];
  pending: readonly T[];
};

/** Insert or replace by client id. A retry of the same id never adds a second row. */
export function upsertById<T extends { id: string }>(records: readonly T[], incoming: T): T[] {
  const index = records.findIndex((record) => record.id === incoming.id);
  if (index === -1) return [...records, incoming];
  const next = records.slice();
  next[index] = incoming;
  return next;
}

export function mergeById<T extends { id: string }>(saved: readonly T[], pending: readonly T[]): T[] {
  const seen = new Set(saved.map((record) => record.id));
  return [...saved, ...pending.filter((record) => !seen.has(record.id))];
}

export function beginSave<T extends { id: string }>(state: SaveState<T>, record: T): SaveState<T> {
  return {
    saved: state.saved,
    pending: upsertById(state.pending, record),
  };
}

export function confirmSave<T extends { id: string }>(state: SaveState<T>, record: T): SaveState<T> {
  return {
    saved: upsertById(state.saved, record),
    pending: state.pending.filter((item) => item.id !== record.id),
  };
}

export function visibleRecords<T extends { id: string }>(state: SaveState<T>): T[] {
  return mergeById(state.saved, state.pending);
}
