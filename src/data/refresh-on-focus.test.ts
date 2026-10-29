import { afterEach, expect, jest, test } from '@jest/globals';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import '@/ui/test-dom';

import { useRefreshOnFocus } from './refresh-on-focus';

type Cleanup = () => void;

let start: (() => void | Cleanup) | null = null;

jest.mock('expo-router', () => ({
  useFocusEffect: (effect: () => void | Cleanup) => {
    start = effect;
  },
}));

const roots: Root[] = [];

function mount(load: () => void | Promise<void>): void {
  const container = document.createElement('div');
  const root = createRoot(container);
  function Probe() {
    useRefreshOnFocus(load);
    return null;
  }
  act(() => {
    root.render(createElement(Probe));
  });
  roots.push(root);
}

function focus(): Cleanup {
  const cleanup = start?.();
  return typeof cleanup === 'function' ? cleanup : () => undefined;
}

/** Run blur-confirmation microtasks and the load promise. */
async function flush(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => root?.unmount());
  }
  start = null;
  jest.useRealTimers();
});

test('the first focus does not load, and a focus after a blur loads once', async () => {
  const load = jest.fn(() => Promise.resolve());
  mount(load);
  let leave = focus();
  await flush();
  expect(load).not.toHaveBeenCalled();

  // Navigation identity changes while the screen is still focused. Not a return.
  leave();
  leave = focus();
  await flush();
  expect(load).not.toHaveBeenCalled();

  leave();
  await flush();
  leave = focus();
  await flush();
  expect(load).toHaveBeenCalledTimes(1);

  // A later identity change, still on this visit, does not load again.
  leave();
  leave = focus();
  await flush();
  expect(load).toHaveBeenCalledTimes(1);
});

test('leaving and returning within 400ms refreshes once', async () => {
  jest.useFakeTimers({ doNotFake: ['queueMicrotask', 'nextTick', 'setTimeout'] });
  jest.setSystemTime(1_000_000);
  const load = jest.fn(() => Promise.resolve());
  mount(load);
  let leave = focus();
  await flush();
  leave();
  await flush();
  jest.setSystemTime(1_000_100);
  leave = focus();
  await flush();
  expect(load).toHaveBeenCalledTimes(1);
});

test('focuses during a refresh collapse into one trailing refresh', async () => {
  let release: () => void = () => undefined;
  const load = jest.fn(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  mount(load);
  let leave = focus();
  await flush();
  leave();
  await flush();
  leave = focus();
  await flush();
  expect(load).toHaveBeenCalledTimes(1);

  leave();
  await flush();
  focus();
  await flush();
  leave();
  await flush();
  focus();
  await flush();
  expect(load).toHaveBeenCalledTimes(1);

  await act(async () => {
    release();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => {
    release();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(load).toHaveBeenCalledTimes(2);
});
