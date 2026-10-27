import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';

import { dismissShownToast, showToast } from '@/ui/toast';

const DELETE_UNDO_MS = 5000;

type Entry = {
  id: string;
  owner: string;
  commit: () => Promise<void>;
};

let entries = new Map<string, Entry>();
let timer: ReturnType<typeof setTimeout> | null = null;
let snapshot: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();
let installs = 0;
let detachListeners: (() => void) | null = null;

function emit() {
  snapshot = new Set(entries.keys());
  listeners.forEach((listener) => listener());
}

function clearTimer() {
  if (timer) clearTimeout(timer);
  timer = null;
}

function showUndo() {
  const count = entries.size;
  showToast({
    text: count === 1 ? '已删除' : `已删除 ${count} 条`,
    duration: DELETE_UNDO_MS,
    pinned: true,
    action: { label: '撤销', onPress: () => cancelDeferredDeletes() },
  });
}

function commitAll() {
  const state = AppState.currentState;
  if (state === 'background' || state === 'inactive') {
    cancelDeferredDeletes();
    return;
  }
  const batch = [...entries.values()];
  entries = new Map();
  clearTimer();
  emit();
  for (const entry of batch) void entry.commit();
}

function arm() {
  clearTimer();
  showUndo();
  timer = setTimeout(() => {
    timer = null;
    commitAll();
  }, DELETE_UNDO_MS);
}

export function cancelDeferredDeletes(owner?: string): void {
  const before = entries.size;
  if (owner) {
    const next = new Map(entries);
    for (const [id, entry] of entries) {
      if (entry.owner === owner) next.delete(id);
    }
    entries = next;
  } else if (before === 0) {
    return;
  } else {
    entries = new Map();
  }
  if (entries.size === before) return;
  if (entries.size === 0) {
    clearTimer();
    emit();
    dismissShownToast();
    return;
  }
  emit();
  arm();
}

export function scheduleDeferredDelete(owner: string, id: string, commit: () => Promise<void>): void {
  if (entries.has(id)) return;
  const next = new Map(entries);
  next.set(id, { id, owner, commit });
  entries = next;
  emit();
  arm();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ReadonlySet<string> {
  return snapshot;
}

export function useDeferredDeleteIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function installDeferredDeleteLifecycle(): () => void {
  installs += 1;
  if (installs === 1) {
    const onChange = (next: string) => {
      if (next === 'background' || next === 'inactive') cancelDeferredDeletes();
    };
    const subscription = AppState.isAvailable ? AppState.addEventListener('change', onChange) : null;
    const onPageHide = () => cancelDeferredDeletes();
    if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide);
    detachListeners = () => {
      subscription?.remove();
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide);
    };
  }
  return () => {
    installs -= 1;
    if (installs === 0) {
      detachListeners?.();
      detachListeners = null;
    }
  };
}
