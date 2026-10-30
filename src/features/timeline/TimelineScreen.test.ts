import { Platform } from 'react-native';
import '@/ui/test-dom';

import { afterEach, beforeEach, expect, jest, test } from '@jest/globals';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { getDaySwitch } from '@/data/profile';
import { listTimelineAccounts, loadTimelinePage, readTimelineAmountsHidden } from '@/data/timeline';
import { LOAD_ERROR_TEXT } from '@/ui/LoadingRegion';
import { REFRESHING_TEXT, REFRESH_FAILED_TEXT } from '@/ui/RefreshStatus';

import { TimelineScreen } from './TimelineScreen';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: unknown }) => children ?? null,
  SafeAreaProvider: ({ children }: { children?: unknown }) => children ?? null,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('react-native', () => {
  // jest.mock factories cannot use ESM imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const web = require('react-native-web') as typeof import('react-native');
  const timing = jest.fn((_value: unknown, config: { toValue: number; duration: number }) => ({
    config,
    start(callback?: (result: { finished: boolean }) => void) {
      callback?.({ finished: true });
    },
    stop() {},
    reset() {},
  }));
  const sequence = jest.fn((steps: unknown[]) => ({ steps, start() {}, stop() {}, reset() {} }));
  const loop = jest.fn(() => ({ start() {}, stop() {}, reset() {} }));
  return {
    ...web,
    Animated: new Proxy(web.Animated, {
      get(target, prop, receiver) {
        if (prop === 'timing') return timing;
        if (prop === 'sequence') return sequence;
        if (prop === 'loop') return loop;
        return Reflect.get(target, prop, receiver);
      },
    }),
    AccessibilityInfo: {
      ...web.AccessibilityInfo,
      isReduceMotionEnabled: () => Promise.resolve(false),
      addEventListener: () => ({ remove() {} }),
      announceForAccessibility: () => undefined,
    },
  };
});

jest.mock('@/features/auth/AuthProvider', () => {
  const session = {
    userId: '11111111-1111-4111-8111-111111111111',
    email: 'reader@example.com',
  };
  return {
    useAuth: () => ({ ready: true, session }),
  };
});

jest.mock('@/features/shell/AppShell', () => ({
  useShellInset: () => 0,
}));

jest.mock('@/features/record/deferred-delete', () => {
  const ids = new Set<string>();
  return {
    useDeferredDeleteIds: () => ids,
    scheduleDeferredDelete: jest.fn(),
  };
});

jest.mock('@/data/profile', () => ({
  getDaySwitch: jest.fn(),
}));

jest.mock('@/data/refresh-on-focus', () => ({
  useRefreshOnFocus: () => undefined,
}));

jest.mock('@/data/timeline', () => ({
  loadTimelinePage: jest.fn(),
  listTimelineAccounts: jest.fn(),
  readTimelineAmountsHidden: jest.fn(),
  softDeleteJournal: jest.fn(),
  saveJournal: jest.fn(),
}));

const getDaySwitchMock = jest.mocked(getDaySwitch);
const loadTimelinePageMock = jest.mocked(loadTimelinePage);
const listTimelineAccountsMock = jest.mocked(listTimelineAccounts);
const readTimelineAmountsHiddenMock = jest.mocked(readTimelineAmountsHidden);

const journal = {
  id: '11111111-1111-4111-8111-111111111111',
  kind: 'journal',
  occurredAt: '2026-10-27T01:00:00.000Z',
  localDay: '2026-10-27',
  dayKey: '2026-10-27',
  refId: null,
  payload: { body: '体重 76 kg', mood: null, tags: [] as string[] },
};

const roots: Root[] = [];

function mount(node: ReactNode): HTMLElement {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  roots.push(root);
  return container;
}

async function flush(times = 6) {
  for (let i = 0; i < times; i += 1) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
  }
}

