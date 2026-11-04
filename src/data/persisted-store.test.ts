import { afterEach, beforeEach, expect, test } from '@jest/globals';

import { createMemoryLocalStore, setLocalStoreForTests } from './local-store';
import { createPersistedStore, createPersistedStoreBus } from './persisted-store';

beforeEach(() => {
  setLocalStoreForTests(createMemoryLocalStore());
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});

afterEach(() => {
  setLocalStoreForTests(null);
  if (typeof localStorage !== 'undefined') {
    localStorage.clear();
  }
});

test('createPersistedStore reads defaults, normalizes payloads, notifies subscribers, and hydrates from localStore', async () => {
  const bus = createPersistedStoreBus();
  let notifications = 0;
  const unsub = bus.subscribe(() => {
    notifications += 1;
  });

  const counterStore = createPersistedStore<{ count: number }>({
    key: 'viastela.test.counter.v1',
    getDefault: () => ({ count: 1 }),
    normalize: (parsed) => {
      if (!parsed || typeof parsed !== 'object') return { count: 1 };
      const raw = (parsed as { count?: unknown }).count;
      return { count: typeof raw === 'number' && Number.isFinite(raw) ? raw : 1 };
    },
    bus,
  });

  expect(counterStore.read()).toEqual({ count: 1 });
  counterStore.write({ count: 42 });
  expect(counterStore.read()).toEqual({ count: 42 });
  expect(notifications).toBe(1);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('viastela.test.counter.v1', '{invalid-json');
    expect(counterStore.read()).toEqual({ count: 1 });
    localStorage.removeItem('viastela.test.counter.v1');
  }

  const hydrated = await counterStore.hydrate();
  expect(hydrated).toEqual({ count: 42 });
  unsub();
});
