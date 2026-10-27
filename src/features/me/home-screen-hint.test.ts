import { describe, expect, it } from '@jest/globals';

import { homeScreenInstallHint } from './home-screen-hint';

const base = {
  web: true,
  userAgent: 'Mozilla/5.0 (Macintosh)',
  platform: 'MacIntel',
  maxTouchPoints: 0,
  standalone: false,
};

describe('home screen hint', () => {
  it('tells iPhone Safari how to install', () => {
    expect(
      homeScreenInstallHint({
        ...base,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
      }),
    ).toBe('在 Safari 点分享 → 添加到主屏幕');
  });

  it('uses the browser menu on other web clients', () => {
    expect(homeScreenInstallHint(base)).toBe('在浏览器菜单里选择「添加到主屏幕」');
  });

  it('hides the line in standalone and on native', () => {
    expect(homeScreenInstallHint({ ...base, standalone: true })).toBeNull();
    expect(homeScreenInstallHint({ ...base, web: false })).toBeNull();
  });
});
