import './test-dom';

import { afterEach, expect, jest, test } from '@jest/globals';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import {
  Animated as DomAnimated,
  Easing as DomEasing,
  flattenAndNormalizeStyle,
  Pressable,
  StyleSheet as DomStyleSheet,
  Text as DomText,
  View as DomView,
} from '@/lib/web-shims/react-native-dom';

import { cn, DomGrid, DomSurface, webSlot } from './dom';
import { Text } from './Text';

jest.mock('@/styles/app.css', () => ({}));

jest.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/web-shims/react-native-dom') as typeof import('react-native');
});

jest.mock('react-native-svg', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/web-shims/react-native-svg') as typeof import('react-native-svg');
});

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/web-shims/safe-area-context') as typeof import('react-native-safe-area-context');
});

jest.mock('@react-native-async-storage/async-storage', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/web-shims/async-storage') as typeof import('@react-native-async-storage/async-storage');
});

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/web-shims/expo-router') as typeof import('expo-router');
});

jest.mock('expo-constants', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/web-shims/expo-misc') as typeof import('expo-constants');
});

jest.mock('expo-linking', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/web-shims/expo-misc') as typeof import('expo-linking');
});

jest.mock('expo-status-bar', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/web-shims/expo-misc') as typeof import('expo-status-bar');
});

jest.mock('expo-system-ui', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/lib/web-shims/expo-misc') as typeof import('expo-system-ui');
});

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

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => root?.unmount());
  }
});

test('cn merges Tailwind CSS v4 classes cleanly', () => {
  expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  expect(cn('bg-card', false && 'hidden', 'text-foreground')).toBe('bg-card text-foreground');
});

test('webSlot stays a no-op in Jest test environment to preserve DOM snapshots', () => {
  expect(webSlot('card', { interactive: 'true' })).toEqual({});
});

test('DomGrid and DomSurface render children cleanly', () => {
  const view = mount(
    createElement(
      DomGrid,
      { columns: 4, gap: 'sm' },
      createElement(DomSurface, { variant: 'card', interactive: true }, createElement(Text, null, 'KPI 1')),
      createElement(DomSurface, { variant: 'recessed' }, createElement(Text, null, 'KPI 2')),
    ),
  );
  expect(view.textContent).toBe('KPI 1KPI 2');
});

test('pure React 19 native DOM engine normalizes shorthand styles and renders semantic HTML', () => {
  const style = flattenAndNormalizeStyle([
    { paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, opacity: 0.9 },
    { transform: [{ scale: 0.98 }, { translateY: 4 }] },
  ]);
  expect(style.paddingLeft).toBe('16px');
  expect(style.paddingRight).toBe('16px');
  expect(style.paddingTop).toBe('8px');
  expect(style.paddingBottom).toBe('8px');
  expect(style.borderStyle).toBe('solid');
  expect(style.opacity).toBe(0.9);
  expect(style.transform).toBe('scale(0.98) translateY(4px)');

  const onPress = jest.fn();
  const node = mount(
    createElement(
      DomView,
      { testID: 'pure-dom-box', dataSet: { slot: 'card' } },
      createElement(
        Pressable,
        { accessibilityLabel: '原生按钮', onPress },
        createElement(DomText, { numberOfLines: 1 }, '点击'),
      ),
    ),
  );
  expect(node.textContent).toBe('点击');
});

test('pure React 19 native DOM engine supports Animated.Value.interpolate, Easing.quad, and mounts BootScreen + ViteRootApp without white-screen crash', () => {
  const spin = new DomAnimated.Value(0);
  const pulse = new DomAnimated.Value(1);
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  expect(DomEasing.inOut(DomEasing.quad)(0.5)).toBeCloseTo(0.25, 5);
  expect(DomStyleSheet.absoluteFillObject).toEqual({
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  });

  const normalized = flattenAndNormalizeStyle({
    opacity: pulse,
    transform: [{ rotate }, { scale: pulse }],
  });
  expect(normalized.opacity).toBe(1);
  expect(normalized.transform).toBe('rotate(0deg) scale(1)');

  // Mount actual BootScreen and ViteRootApp against react-native-dom shim
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { BootScreen } = require('@/features/auth/BootScreen') as typeof import('@/features/auth/BootScreen');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ViteRootApp } = require('@/main') as typeof import('@/main');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ThemeProvider } = require('@/ui/ThemeProvider') as typeof import('@/ui/ThemeProvider');

  const bootNode = mount(createElement(ThemeProvider, null, createElement(BootScreen)));
  expect(bootNode.textContent).toContain('正在打开');

  const appNode = mount(createElement(ViteRootApp));
  expect(appNode.textContent?.trim().length).toBeGreaterThan(0);
});