function markup(node: ParentNode): string {
  const parts: string[] = [];
  const walk = (current: Node) => {
    if (current.nodeType === 1) {
      const element = current as HTMLElement;
      const names = element.getAttributeNames?.() ?? [];
      const attrs = names.map((name) => `${name}="${element.getAttribute(name)}"`).join(' ');
      parts.push(`<${element.tagName.toLowerCase()}${attrs ? ` ${attrs}` : ''}>`);
      element.childNodes.forEach((child) => walk(child));
      parts.push(`</${element.tagName.toLowerCase()}>`);
      return;
    }
    parts.push(current.textContent ?? '');
  };
  node.childNodes.forEach((child) => walk(child));
  return parts.join('');
}

function findRole(node: ParentNode, role: string, label?: string): HTMLElement | null {
  const walk = (current: Node): HTMLElement | null => {
    if (current.nodeType !== 1) return null;
    const element = current as HTMLElement;
    const matchesRole = element.getAttribute('role') === role;
    const matchesLabel = label == null || (element.textContent ?? '').trim() === label;
    if (matchesRole && matchesLabel) return element;
    for (const child of element.childNodes) {
      const found = walk(child);
      if (found) return found;
    }
    return null;
  };
  for (const child of node.childNodes) {
    const found = walk(child);
    if (found) return found;
  }
  return null;
}

function click(node: HTMLElement) {
  const event = {
    type: 'click',
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    altKey: false,
    button: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    target: node,
    currentTarget: node,
    preventDefault() {
      event.defaultPrevented = true;
    },
    stopPropagation() {},
  };
  node.dispatchEvent(event as unknown as Event);
}

beforeEach(() => {
  jest.useFakeTimers({ now: 1_700_000_000_000 });
  getDaySwitchMock.mockReset();
  loadTimelinePageMock.mockReset();
  listTimelineAccountsMock.mockReset();
  readTimelineAmountsHiddenMock.mockReset();
  getDaySwitchMock.mockResolvedValue('06:00');
  listTimelineAccountsMock.mockResolvedValue([]);
  readTimelineAmountsHiddenMock.mockResolvedValue(true);
});

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => root?.unmount());
  }
  Platform.OS = 'web';
  jest.useRealTimers();
});

test('the first load shows the title and a status skeleton, then the failure row, and a retry can time out again', async () => {
  loadTimelinePageMock.mockImplementation(() => new Promise(() => undefined));
  const container = mount(createElement(TimelineScreen));
  expect(container.textContent).toContain('时间线');
  expect(markup(container)).not.toContain('role="status"');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(findRole(container, 'status')?.textContent).toBe('正在加载时间线');
  expect(markup(container)).toContain('role="status"');
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);

  await act(async () => {
    await jest.advanceTimersByTimeAsync(7000);
  });
  expect(container.textContent).toContain(LOAD_ERROR_TEXT);
  expect(container.textContent).toContain('重试');
  expect(findRole(container, 'alert')?.textContent).toContain(LOAD_ERROR_TEXT);
  expect(markup(container)).toContain('role="alert"');
  expect(markup(container)).not.toContain('role="status"');
  expect(container.textContent).not.toContain('正在加载时间线');
  expect(container.textContent).toContain('时间线');

  const calls = loadTimelinePageMock.mock.calls.length;
  const retry = findRole(container, 'button', '重试');
  expect(retry).not.toBeNull();
  act(() => {
    click(retry as HTMLElement);
  });
  await flush();
  expect(loadTimelinePageMock.mock.calls.length).toBeGreaterThan(calls);
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);
  expect(markup(container)).not.toContain('role="status"');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(findRole(container, 'status')?.textContent).toBe('正在加载时间线');
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);

  await act(async () => {
    await jest.advanceTimersByTimeAsync(7000);
  });
  expect(container.textContent).toContain(LOAD_ERROR_TEXT);
  expect(findRole(container, 'alert')?.textContent).toContain('没加载出来，检查网络后再试');
  expect(markup(container)).not.toContain('role="status"');
  expect(container.textContent).toContain('时间线');
});

