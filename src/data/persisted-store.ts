import { localStore } from './local-store';

export type PersistedStoreListener = () => void;

export type PersistedStoreBus = {
  subscribe: (listener: PersistedStoreListener) => () => void;
  emit: () => void;
};

export function createPersistedStoreBus(): PersistedStoreBus {
  const listeners = new Set<PersistedStoreListener>();
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit() {
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

export type PersistedStore<T> = {
  readonly key: string;
  read: () => T;
  write: (next: T) => T;
  hydrate: () => Promise<T>;
  subscribe: (listener: PersistedStoreListener) => () => void;
};

/**
 * Creates a cross-platform persisted store that:
 * 1. Reads/writes synchronously against `localStorage` when available (Web/Desktop) and falls back to an in-memory mirror.
 * 2. Asynchronously mirrors writes and hydrates from `localStore()` (`AsyncStorage` on iOS/Android native or injected test store).
 * 3. Validates and normalizes parsed JSON through `normalize(parsed)` with a safe fallback to `getDefault()`.
 */
export function createPersistedStore<T>(options: {
  key: string;
  getDefault: () => T;
  normalize: (parsed: unknown) => T;
  bus?: PersistedStoreBus;
}): PersistedStore<T> {
  const { key, getDefault, normalize } = options;
  const bus = options.bus ?? createPersistedStoreBus();
  let memoryMirror: T | undefined;
  let lastRaw: string | null = null;

  function parseRaw(raw: string | null): T {
    if (!raw) return getDefault();
    try {
      const parsed: unknown = JSON.parse(raw);
      return normalize(parsed);
    } catch {
      return getDefault();
    }
  }

  function read(): T {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(key);
        if (raw === null) {
          return memoryMirror !== undefined ? memoryMirror : getDefault();
        }
        if (raw === lastRaw && memoryMirror !== undefined) {
          return memoryMirror;
        }
        const value = parseRaw(raw);
        lastRaw = raw;
        memoryMirror = value;
        return value;
      }
    } catch {
      // Fall back to memory mirror
    }
    return memoryMirror !== undefined ? memoryMirror : getDefault();
  }

  function write(next: T): T {
    const serialized = JSON.stringify(next);
    memoryMirror = next;
    lastRaw = serialized;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, serialized);
      }
    } catch {
      // Ignore synchronous quota errors
    }
    void localStore()
      .then((store) => store.setItem(key, serialized))
      .catch(() => {});
    bus.emit();
    return next;
  }

  async function hydrate(): Promise<T> {
    try {
      const store = await localStore();
      const raw = await store.getItem(key);
      if (raw !== null) {
        const value = parseRaw(raw);
        memoryMirror = value;
        lastRaw = raw;
        try {
          if (typeof localStorage !== 'undefined' && localStorage.getItem(key) === null) {
            localStorage.setItem(key, raw);
          }
        } catch {
          // Ignore sync mirror errors
        }
        bus.emit();
        return value;
      }
    } catch {
      // Ignore async hydration errors
    }
    return read();
  }

  return {
    key,
    read,
    write,
    hydrate,
    subscribe: bus.subscribe,
  };
}
