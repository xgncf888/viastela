import { Animated, Platform } from './loading-native';
import './test-dom';

import { afterEach, expect, jest, test } from '@jest/globals';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { formatQuoteClock } from '@/core/quote-label';
import { PULSE_DURATION_MS } from '@/lib/timing';

import { lockedButtonMinWidth, nextMeasuredWidth, visibleButtonLabel, Button } from './Button';
import { LOAD_ERROR_TEXT, LOAD_RETRY_LABEL, LoadingRegion, showLoadError } from './LoadingRegion';
import {
  REFRESH_FAILED_TEXT,
  REFRESH_RETRY_LABEL,
  REFRESHING_TEXT,
  RefreshStatus,
  refreshFailedText,
} from './RefreshStatus';
import { resetSkeletonPulseForTests, SKELETON_PULSE_LOW, SKELETON_REDUCED_OPACITY, skeletonHiddenProps, Skeleton, SkeletonText } from './Skeleton';
import { darkColor, lightColor } from './theme';
import { useLoadGate } from './use-load-gate';

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
      isReduceMotionEnabled: () => Promise.resolve(Boolean((globalThis as { __reduceMotion?: boolean }).__reduceMotion)),
      addEventListener: () => ({ remove() {} }),
      announceForAccessibility: (message: string) => {
        const bucket = globalThis as { __announcements?: string[] };
        bucket.__announcements = bucket.__announcements ?? [];
        bucket.__announcements.push(message);
      },
    },
  };
});

const roots: Root[] = [];
const timing = Animated.timing as unknown as jest.Mock;
const loop = Animated.loop as unknown as jest.Mock;

function host(): { __announcements?: string[]; __reduceMotion?: boolean } {
  return globalThis as { __announcements?: string[]; __reduceMotion?: boolean };
}

function mount(node: ReactNode): HTMLElement {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  roots.push(root);
  return container;
}

function setReducedMotion(reduced: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduced && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  })) as typeof window.matchMedia;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => root?.unmount());
  }
  jest.useRealTimers();
  Platform.OS = 'web';
  host().__announcements = [];
  host().__reduceMotion = false;
  timing.mockClear();
  loop.mockClear();
  resetSkeletonPulseForTests();
});

test('button loading keeps the resting label unless the caller passes one, and locks the measured width', () => {
  expect(visibleButtonLabel('保存', true)).toBe('保存');
  expect(visibleButtonLabel('保存', true, '保存中…')).toBe('保存中…');
  expect(visibleButtonLabel('保存', false, '保存中…')).toBe('保存');

  let measured = nextMeasuredWidth(null, 180, false);
  expect(lockedButtonMinWidth(measured, true)).toBe(180);
  measured = nextMeasuredWidth(measured, 240, true);
  expect(measured).toBe(180);
  expect(lockedButtonMinWidth(measured, false)).toBeNull();

  const pressed = jest.fn();
  const loading = mount(createElement(Button, { label: '保存', loading: true, loadingLabel: '保存中…', onPress: pressed }));
  expect(loading.textContent).toBe('保存中…');
  expect(markup(loading)).toContain('aria-busy="true"');
  expect(markup(loading)).toContain('aria-disabled="true"');

  const resting = mount(createElement(Button, { label: '保存', loading: true, onPress: pressed }));
  expect(resting.textContent).toBe('保存');
  expect(markup(resting)).toContain('aria-busy="true"');

  const idle = mount(createElement(Button, { label: '保存', onPress: pressed }));
  expect(markup(idle)).not.toContain('aria-busy');

  const busy = findRole(loading, 'button');
  expect(busy?.style.opacity ?? '').not.toBe('0.55');
  const off = mount(createElement(Button, { label: '保存', disabled: true, onPress: pressed }));
  const disabled = findRole(off, 'button');
  expect(disabled?.style.opacity).toBe('0.55');
});

