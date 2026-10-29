import { expect, test } from '@jest/globals';

import { brand } from '@/config/brand';

import {
  SERIF_GLYPHS,
  plainText,
  serifCovers,
  webSerifStack,
} from './serif-glyphs';
import { theme } from './theme';

test('the serif glyph list is the 46 characters from DESIGN §2.1', () => {
  expect([...SERIF_GLYPHS]).toHaveLength(46);
  expect(new Set(SERIF_GLYPHS).size).toBe(46);
  expect(SERIF_GLYPHS.includes(brand.displayName)).toBe(false);
  expect(serifCovers(brand.displayName)).toBe(true);
  expect(serifCovers(brand.webName)).toBe(true);
  for (const title of ['10月28日', '资产', '体重趋势', '我的', '删除账号', '正在删除账号', '账号已删除', '隐私政策', '找不到这一页', '']) {
    expect(serifCovers(title)).toBe(true);
  }
});

test('a title with any character outside the subset is not covered', () => {
  expect(serifCovers('10月28日 周三')).toBe(false);
  expect(serifCovers('总资产')).toBe(false);
  expect(serifCovers('添加账户')).toBe(false);
  expect(serifCovers('近7日')).toBe(false);
});

test('plain text walks nested children before the coverage check', () => {
  expect(plainText(['10', '月', 28, '日'])).toBe('10月28日');
  expect(plainText({ props: { children: '资产' } })).toBe('资产');
  expect(plainText(null)).toBe('');
  expect(serifCovers(plainText(['总', '资产']))).toBe(false);
});

test('the web stack keeps the system serif token behind the subset face', () => {
  expect(webSerifStack(brand.displayName, theme.fontFamily.serif)).toBe(
    `"${brand.displayName} Serif", ${theme.fontFamily.serif}`,
  );
  expect(theme.fontFamily.serif).toBe('"Songti SC", "Noto Serif CJK SC", serif');
  expect(theme.fontFamily.serif).not.toContain('Georgia');
});
