let open = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function openRecordSheet(): void {
  open = true;
  emit();
}

export function closeRecordSheet(): void {
  open = false;
  emit();
}

export function subscribeRecordSheet(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getRecordSheetOpen(): boolean {
  return open;
}
