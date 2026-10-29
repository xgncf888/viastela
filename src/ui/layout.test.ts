import { Platform } from './loading-native';
import './test-dom';

import { afterEach, expect, jest, test } from '@jest/globals';
import { act, createElement, type ComponentProps, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { LineChart } from './LineChart';
import { Columns, Divider, headerSubtitleContent, ScreenHeader } from './layout';
import { maxFontSizeMultiplierFor } from './text-scale';
import { Text } from './Text';
import { lightColor, theme } from './theme';
import { tickOffset, weightAxis, weightXLabels } from './chart-ticks';

jest.mock('react-native', () => {
  // jest.mock factories cannot use ESM imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const web = require('react-native-web') as typeof import('react-native');
  return {
    ...web,
    useWindowDimensions: () => {
      const width = (globalThis as { __layoutWidth?: number }).__layoutWidth ?? 390;
      return { width, height: 844, scale: 1, fontScale: 1 };
    },
  };
});

jest.mock('react-native-svg', () => {
  // jest.mock factories cannot use ESM imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  const passthrough = (name: string) =>
    function SvgMock(props: { children?: React.ReactNode }) {
      return React.createElement(name, props, props.children);
    };
  return {
    __esModule: true,
    default: passthrough('svg'),
    Circle: passthrough('circle'),
    Line: passthrough('line'),
    Polyline: passthrough('polyline'),
  };
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

function setWidth(width: number) {
  (globalThis as { __layoutWidth?: number }).__layoutWidth = width;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    act(() => root?.unmount());
  }
  setWidth(390);
  Platform.OS = 'web';
});

test('Columns stacks main above aside below the desktop breakpoint and shares a row on it', () => {
  setWidth(theme.breakpoint.desktop - 1);
  const stacked = mount(
    createElement(Columns, {
      main: line('主栏'),
      aside: line('侧栏'),
    }),
  );
  const stackedRoot = stacked.firstElementChild as HTMLElement;
  expect(stackedRoot.style.flexDirection).toBe('column');
  expect(stackedRoot.style.gap).toBe(`${theme.space.md}px`);
  expect(stacked.textContent?.indexOf('主栏')).toBeLessThan(stacked.textContent?.indexOf('侧栏') ?? -1);

  setWidth(theme.breakpoint.desktop);
  const row = mount(
    createElement(Columns, {
      main: line('主栏'),
      aside: line('侧栏'),
    }),
  );
  const rowRoot = row.firstElementChild as HTMLElement;
  expect(rowRoot.style.flexDirection).toBe('row');
  expect(rowRoot.style.gap).toBe(`${theme.space.lg}px`);
  const shares = [...rowRoot.children] as HTMLElement[];
  expect(shares).toHaveLength(2);
  expect(shares.every((child) => child.style.flexGrow === '1' || child.style.flex === '1 1 0%' || child.style.flex === '1')).toBe(true);
});

test('Columns with columns={3} is a row on desktop and a stack below it', () => {
  setWidth(theme.breakpoint.tablet);
  const stacked = mount(
    createElement(
      Columns,
      { columns: 3 },
      ...['现金', '股票', '目标'].map((label) => line(label, label)),
    ),
  );
  const stackedRoot = stacked.firstElementChild as HTMLElement;
  expect(stackedRoot.style.flexDirection).toBe('column');
  expect(stackedRoot.style.gap).toBe(`${theme.space.md}px`);
  expect(stacked.textContent).toBe('现金股票目标');

  setWidth(theme.breakpoint.desktop);
  const grid = mount(
    createElement(
      Columns,
      { columns: 3 },
      ...['现金', '股票', '目标'].map((label) => line(label, label)),
    ),
  );
  const root = grid.firstElementChild as HTMLElement;
  expect(root.style.flexDirection).toBe('row');
  expect(root.style.gap).toBe(`${theme.space.lg}px`);
  expect(root.children).toHaveLength(3);
});

test('stackOrder puts aside first only while stacked', () => {
  setWidth(theme.breakpoint.desktop - 1);
  const stacked = mount(
    createElement(Columns, {
      stackOrder: 'aside-first',
      main: line('主栏'),
      aside: line('侧栏'),
    }),
  );
  const stackedRoot = stacked.firstElementChild as HTMLElement;
  expect(stackedRoot.style.flexDirection).toBe('column');
  expect(stackedRoot.style.gap).toBe(`${theme.space.md}px`);
  expect(stacked.textContent?.indexOf('侧栏')).toBeLessThan(stacked.textContent?.indexOf('主栏') ?? -1);

  setWidth(theme.breakpoint.desktop);
  const row = mount(
    createElement(Columns, {
      stackOrder: 'aside-first',
      main: line('主栏'),
      aside: line('侧栏'),
    }),
  );
  const rowRoot = row.firstElementChild as HTMLElement;
  expect(rowRoot.style.flexDirection).toBe('row');
  expect(rowRoot.style.gap).toBe(`${theme.space.lg}px`);
  expect(row.textContent?.indexOf('主栏')).toBeLessThan(row.textContent?.indexOf('侧栏') ?? -1);
});

test('Divider is a 1px line', () => {
  const node = mount(createElement(Divider));
  const rule = node.firstElementChild as HTMLElement;
  expect(rule.style.height).toBe(`${theme.border.width}px`);
  expect(rule.style.backgroundColor).toBe(rgba(lightColor.line));
});

test('the subtitle line prefers a failure, then a refresh, then the hint, then the description', () => {
  expect(headerSubtitleContent({ failed: true, refreshing: true, hint: '夜', description: '说明' })).toEqual({
    status: 'failed',
    text: null,
  });
  expect(headerSubtitleContent({ refreshing: true, hint: '夜', description: '说明' })).toEqual({
    status: 'refreshing',
    text: null,
  });
  expect(headerSubtitleContent({ hint: '夜', description: '说明' })).toEqual({ status: 'idle', text: '夜' });
  expect(headerSubtitleContent({ description: '说明' })).toEqual({ status: 'idle', text: '说明' });
  expect(headerSubtitleContent({})).toEqual({ status: 'idle', text: null });
});

test('ScreenHeader ignores the deprecated kicker', () => {
  const node = mount(createElement(ScreenHeader, { kicker: '趋势', title: '近 7 日', detail: '均重', note: '说明' }));
  expect(node.textContent).toContain('近 7 日');
  expect(node.textContent).toContain('均重');
  expect(node.textContent).toContain('说明');
  expect(node.textContent).not.toContain('趋势');
});

test('metric, tab, label, and caption use the type ramp', () => {
  expect(maxFontSizeMultiplierFor('metric')).toBe(theme.fontScale.heading);
  expect(maxFontSizeMultiplierFor('tab')).toBe(theme.fontScale.heading);
  expect(maxFontSizeMultiplierFor('label')).toBe(theme.fontScale.body);
  expect(maxFontSizeMultiplierFor('caption')).toBe(theme.fontScale.body);

  const metric = textStyle(line('72.5', undefined, 'metric'));
  expect(metric.fontSize).toBe(`${theme.font.metric}px`);
  expect(metric.lineHeight).toBe(`${theme.lineHeight.metric}px`);
  expect(metric.fontWeight).toBe(theme.fontWeight.semibold);
  expect(metric.color).toBe(rgba(lightColor.ink));

  const tab = textStyle(line('今日', undefined, 'tab'));
  expect(tab.fontSize).toBe(`${theme.font.tab}px`);
  expect(tab.lineHeight).toBe(`${theme.lineHeight.tab}px`);
  expect(tab.fontWeight).toBe(theme.fontWeight.regular);
  expect(tab.color).toBe(rgba(lightColor.ink));

  const label = textStyle(line('总资产', undefined, 'label'));
  expect(label.fontSize).toBe(`${theme.font.sm}px`);
  expect(label.lineHeight).toBe(`${theme.lineHeight.sm}px`);
  expect(label.fontWeight).toBe(theme.fontWeight.medium);
  expect(label.color).toBe(rgba(lightColor.muted));

  const caption = textStyle(line('每日晨重', undefined, 'caption'));
  expect(caption.fontSize).toBe(`${theme.font.caption}px`);
  expect(caption.lineHeight).toBe(`${theme.lineHeight.caption}px`);
  expect(caption.fontWeight).toBe(theme.fontWeight.regular);
  expect(caption.color).toBe(rgba(lightColor.muted));
});

test('LineChart puts the unit at the top and keeps it out of the tick labels', () => {
  const ticks = weightAxis([72.4, 75.1, 78.6]);
  const xTicks = weightXLabels(2026, 10, 1);
  const node = mount(
    createElement(LineChart, {
      points: [
        { id: 'a', position: 0, raw: 72.4, trend: 73 },
        { id: 'b', position: 1, raw: 78.6, trend: 76 },
      ],
      startLabel: '10/01',
      endLabel: '10/28',
      rawLabel: '每日晨重',
      trendLabel: '平滑趋势',
      accessibilityLabel: '近 28 日体重',
      ticks,
      unit: 'kg',
      xTicks,
    }),
  );
  expect(exactText(node, 'kg')).not.toBeNull();
  for (const tick of ticks) {
    expect(exactText(node, tick.label)).not.toBeNull();
    expect(tick.label.includes('kg')).toBe(false);
  }
  for (const tick of xTicks) expect(exactText(node, tick.label)).not.toBeNull();
  expect(exactText(node, '72 kg')).toBeNull();
  expect(exactText(node, 'kg72')).toBeNull();

  const unit = exactText(node, 'kg') as HTMLElement;
  expect(unit.style.fontSize).toBe(`${theme.font.tick}px`);
  expect(unit.style.lineHeight).toBe(`${theme.lineHeight.tick}px`);
  expect(unit.style.fontWeight).toBe(theme.fontWeight.regular);
  expect(unit.style.color).toBe(rgba(lightColor.muted));
  expect(unit.style.fontFamily).toContain('ui-monospace');
});

test('LineChart height defaults to layout.chart and otherwise uses the prop', () => {
  const props = {
    points: [
      { id: 'a', position: 0, raw: 72.4, trend: 73 },
      { id: 'b', position: 1, raw: 78.6, trend: 76 },
    ],
    startLabel: '10/01',
    endLabel: '10/28',
    rawLabel: '每日晨重',
    trendLabel: '平滑趋势',
    accessibilityLabel: '近 28 日体重',
  };
  const def = mount(createElement(LineChart, props));
  expect(styleHeights(def)).toContain(`${theme.layout.chart}px`);

  const wide = theme.layout.chartWide;
  expect(wide).toBe(220);
  const ticks = weightAxis([72.4, 78.6]);
  const node = mount(createElement(LineChart, { ...props, height: wide, ticks, unit: 'kg' }));
  const heights = styleHeights(node);
  expect(heights.filter((value) => value === `${wide}px`).length).toBeGreaterThanOrEqual(2);
  const label = exactText(node, ticks[0].label) as HTMLElement;
  expect(label.style.top).toBe(`${tickOffset(ticks[0].position, wide) - theme.lineHeight.tick / 2}px`);
});

function styleHeights(node: HTMLElement): string[] {
  const found: string[] = [];
  const walk = (current: Node) => {
    if (current.nodeType !== 1) return;
    const element = current as HTMLElement;
    if (element.style.height) found.push(element.style.height);
    element.childNodes.forEach(walk);
  };
  node.childNodes.forEach(walk);
  return found;
}

function line(label: string, key?: string, variant?: ComponentProps<typeof Text>['variant']) {
  return createElement(Text, { key, variant } as unknown as ComponentProps<typeof Text>, label);
}

function textStyle(node: ReactNode): CSSStyleDeclaration {
  const mounted = mount(node);
  const text = exactText(mounted, mounted.textContent ?? '');
  if (!text) throw new Error('missing text');
  return text.style;
}

function exactText(node: ParentNode, text: string): HTMLElement | null {
  const walk = (current: Node): HTMLElement | null => {
    if (current.nodeType !== 1) return null;
    const element = current as HTMLElement;
    if (element.children.length === 0 && element.textContent === text) return element;
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

function rgba(hex: string): string {
  const value = hex.replace('#', '');
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},1.00)`;
}