test('the load gate waits, holds the skeleton, then times out', async () => {
  jest.useFakeTimers({ now: 1_700_000_000_000 });
  let loading = true;
  function Probe() {
    const gate = useLoadGate(loading);
    return createElement('span', null, `${gate.phase}|${gate.showSkeleton}|${gate.busy}|${gate.timedOut}`);
  }
  const container = mount(createElement(Probe));
  expect(container.textContent).toBe('delay|false|true|false');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(999);
  });
  expect(container.textContent).toBe('delay|false|true|false');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(container.textContent).toBe('skeleton|true|true|false');

  loading = false;
  await act(async () => {
    roots[0]?.render(createElement(Probe));
  });
  expect(container.textContent).toBe('hold|true|true|false');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(399);
  });
  expect(container.textContent).toBe('hold|true|true|false');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(container.textContent).toBe('idle|false|false|false');
});

test('a load that is still running at 8 seconds is timed out', async () => {
  jest.useFakeTimers({ now: 1_700_000_000_000 });
  function Probe() {
    const gate = useLoadGate(true);
    return createElement('span', null, `${gate.phase}|${gate.timedOut}|${gate.showSkeleton}`);
  }
  const container = mount(createElement(Probe));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(7999);
  });
  expect(container.textContent).toBe('skeleton|false|true');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(container.textContent).toBe('timeout|true|true');
});

test('LoadingRegion mounts the status node while loading and removes it when loading ends', async () => {
  jest.useFakeTimers({ now: 1_700_000_000_000 });
  let loading = true;
  function Probe() {
    // Children are a required prop, so they are passed in the props object.
    // eslint-disable-next-line react/no-children-prop
    return createElement(LoadingRegion, {
      name: '今日',
      loading,
      skeleton: createElement('span', null, '骨架'),
      children: createElement('span', null, '正文'),
      onRetry: () => undefined,
    });
  }
  const container = mount(createElement(Probe));
  expect(container.textContent).toContain('正在加载今日');
  expect(container.textContent).not.toContain('骨架');
  expect(container.textContent).not.toContain('正文');
  expect(markup(container)).toContain('aria-busy="true"');
  expect(markup(container)).toContain('role="status"');
  const status = findRole(container, 'status');
  expect(status?.style.position).toBe('absolute');
  expect(status?.style.clip).toBe('rect(0 0 0 0)');
  expect(status?.style.clipPath).toBe('inset(50%)');
  expect(status?.style.overflowX).toBe('hidden');
  expect(status?.style.overflowY).toBe('hidden');
  expect(status?.style.width).toBe('1px');
  expect(status?.style.height).toBe('1px');
  expect(status?.style.whiteSpace).toBe('nowrap');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(container.textContent).toContain('骨架');
  expect(container.textContent).toContain('正在加载今日');

  loading = false;
  await act(async () => {
    roots[0]?.render(createElement(Probe));
  });
  expect(container.textContent).toContain('正在加载今日');
  expect(container.textContent).not.toContain('正文');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(400);
  });
  expect(container.textContent).not.toContain('正在加载今日');
  expect(container.textContent).toContain('正文');
  expect(markup(container)).not.toContain('aria-busy');
  expect(markup(container)).not.toContain('role="status"');
});

test('a fast load never mounts the status node past the response', async () => {
  jest.useFakeTimers({ now: 1_700_000_000_000 });
  let loading = true;
  function Probe() {
    // eslint-disable-next-line react/no-children-prop
    return createElement(LoadingRegion, {
      name: '资产',
      loading,
      skeleton: createElement('span', null, '骨架'),
      children: createElement('span', null, '正文'),
      onRetry: () => undefined,
    });
  }
  const container = mount(createElement(Probe));
  expect(container.textContent).toContain('正在加载资产');
  loading = false;
  await act(async () => {
    roots[0]?.render(createElement(Probe));
  });
  expect(container.textContent).toBe('正文');
  expect(markup(container)).not.toContain('aria-busy');
  expect(markup(container)).not.toContain('role="status"');
});

test('showLoadError is on for a timeout or a passed error', () => {
  expect(showLoadError(true, undefined)).toBe(true);
  expect(showLoadError(false, undefined)).toBe(false);
  expect(showLoadError(false, false)).toBe(false);
  expect(showLoadError(true, false)).toBe(true);
  expect(showLoadError(false, true)).toBe(true);
});

