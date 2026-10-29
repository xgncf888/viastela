import { Platform } from './loading-native';
import './test-dom';

import { afterEach, expect, jest, test } from '@jest/globals';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { BRAND_MARK_STAR, BRAND_MARK_V, BrandMark } from './BrandMark';
import { Button, MINI_HIT_SLOP } from './Button';
import { EmptyState } from './EmptyState';
import { ListRow } from './ListRow';
import { lightColor, theme } from './theme';

jest.mock('react-native', () => {
  // jest.mock factories cannot use ESM imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('react-native-web') as typeof import('react-native');
});

jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));

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

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => root?.unmount());
  }
});

test('ListRow renders label, subtitle, value with unit, meta and its one action in order', () => {
  const view = mount(
    createElement(ListRow, {
      label: '体重',
      subtitle: '08:10 晨重',
      value: '61.4',
      unit: 'kg',
      meta: '今天',
      action: createElement(Button, { label: '记录', size: 'mini', accessibilityLabel: '记录体重', onPress: () => {} }),
    }),
  );
  expect(view.textContent).toBe('体重08:10 晨重61.4kg今天记录');
  expect(markup(view)).toContain('aria-label="记录体重"');
});

test('ListRow with onPress is one button that reports expanded and reads the summary', () => {
  const pressed = jest.fn();
  const view = mount(
    createElement(ListRow, {
      label: '训练',
      value: '2 组',
      onPress: pressed,
      expanded: false,
      accessibilityLabel: '深蹲 1 组 · 卧推 1 组',
      last: true,
    }),
  );
  const html = markup(view);
  expect(html).toContain('role="button"');
  expect(html).toContain('aria-expanded="false"');
  expect(html).toContain('aria-label="深蹲 1 组 · 卧推 1 组"');
});

test('ListRow leaves value and unit out when there is nothing to show', () => {
  const view = mount(createElement(ListRow, { label: '学习', subtitle: '还没记' }));
  expect(view.textContent).toBe('学习还没记');
});

test('EmptyState has no default copy: it shows exactly the title and description it is given', () => {
  const titleOnly = mount(createElement(EmptyState, { title: '先记第一笔' }));
  expect(titleOnly.textContent).toBe('先记第一笔');
  const both = mount(createElement(EmptyState, { title: '还没有账户', description: '先添加一个账户。' }));
  expect(both.textContent).toBe('还没有账户先添加一个账户。');
});

test('EmptyState title is required by the type', () => {
  // Never called; tsc checks the line below.
  const typeOnly = () =>
    // @ts-expect-error `title` is required (§5).
    createElement(EmptyState, { description: '只有描述' });
  expect(typeof typeOnly).toBe('function');
});

test('mini button keeps a 44pt target and uses the caller’s accessible name', () => {
  expect(theme.layout.controlMini + MINI_HIT_SLOP.top + MINI_HIT_SLOP.bottom).toBe(theme.layout.control);
  const view = mount(createElement(Button, { label: '记录', size: 'mini', accessibilityLabel: '记录训练', onPress: () => {} }));
  expect(view.textContent).toBe('记录');
  expect(markup(view)).toContain('aria-label="记录训练"');
});

test('ghost button without an accessibilityLabel still reads its visible label', () => {
  const view = mount(createElement(Button, { label: '关闭', variant: 'ghost', onPress: () => {} }));
  expect(markup(view)).toContain('aria-label="关闭"');
});

test('BrandMark draws the V in ink and the star in accent at the mark size, hidden from readers', () => {
  expect(Platform.OS).toBe('web');
  const view = mount(createElement(BrandMark));
  const html = markup(view);
  expect(html).toContain(`width="${theme.layout.mark}"`);
  expect(html).toContain('aria-hidden="true"');
  expect(html).toContain(`d="${BRAND_MARK_V}"`);
  expect(html).toContain(`stroke="${lightColor.ink}"`);
  expect(html).toContain(`d="${BRAND_MARK_STAR}"`);
  expect(html).toContain(`fill="${lightColor.accent}"`);
});
