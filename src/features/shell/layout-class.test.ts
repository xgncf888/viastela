import { expect, test } from '@jest/globals';

import { layoutClassForWidth } from '@/ui/layout-class';
import { maxFontSizeMultiplierFor } from '@/ui/text-scale';
import { theme } from '@/ui/theme';

test('layout class follows the 600 and 1024 window-width cuts', () => {
  expect(layoutClassForWidth(0)).toBe('compact');
  expect(layoutClassForWidth(599)).toBe('compact');
  expect(layoutClassForWidth(600)).toBe('medium');
  expect(layoutClassForWidth(1023)).toBe('medium');
  expect(layoutClassForWidth(1024)).toBe('expanded');
  expect(layoutClassForWidth(1440)).toBe('expanded');
  expect(theme.breakpoint.tablet).toBe(600);
  expect(theme.breakpoint.desktop).toBe(1024);
});

test('shell sizes used by the three layout classes', () => {
  expect(theme.layout.sidebar).toBe(228);
  expect(theme.layout.sidebarCompact).toBe(184);
  expect(theme.layout.contentWide).toBe(1080);
  expect(theme.layout.tabBar).toBe(56);
  expect(theme.layout).not.toHaveProperty('wide');
});

test('text scale caps match the type ladder', () => {
  expect(theme.fontScale.body).toBe(1.3);
  expect(theme.fontScale.heading).toBe(1.2);
  for (const variant of ['body', 'label', 'muted', 'caption'] as const) {
    expect(maxFontSizeMultiplierFor(variant)).toBe(1.3);
  }
  for (const variant of ['display', 'title', 'metric', 'heading', 'tab'] as const) {
    expect(maxFontSizeMultiplierFor(variant)).toBe(1.2);
  }
});

test('faces are system stacks with tabular figures reserved for numbers', () => {
  expect(theme.fontFamily.sans).toBe(
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif',
  );
  expect(theme.fontFamily.serif).toBe('"Songti SC", "Noto Serif CJK SC", serif');
  expect(theme.fontFamily.sans).not.toContain('Inter');
  expect(theme.fontFamily.serif).not.toContain('Georgia');
});