type LoadingRegionProps = Parameters<typeof LoadingRegion>[0];
type OnRetryRequired = undefined extends LoadingRegionProps['onRetry'] ? false : true;

test('onRetry is required so a timeout cannot stay on the skeleton', () => {
  const onRetryIsRequired: OnRetryRequired = true;
  expect(onRetryIsRequired).toBe(true);
});

test('timeout with onRetry, or a passed error, swaps the skeleton for the callout', async () => {
  jest.useFakeTimers({ now: 1_700_000_000_000 });
  const retry = jest.fn();
  const timedOut = mount(
    // eslint-disable-next-line react/no-children-prop
    createElement(LoadingRegion, {
      name: '今日',
      loading: true,
      onRetry: retry,
      skeleton: createElement('span', null, '骨架'),
      children: createElement('span', null, '正文'),
    }),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(timedOut.textContent).toContain('骨架');
  expect(timedOut.textContent).not.toContain(LOAD_ERROR_TEXT);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(7000);
  });
  expect(timedOut.textContent).toContain(LOAD_ERROR_TEXT);
  expect(timedOut.textContent).toContain(LOAD_RETRY_LABEL);
  expect(timedOut.textContent).not.toContain('骨架');
  expect(timedOut.textContent).not.toContain('正在加载今日');
  expect(timedOut.textContent).not.toContain('正文');
  expect(markup(timedOut)).not.toContain('aria-busy');
  expect(markup(timedOut)).not.toContain('role="status"');
  expect(markup(timedOut)).toContain('role="alert"');
  expect(markup(timedOut)).toContain('role="button"');
  expect(host().__announcements).toEqual([]);

  const failed = mount(
    // eslint-disable-next-line react/no-children-prop
    createElement(LoadingRegion, {
      name: '资产',
      loading: true,
      error: true,
      onRetry: retry,
      skeleton: createElement('span', null, '骨架'),
      children: createElement('span', null, '正文'),
    }),
  );
  expect(failed.textContent).toContain(LOAD_ERROR_TEXT);
  expect(failed.textContent).not.toContain('正在加载资产');
  expect(failed.textContent).not.toContain('骨架');
  expect(markup(failed)).not.toContain('aria-busy');
  expect(markup(failed)).not.toContain('role="status"');

  Platform.OS = 'ios';
  host().__announcements = [];
  mount(
    // eslint-disable-next-line react/no-children-prop
    createElement(LoadingRegion, {
      name: '资产',
      loading: true,
      error: true,
      onRetry: retry,
      skeleton: createElement('span', null, '骨架'),
      children: createElement('span', null, '正文'),
    }),
  );
  expect(host().__announcements).toEqual([LOAD_ERROR_TEXT]);
});

test('a timeout shows retry and recovers when the load finishes', async () => {
  jest.useFakeTimers({ now: 1_700_000_000_000 });
  const retry = jest.fn();
  let loading = true;
  function Probe() {
    // eslint-disable-next-line react/no-children-prop
    return createElement(LoadingRegion, {
      name: '今日',
      loading,
      onRetry: retry,
      skeleton: createElement('span', null, '骨架'),
      children: createElement('span', null, '正文'),
    });
  }
  const container = mount(createElement(Probe));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(7000);
  });
  expect(container.textContent).toContain(LOAD_ERROR_TEXT);
  expect(container.textContent).toContain(LOAD_RETRY_LABEL);
  expect(container.textContent).not.toContain('骨架');
  const button = findRole(container, 'button');
  expect(button).not.toBeNull();
  const colored = textColor(button as HTMLElement);
  expect(colored.replace(/\s/g, '')).toContain('148,74,52');
  act(() => {
    button?.dispatchEvent(clickEvent(button));
  });
  expect(retry).toHaveBeenCalledTimes(1);
  loading = false;
  await act(async () => {
    roots[0]?.render(createElement(Probe));
  });
  expect(container.textContent).toContain('正文');
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);
});

