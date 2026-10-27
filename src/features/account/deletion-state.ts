import { useSyncExternalStore } from 'react';

let deletedFlag = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function markAccountDeleted(): void {
  deletedFlag = true;
  emit();
}

export function acknowledgeAccountDeleted(): void {
  deletedFlag = false;
  emit();
}

export function peekAccountDeleted(): boolean {
  return deletedFlag;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAccountDeletedFlag(): boolean {
  return useSyncExternalStore(subscribe, peekAccountDeleted, peekAccountDeleted);
}
