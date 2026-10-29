import { devices, expect, test, type Page } from '@playwright/test';

import { REMINDER_COPY } from '../src/core/reminder-settings';
import { PUSH_SUBSCRIPTION_ID_KEY } from '../src/features/me/reminder-storage';
import { navItem, recordButton, waitForTodayLoaded } from './selectors';
import { installApi, signIn, weightRow } from './session';

async function openMe(page: Page): Promise<void> {
  await page.goto('/');
  await waitForTodayLoaded(page);
  await navItem(page, '我的').click();
}

const inventedVapid = `B${'A'.repeat(86)}`;

type StoredPush = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  tz: string;
  month_end_time: string;
  month_end_enabled: boolean;
  training_time: string;
  training_days: number[];
  training_enabled: boolean;
  deleted_at: string | null;
};

function installPushMock(page: Page, permission: 'default' | 'granted' | 'denied') {
  return page.addInitScript(
    ({ vapid, start }) => {
      const state = {
        permission: sessionStorage.getItem('mock-notification-permission') || start,
        requests: Number(sessionStorage.getItem('mock-permission-requests') || '0'),
      };
      const subscription = {
        endpoint: 'https://push.example.test/subscription/invented',
        toJSON() {
          return {
            endpoint: this.endpoint,
            keys: { p256dh: 'invented-p256dh', auth: 'invented-auth' },
          };
        },
        unsubscribe: () => Promise.resolve(true),
      };
      const registration = {
        pushManager: {
          getSubscription: () => Promise.resolve(state.permission === 'granted' ? subscription : null),
          subscribe: () => {
            state.permission = 'granted';
            return Promise.resolve(subscription);
          },
        },
        addEventListener() {},
      };
      Object.defineProperty(window, 'Notification', {
        configurable: true,
        value: {
          get permission() {
            return state.permission;
          },
          requestPermission: () => {
            state.requests += 1;
            state.permission = state.permission === 'denied' ? 'denied' : 'granted';
            sessionStorage.setItem('mock-notification-permission', state.permission);
            sessionStorage.setItem('mock-permission-requests', String(state.requests));
            return Promise.resolve(state.permission);
          },
        },
      });
      Object.defineProperty(navigator, 'serviceWorker', {
        configurable: true,
        value: {
          ready: Promise.resolve(registration),
          controller: {},
          register: () => Promise.resolve(registration),
          addEventListener() {},
          getRegistrations: () => Promise.resolve([registration]),
        },
      });
      Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} });
      (window as unknown as { __VIASTELA_VAPID_PUBLIC_KEY__: string }).__VIASTELA_VAPID_PUBLIC_KEY__ = vapid;
      (window as unknown as { __permissionRequests: () => number }).__permissionRequests = () => state.requests;
    },
    { vapid: inventedVapid, start: permission },
  );
}

async function installPushApi(page: Page, seed: StoredPush[] = []) {
  const rows = seed.map((row) => ({ ...row }));
  await page.route('**/rest/v1/push_subscriptions**', async (route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
      return;
    }
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify(rows.filter((row) => row.deleted_at === null)),
      });
      return;
    }
    const body = request.postData() ?? '{}';
    const parsed = JSON.parse(body) as Partial<StoredPush>;
    if (request.method() === 'PATCH' && body.includes('deleted_at')) {
      const id = new URL(request.url()).searchParams.get('id')?.replace(/^eq\./, '');
      const row = rows.find((item) => item.id === id);
      if (row) row.deleted_at = new Date().toISOString();
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
        body: JSON.stringify(row ? [{ id: row.id }] : []),
      });
      return;
    }
    if (parsed.id) {
      const next: StoredPush = {
        id: parsed.id,
        endpoint: parsed.endpoint ?? 'https://push.example.test/subscription/invented',
        p256dh: parsed.p256dh ?? 'invented-p256dh',
        auth: parsed.auth ?? 'invented-auth',
        tz: parsed.tz ?? 'UTC',
        month_end_time: parsed.month_end_time ?? '21:30:00',
        month_end_enabled: parsed.month_end_enabled ?? false,
        training_time: parsed.training_time ?? '08:00:00',
        training_days: parsed.training_days ?? [],
        training_enabled: parsed.training_enabled ?? false,
        deleted_at: null,
      };
      const index = rows.findIndex((item) => item.id === next.id);
      if (index === -1) rows.push(next);
      else rows[index] = { ...rows[index], ...next, deleted_at: null };
    }
    await route.fulfill({
      status: 201,
      headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' },
      body: '[]',
    });
  });
  return rows;
}

test('the reminders card is absent when push is not configured', async ({ page }) => {
  let reads = 0;
  await signIn(page);
  await installApi(page, { weights: [] });
  await page.route('**/rest/v1/push_subscriptions**', async (route) => {
    if (route.request().method() === 'GET') reads += 1;
    await route.fallback();
  });
  await openMe(page);
  await expect(page.getByText('日切时间')).toBeVisible();
  await expect(page.getByRole('heading', { name: REMINDER_COPY.section })).toHaveCount(0);
  await expect(page.getByRole('switch', { name: REMINDER_COPY.training })).toHaveCount(0);
  await expect(page.getByText(REMINDER_COPY.unconfigured)).toHaveCount(0);
  await expect(page.getByLabel(REMINDER_COPY.trainingTime)).toHaveCount(0);
  expect(reads).toBe(0);
});

