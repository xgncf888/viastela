import './test-dom';

import { afterEach, expect, jest, test } from '@jest/globals';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { flattenAndNormalizeStyle, Pressable, Text as DomText, View as DomView } from '@/lib/web-shims/react-native-dom';

import { cn, DomGrid, DomSurface, webSlot } from './dom';
import { Text } from './Text';

jest.mock('react-native', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-web') as typeof import('react-native');
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