test('retry after a timeout starts a new 8 second budget while loading stays true', async () => {
  jest.useFakeTimers({ now: 1_700_000_000_000 });
  const retry = jest.fn();
  function Probe() {
    // eslint-disable-next-line react/no-children-prop
    return createElement(LoadingRegion, {
      name: '今日',
      loading: true,
      onRetry: retry,
      skeleton: createElement('span', null, '骨架'),
      children: createElement('span', null, '正文'),
    });
  }
  const container = mount(createElement(Probe));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(7000);
  });
  expect(container.textContent).toContain(LOAD_ERROR_TEXT);
  expect(container.textContent).not.toContain('正在加载今日');

  const button = findRole(container, 'button');
  act(() => {
    button?.dispatchEvent(clickEvent(button as HTMLElement));
  });
  expect(retry).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('正在加载今日');
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);
  expect(container.textContent).not.toContain('骨架');

  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(container.textContent).toContain('骨架');
  expect(container.textContent).toContain('正在加载今日');
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);

  await act(async () => {
    await jest.advanceTimersByTimeAsync(6999);
  });
  expect(container.textContent).not.toContain(LOAD_ERROR_TEXT);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1);
  });
  expect(container.textContent).toContain(LOAD_ERROR_TEXT);
  expect(container.textContent).not.toContain('正在加载今日');
  expect(container.textContent).not.toContain('骨架');
});

test('a load that restarts during the 400ms hold keeps the skeleton', async () => {
  jest.useFakeTimers({ now: 1_700_000_000_000 });
  let loading = true;
  function Probe() {
    const gate = useLoadGate(loading);
    return createElement('span', null, `${gate.phase}|${gate.showSkeleton}`);
  }
  const container = mount(createElement(Probe));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(1000);
  });
  expect(container.textContent).toBe('skeleton|true');
  loading = false;
  await act(async () => {
    roots[0]?.render(createElement(Probe));
  });
  expect(container.textContent).toBe('hold|true');
  loading = true;
  await act(async () => {
    roots[0]?.render(createElement(Probe));
  });
  expect(container.textContent).toBe('skeleton|true');
});