test('the two reminder toggles persist independently and keep weekdays', async ({ page }) => {
  await installPushMock(page, 'default');
  await signIn(page);
  await installApi(page, { weights: [] });
  const rows = await installPushApi(page);
  await openMe(page);
  const training = page.getByRole('switch', { name: REMINDER_COPY.training });
  const monthEnd = page.getByRole('switch', { name: REMINDER_COPY.monthEnd });
  await expect(training).toBeEnabled();
  expect(await page.evaluate(() => (window as unknown as { __permissionRequests: () => number }).__permissionRequests())).toBe(0);

  await training.click();
  await expect(training).toBeChecked();
  expect(await page.evaluate(() => (window as unknown as { __permissionRequests: () => number }).__permissionRequests())).toBe(1);
  await page.getByRole('button', { name: '周一' }).click();
  await page.getByRole('button', { name: '周三' }).click();
  await expect.poll(() => rows[0]?.training_days).toEqual([1, 3]);

  await page.reload();
  await expect(training).toBeChecked();
  await expect(page.getByRole('button', { name: '周一' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: '周三' })).toHaveAttribute('aria-selected', 'true');

  await training.click();
  await expect.poll(() => rows[0]?.training_enabled).toBe(false);
  await expect.poll(() => rows[0]?.training_days).toEqual([1, 3]);
  await page.reload();
  await expect(training).not.toBeChecked();
  await expect(page.getByRole('button', { name: '周一' })).toHaveCount(0);

  await training.click();
  await expect(training).toBeChecked();
  await expect(page.getByRole('button', { name: '周一' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('button', { name: '周三' })).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => (window as unknown as { __permissionRequests: () => number }).__permissionRequests())).toBe(1);

  await monthEnd.click();
  await expect(monthEnd).toBeChecked();
  await training.click();
  await expect(training).not.toBeChecked();
  await expect(monthEnd).toBeChecked();
  await page.reload();
  await expect(training).not.toBeChecked();
  await expect(monthEnd).toBeChecked();
  expect(rows[0]?.training_days).toEqual([1, 3]);
  expect(rows[0]?.month_end_enabled).toBe(true);
  expect(rows[0]?.deleted_at).toBeNull();
});

test('a denied permission soft-deletes the saved row and does not ask again on load', async ({ page }) => {
  const id = '22222222-2222-4222-8222-222222222222';
  await page.addInitScript(
    ([key, stored]) => {
      localStorage.setItem(key, stored);
    },
    [PUSH_SUBSCRIPTION_ID_KEY, id] as const,
  );
  await installPushMock(page, 'denied');
  await signIn(page);
  await installApi(page, { weights: [] });
  const rows = await installPushApi(page, [
    {
      id,
      endpoint: 'https://push.example.test/subscription/invented',
      p256dh: 'invented-p256dh',
      auth: 'invented-auth',
      tz: 'Asia/Singapore',
      month_end_time: '21:30:00',
      month_end_enabled: true,
      training_time: '08:00:00',
      training_days: [1, 3],
      training_enabled: true,
      deleted_at: null,
    },
  ]);
  await openMe(page);
  await expect(page.getByText(REMINDER_COPY.permissionDenied)).toBeVisible();
  await expect.poll(() => rows[0]?.deleted_at).not.toBeNull();
  expect(await page.evaluate(() => (window as unknown as { __permissionRequests: () => number }).__permissionRequests())).toBe(0);
  await expect(page.getByRole('switch', { name: REMINDER_COPY.training })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: REMINDER_COPY.monthEnd })).not.toBeChecked();
});

test('iOS outside the home screen disables both switches', async ({ browser }) => {
  const context = await browser.newContext({ ...devices['iPhone 13'], baseURL: 'http://127.0.0.1:4173' });
  const page = await context.newPage();
  await installPushMock(page, 'default');
  await signIn(page);
  await installApi(page, { weights: [] });
  await openMe(page);
  await expect(page.getByText(REMINDER_COPY.iosInstall)).toBeVisible();
  await expect(page.getByRole('switch', { name: REMINDER_COPY.training })).toBeDisabled();
  await expect(page.getByRole('switch', { name: REMINDER_COPY.monthEnd })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { __permissionRequests: () => number }).__permissionRequests())).toBe(0);
  await context.close();
});

test.describe('month-end notice on Today', () => {
  test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 } });

  test('the card sits under the record button and does not move it', async ({ page }) => {
    await page.clock.install({ time: new Date('2026-10-15T09:00:00.000Z') });
    await signIn(page);
    await installApi(page, { weights: [weightRow('w-month', '2026-10-15', 76)] });
    await page.goto('/');
    await waitForTodayLoaded(page);
    await expect(page.getByText('这个月还没更新资产余额')).toHaveCount(0);
    const before = await recordButton(page).boundingBox();

    await page.clock.setFixedTime(new Date('2026-10-31T09:00:00.000Z'));
    await page.reload();
    await waitForTodayLoaded(page);
    const notice = page.getByText('这个月还没更新资产余额');
    await expect(notice).toBeVisible();
    const button = recordButton(page);
    await expect(button).toBeInViewport();
    const after = await button.boundingBox();
    const noticeBox = await notice.boundingBox();
    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(noticeBox).not.toBeNull();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(1);
    expect(noticeBox!.y).toBeGreaterThanOrEqual(after!.y + after!.height - 1);
    expect(after!.y + after!.height).toBeLessThanOrEqual(844);
  });
});
