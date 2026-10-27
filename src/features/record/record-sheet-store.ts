type RecordSheetSnapshot = {
  open: boolean;
  prefillKg: number | null;
  generation: number;
};

let generation = 0;
let snapshot: RecordSheetSnapshot = { open: false, prefillKg: null, generation };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function openRecordSheet(weightKg?: number): void {
  generation += 1;
  snapshot = {
    open: true,
    prefillKg: typeof weightKg === 'number' ? weightKg : null,
    generation,
  };
  emit();
}

export function closeRecordSheet(): void {
  if (!snapshot.open && snapshot.prefillKg === null) return;
  snapshot = { open: false, prefillKg: null, generation };
  emit();
}

export function subscribeRecordSheet(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecordSheetSnapshot(): RecordSheetSnapshot {
  return snapshot;
}
