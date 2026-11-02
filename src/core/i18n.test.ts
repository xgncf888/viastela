import { beforeEach, describe, expect, it } from '@jest/globals';

import { getAppLocale, setAppLocale, toggleAppLocale, tr } from './i18n';

describe('bilingual i18n engine (ZH / EN)', () => {
  beforeEach(() => {
    setAppLocale('zh');
  });

  it('defaults to zh in test environment and resolves Chinese copy', () => {
    expect(getAppLocale()).toBe('zh');
    expect(tr('今日', 'Today')).toBe('今日');
  });

  it('switches to en and resolves English copy', () => {
    setAppLocale('en');
    expect(getAppLocale()).toBe('en');
    expect(tr('今日', 'Today')).toBe('Today');
  });

  it('toggles between zh and en cleanly', () => {
    expect(toggleAppLocale()).toBe('en');
    expect(getAppLocale()).toBe('en');
    expect(toggleAppLocale()).toBe('zh');
    expect(getAppLocale()).toBe('zh');
  });
});