test('a skeleton does not animate when reduced motion is on', async () => {
  setReducedMotion(true);
  const reduced = mount(createElement(Skeleton, { width: 80, height: 16 }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(loop).not.toHaveBeenCalled();
  const block = reduced.firstElementChild as HTMLElement;
  expect(block.style.opacity).toBe(String(SKELETON_REDUCED_OPACITY));
});

test('skeletons use the skeleton token, hide from assistive tech, and stay still when motion is reduced', async () => {
  expect(lightColor.skeleton).toBe('#E2DFD5');
  expect(darkColor.skeleton).toBe('#363632');
  expect(skeletonHiddenProps['aria-hidden']).toBe(true);
  expect(skeletonHiddenProps.importantForAccessibility).toBe('no-hide-descendants');
  expect(skeletonHiddenProps.accessibilityElementsHidden).toBe(true);

  setReducedMotion(true);
  const reduced = mount(createElement(Skeleton, { width: 96, height: 16, radius: 'md' }));
  await act(async () => {
    await Promise.resolve();
  });
  const block = reduced.firstElementChild as HTMLElement;
  expect(markup(reduced)).toContain('aria-hidden="true"');
  expect(block.style.opacity).toBe(String(SKELETON_REDUCED_OPACITY));
  expect(block.style.backgroundColor).toBe('rgba(226,223,213,1.00)');
  expect(block.style.width).toBe('96px');
  expect(block.style.height).toBe('16px');
  expect(loop).not.toHaveBeenCalled();

  setReducedMotion(false);
  loop.mockClear();
  mount(createElement(SkeletonText, { lines: 3 }));
  await act(async () => {
    await Promise.resolve();
  });
  expect(loop).toHaveBeenCalledTimes(1);
  const durations = timing.mock.calls.map(
    (call) => call[1] as { duration: number; toValue: number; useNativeDriver: boolean },
  );
  expect(durations.map((item) => item.toValue)).toEqual([SKELETON_PULSE_LOW, 1]);
  expect(durations.every((item) => item.duration === PULSE_DURATION_MS / 2)).toBe(true);
  expect(durations.every((item) => item.useNativeDriver === false)).toBe(true);

  Platform.OS = 'ios';
  host().__reduceMotion = true;
  loop.mockClear();
  timing.mockClear();
  mount(createElement(Skeleton, { height: 24, width: 160 }));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(loop).not.toHaveBeenCalled();
});

test('refresh status copies the three states and only announces a failure', () => {
  const retry = jest.fn();
  const refreshing = mount(createElement(RefreshStatus, { status: 'refreshing', onRetry: retry, timeZone: 'UTC' }));
  expect(refreshing.textContent).toBe(REFRESHING_TEXT);
  expect(host().__announcements).toEqual([]);

  Platform.OS = 'ios';
  const failed = mount(
    createElement(RefreshStatus, { status: 'failed', onRetry: retry, timeZone: 'UTC', idle: createElement('span', null, '闲置') }),
  );
  expect(failed.textContent).toContain(REFRESH_FAILED_TEXT);
  expect(failed.textContent).toContain(REFRESH_RETRY_LABEL);
  expect(failed.textContent).toContain('更新失败 · 重试');
  expect(markup(failed)).toContain('role="button"');
  expect(host().__announcements).toEqual([REFRESH_FAILED_TEXT]);

  const idle = mount(
    createElement(RefreshStatus, { status: 'idle', onRetry: retry, timeZone: 'UTC', idle: createElement('span', null, '闲置') }),
  );
  expect(idle.textContent).toBe('闲置');

  const cachedAt = '2026-01-15T00:30:00.000Z';
  const zone = 'Asia/Singapore';
  const clock = formatQuoteClock(cachedAt, zone);
  expect(clock).toBe('08:30');
  expect(refreshFailedText(cachedAt, 'UTC')).toBe('更新失败 · 行情更新于 00:30 · 重试');
  const cached = mount(createElement(RefreshStatus, { status: 'failed', onRetry: retry, cachedAt, timeZone: zone }));
  expect(cached.textContent).toBe(refreshFailedText(cachedAt, zone));
  expect(cached.textContent).toBe(`更新失败 · 行情更新于 ${clock} · 重试`);
  const cachedLead = findText(cached, `更新失败 · 行情更新于 ${clock} · `);
  expect(textColor(cachedLead as HTMLElement).replace(/\s/g, '')).toContain('138,90,18');
  const cachedRetry = findRole(cached, 'button');
  expect(cachedRetry?.textContent).toBe(REFRESH_RETRY_LABEL);
  expect(textColor(cachedRetry as HTMLElement).replace(/\s/g, '')).toContain('148,74,52');
  act(() => {
    cachedRetry?.dispatchEvent(clickEvent(cachedRetry));
  });
  expect(retry).toHaveBeenCalledTimes(1);
  const plain = mount(createElement(RefreshStatus, { status: 'failed', onRetry: retry, timeZone: 'UTC' }));
  const retryText = findRole(plain, 'button');
  expect(retryText?.textContent).toBe(REFRESH_RETRY_LABEL);
  expect(textColor(retryText as HTMLElement).replace(/\s/g, '')).toContain('148,74,52');
});

function findText(node: ParentNode, text: string): HTMLElement | null {
  const walk = (current: Node): HTMLElement | null => {
    if (current.nodeType !== 1) return null;
    const element = current as HTMLElement;
    if (element.textContent === text) return element;
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

function findRole(node: ParentNode, role: string): HTMLElement | null {
  const walk = (current: Node): HTMLElement | null => {
    if (current.nodeType !== 1) return null;
    const element = current as HTMLElement;
    if (element.getAttribute('role') === role) return element;
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

function textColor(node: HTMLElement): string {
  if (node.style.color) return node.style.color;
  for (const child of node.childNodes) {
    if (child.nodeType !== 1) continue;
    const color = textColor(child as HTMLElement);
    if (color) return color;
  }
  return '';
}

function clickEvent(target: HTMLElement): Event {
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
    target,
    currentTarget: target,
    preventDefault() {
      event.defaultPrevented = true;
    },
    stopPropagation() {},
  };
  return event as unknown as Event;
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
