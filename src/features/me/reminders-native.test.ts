import { createElement, type ReactNode } from 'react';
import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals';

import { remindersCardVisible } from '@/core/reminder-settings';
import { listPushSubscriptions } from '@/data/push-subscriptions';
import { MeScreen } from '@/features/me/MeScreen';
import { RemindersCard } from '@/features/me/RemindersCard';
import { RemindersSettingsScreen } from '@/features/me/RemindersSettingsScreen';
import { browserStandalone, readBrowserEnv, requestBrowserPermission } from '@/features/me/web-push';
import RemindersSettingsRoute from '../../../app/(app)/reminders';

jest.mock('react-native', () => {
  // jest.mock factories cannot use ESM imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const web = require('react-native-web') as typeof import('react-native');
  return {
    ...web,
    Platform: {
      get OS() {
        return (globalThis as { __TEST_OS?: string }).__TEST_OS ?? 'ios';
      },
      select(spec: Record<string, unknown>) {
        const os = (globalThis as { __TEST_OS?: string }).__TEST_OS ?? 'ios';
        return spec[os] ?? spec.default;
      },
    },
  };
});

jest.mock('@/data/push-subscriptions', () => ({
  listPushSubscriptions: jest.fn(async () => []),
  newSubscriptionId: () => '00000000-0000-4000-8000-000000000001',
  softDeletePushSubscription: jest.fn(async () => undefined),
  upsertPushSubscription: jest.fn(async () => undefined),
}));

jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement: element } = require('react') as typeof import('react');
  return {
    Redirect: ({ href }: { href: string }) => element('div', { 'data-href': href }),
    router: { push() {}, replace() {} },
  };
});

jest.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => ({ session: { email: 'person@example.com' } }),
}));

jest.mock('@/features/weight/WeightProvider', () => ({
  useWeight: () => ({
    daySwitch: '04:00',
    timeZone: 'UTC',
    saveDaySwitch: async () => undefined,
  }),
}));

jest.mock('@/features/shell/AppShell', () => ({
  useShellInset: () => 0,
}));

jest.mock('@/data/auth', () => ({
  signOut: async () => undefined,
}));

jest.mock('@/ui/toast', () => ({
  showToast() {},
}));

jest.mock('@/ui/Screen', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement: element } = require('react') as typeof import('react');
  return { Screen: ({ children }: { children?: ReactNode }) => element('div', null, children) };
});

jest.mock('@/ui/Content', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement: element } = require('react') as typeof import('react');
  return { Content: ({ children }: { children?: ReactNode }) => element('div', null, children) };
});

jest.mock('@/ui/Card', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement: element } = require('react') as typeof import('react');
  return { Card: ({ children }: { children?: ReactNode }) => element('div', null, children) };
});

jest.mock('@/ui/Button', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement: element } = require('react') as typeof import('react');
  return {
    Button: ({ label }: { label: string }) => element('button', null, label),
  };
});

jest.mock('@/ui/Text', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement: element } = require('react') as typeof import('react');
  return { Text: ({ children }: { children?: ReactNode }) => element('span', null, children) };
});

jest.mock('@/ui/TextField', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement: element } = require('react') as typeof import('react');
  return { TextField: ({ label }: { label: string }) => element('label', null, label) };
});

jest.mock('@/ui/layout', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createElement: element } = require('react') as typeof import('react');
  return {
    Field: ({ label, value }: { label: string; value: string }) => element('div', null, `${label}${value}`),
    ScreenHeader: ({ title }: { title: string }) => element('h1', null, title),
    Stack: ({ children }: { children?: ReactNode }) => element('div', null, children),
  };
});

// react-dom's server entry has no local type declarations.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { renderToStaticMarkup } = require('react-dom/server') as {
  renderToStaticMarkup: (node: ReactNode) => string;
};

const matchMedia = jest.fn(() => {
  throw new Error('matchMedia should not run on native');
});
const requestPermission = jest.fn(async () => 'granted');

const priorWindow = (globalThis as { window?: unknown }).window;

function installNativeWindow(): void {
  const view = {
    matchMedia,
    navigator: {
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      platform: 'Linux armv8l',
      maxTouchPoints: 5,
      serviceWorker: {},
    },
    Notification: {
      permission: 'default',
      requestPermission,
    },
    PushManager: function PushManager() {},
  };
  (globalThis as { window?: unknown }).window = view;
}

afterAll(() => {
  (globalThis as { window?: unknown }).window = priorWindow;
  delete (globalThis as { __TEST_OS?: string }).__TEST_OS;
});

beforeEach(() => {
  matchMedia.mockClear();
  requestPermission.mockClear();
  (listPushSubscriptions as unknown as jest.Mock).mockClear();
  (globalThis as { __TEST_OS?: string }).__TEST_OS = 'ios';
  installNativeWindow();
});

function markup(node: ReactNode): string {
  return renderToStaticMarkup(node);
}

describe('native reminders', () => {
  test.each(['ios', 'android'])('%s readBrowserEnv does not throw and the card stays hidden', (os) => {
    (globalThis as { __TEST_OS?: string }).__TEST_OS = os;
    const env = readBrowserEnv();
    expect(env.permission).toBe('unsupported');
    expect(env.pushSupported).toBe(false);
    expect(remindersCardVisible(env)).toBe(false);
    expect(browserStandalone()).toBe(false);
    expect(matchMedia).not.toHaveBeenCalled();
  });

  test('a window without matchMedia does not throw', () => {
    const view = (globalThis as { window: { matchMedia?: unknown } }).window;
    delete view.matchMedia;
    expect(browserStandalone()).toBe(false);
    expect(() => readBrowserEnv()).not.toThrow();
  });

  test('我的 renders no reminder entry and does not read subscriptions', () => {
    const html = markup(createElement(MeScreen));
    expect(html).not.toContain('训练日提醒');
    expect(html).not.toContain('月底更新余额提醒');
    expect(html).toContain('删除账号');
    expect(listPushSubscriptions).not.toHaveBeenCalled();
    expect(matchMedia).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  test('the settings card and route render nothing and do not ask for permission', async () => {
    expect(markup(createElement(RemindersCard))).toBe('');
    expect(markup(createElement(RemindersSettingsScreen))).toBe('');
    const route = markup(createElement(RemindersSettingsRoute));
    expect(route).toContain('data-href="/me"');
    expect(route).not.toContain('训练日提醒');
    await expect(requestBrowserPermission()).resolves.toBe('unsupported');
    expect(requestPermission).not.toHaveBeenCalled();
    expect(listPushSubscriptions).not.toHaveBeenCalled();
    expect(matchMedia).not.toHaveBeenCalled();
  });
});