test('an HTTP 500 uses the same failure copy and role=alert', async () => {
  loadTimelinePageMock.mockRejectedValue({ status: 500, message: 'down' });
  const container = mount(createElement(TimelineScreen));
  await flush();
  expect(container.textContent).toContain('时间线');
  expect(container.textContent).toContain('没加载出来，检查网络后再试');
  expect(container.textContent).not.toContain('读取失败');
  expect(container.textContent).not.toContain('down');
  expect(findRole(container, 'alert')?.textContent).toContain(LOAD_ERROR_TEXT);
  expect(markup(container)).toContain('role="alert"');
  expect(markup(container)).not.toContain('role="status"');

  const calls = loadTimelinePageMock.mock.calls.length;
  act(() => {
    click(findRole(container, 'button', '重试') as HTMLElement);
  });
  await flush();
  expect(loadTimelinePageMock.mock.calls.length).toBeGreaterThan(calls);
  expect(container.textContent).toContain('没加载出来，检查网络后再试');
  expect(findRole(container, 'alert')).not.toBeNull();
  expect(container.textContent).not.toContain('读取失败');
});

test('switching filters keeps the previous rows and shows only the refresh line', async () => {
  loadTimelinePageMock.mockResolvedValue({ records: [journal], nextCursor: null });
  const container = mount(createElement(TimelineScreen));
  await flush();
  expect(container.textContent).toContain('体重 76 kg');
  expect(container.textContent).not.toContain(REFRESHING_TEXT);
  expect(markup(container)).not.toContain('role="status"');

  loadTimelinePageMock.mockImplementation(() => new Promise(() => undefined));
  const filter = findRole(container, 'button', '资金');
  expect(filter).not.toBeNull();
  act(() => {
    click(filter as HTMLElement);
  });
  await flush();
  expect(container.textContent).toContain('体重 76 kg');
  expect(container.textContent).toContain(REFRESHING_TEXT);
  expect(container.textContent).toContain('时间线');
  expect(container.textContent).toContain('资金');
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);
  expect(markup(container)).not.toContain('role="status"');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(1500);
  });
  expect(container.textContent).toContain('体重 76 kg');
  expect(container.textContent).toContain(REFRESHING_TEXT);
  expect(container.textContent).not.toContain('正在加载时间线');
  expect(markup(container)).not.toContain('role="status"');
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);

  loadTimelinePageMock.mockRejectedValue({ status: 500, message: 'down' });
  const journalFilter = findRole(container, 'button', '日志');
  act(() => {
    click(journalFilter as HTMLElement);
  });
  await flush();
  expect(container.textContent).toContain('体重 76 kg');
  expect(container.textContent).toContain(REFRESH_FAILED_TEXT);
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);
  expect(container.textContent).not.toContain('读取失败');
  expect(findRole(container, 'alert')).toBeNull();
  expect(container.textContent).toContain('时间线');
});

test('a background refresh that runs past 8s keeps the rows and shows 更新失败 · 重试', async () => {
  loadTimelinePageMock.mockResolvedValue({ records: [journal], nextCursor: null });
  const container = mount(createElement(TimelineScreen));
  await flush();
  expect(container.textContent).toContain('体重 76 kg');

  loadTimelinePageMock.mockImplementation(() => new Promise(() => undefined));
  act(() => {
    click(findRole(container, 'button', '资金') as HTMLElement);
  });
  await flush();
  expect(container.textContent).toContain(REFRESHING_TEXT);
  expect(container.textContent).toContain('体重 76 kg');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(8000);
  });
  expect(container.textContent).toContain('体重 76 kg');
  expect(container.textContent).toContain('更新失败 · 重试');
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);
  expect(container.textContent).not.toContain('正在加载时间线');
});
