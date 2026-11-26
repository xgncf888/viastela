import { expect, test } from '@playwright/test';

import { authSession, installApi } from './session';
import { closeRecordSheet, recordButton, rowRecordButton, waitForTodayLoaded } from './selectors';

const ACCENT = 'rgb(217, 119, 87)';

async function background(page: import('@playwright/test').Page, name: string): Promise<string> {
  return page.getByRole('button', { name, exact: true }).evaluate((node) => getComputedStyle(node).backgroundColor);
}

test.describe.configure({ timeout: 60_000 });
test.use({ actionTimeout: 8_000 });

test('production save with no session stays unsaved until retry after login', async ({ page }) => {
  const writes: string[] = [];
  await page.addInitScript((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, authSession());
  await installApi(page, {
    weights: [],
    onWrite: async (route) => {
      writes.push(route.request().postData() ?? '');
      await route.fulfill({
        status: 201,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: '[]',
      });
    },
    onTrainingWrite: async (route) => {
      writes.push(route.request().postData() ?? '');
      await route.fulfill({
        status: 201,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: '[]',
      });
    },
    onStudyWrite: async (route) => {
      writes.push(route.request().postData() ?? '');
      await route.fulfill({
        status: 201,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: '[]',
      });
    },
  });
  await page.route('**/auth/v1/otp**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/auth/v1/verify**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(authSession()),
    });
  });
  await page.route('**/auth/v1/authorize**', async (route) => {
    await route.abort('aborted');
  });

  await page.goto('/');
  await waitForTodayLoaded(page);
  await page.evaluate(() => localStorage.removeItem('sb-127-auth-token'));

  await recordButton(page).click();
  await page.getByRole('textbox', { name: '体重（kg）' }).fill('72.4');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText(/72\.4 kg ·/)).toBeVisible();

  await rowRecordButton(page, 'training').click();
  await page.getByRole('button', { name: '哑铃卧推', exact: true }).evaluate((node: HTMLElement) => node.click());
  await page.getByRole('textbox', { name: '重量（kg）' }).fill('20');
  await page.getByRole('textbox', { name: '次数' }).fill('8');
  await page.getByRole('button', { name: '保存这一组' }).click();
  await closeRecordSheet(page).evaluate((node: HTMLElement) => node.click());

  await rowRecordButton(page, 'study').click();
  await page.getByRole('textbox', { name: '主题' }).fill('分布式');
  await page.getByRole('button', { name: '保存', exact: true }).click();

  await page.getByRole('button', { name: '哑铃卧推 1 组' }).click();
  await page.getByRole('button', { name: '分布式 30 分钟' }).click();
  await expect(page.getByText('未保存 ·', { exact: true })).toHaveCount(3);
  await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(3);
  await expect(page.getByText('登录已过期，记录还没保存')).toBeVisible();
  await expect(page.getByText('已保存')).toHaveCount(0);
  await expect(page.getByText('已记录')).toHaveCount(0);
  const stored = await page.evaluate(() => ({
    engine: localStorage.getItem('viastela.local.engine.db.v1'),
    legacy: localStorage.getItem('viastela.desktop.standalone.db.v1'),
  }));
  expect(stored.engine).toBeNull();
  expect(stored.legacy).toBeNull();
  expect(writes).toEqual([]);

  const relogin = page.getByRole('button', { name: '重新登录', exact: true });
  const record = recordButton(page);
  expect(await background(page, '重新登录')).not.toBe(ACCENT);
  expect(await record.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(ACCENT);

  await relogin.click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: '使用 Google 登录' }).click();
  await expect(page.getByRole('heading', { name: '还有 3 条记录没保存' })).toBeVisible();
  await expect(
    page.getByText('用 Google 或 GitHub 登录会离开当前页面，回来后这些记录需要重新填写。用邮箱验证码登录可以保留它们。'),
  ).toBeVisible();
  expect(await background(page, '去登录')).not.toBe(ACCENT);
  expect(await background(page, '取消')).not.toBe(ACCENT);
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await expect(page.getByRole('heading', { name: '还有 3 条记录没保存' })).toHaveCount(0);

  await page.getByRole('textbox', { name: '邮箱' }).fill('yifeng@example.com');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByRole('heading', { name: '还有 3 条记录没保存' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '验证码已发送，请查收邮箱' })).toBeVisible();
  await page.getByRole('textbox', { name: '验证码', exact: true }).fill('123456');
  await waitForTodayLoaded(page);
  await page.getByRole('button', { name: '哑铃卧推 1 组' }).click();
  await page.getByRole('button', { name: '分布式 30 分钟' }).click();
  await expect(page.getByText(/72\.4 kg ·/)).toBeVisible();
  await expect(page.getByText('分布式').first()).toBeVisible();
  await expect(page.getByText('哑铃卧推').first()).toBeVisible();

  await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(3);
  await page.evaluate(() => {
    const buttons = [...document.querySelectorAll('[role="button"]')].filter(
      (node) => node.getAttribute('aria-label') === '重试',
    );
    for (const button of buttons) {
      (button as HTMLElement).click();
      (button as HTMLElement).click();
    }
  });
  await expect.poll(() => writes.length).toBe(3);
  const ids = writes.flatMap((body) => {
    const match = body.match(/"id":"([^"]+)"/);
    return match ? [match[1]] : [];
  });
  expect(new Set(ids).size).toBe(3);
  await expect(page.getByText(/72\.4 kg ·/)).toHaveCount(1);
  await expect(page.getByText('未保存 ·', { exact: true })).toHaveCount(0);
});

test('an expired unsaved row is dropped when a different account signs in', async ({ page }) => {
  const writes: string[] = [];
  const userA = '11111111-1111-4111-8111-111111111111';
  const userB = '22222222-2222-4222-8222-222222222222';
  let session = authSession({ userId: userA, email: 'a@example.com' });
  await page.addInitScript((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, session);
  await installApi(page, {
    weights: [],
    onWrite: async (route) => {
      writes.push(route.request().postData() ?? '');
      await route.fulfill({
        status: 201,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: '[]',
      });
    },
  });
  await page.route('**/auth/v1/user**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session.user) });
  });
  await page.route('**/auth/v1/token**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
  });
  await page.route('**/auth/v1/logout**', async (route) => {
    await route.fulfill({ status: 204, body: '' });
  });
  await page.route('**/auth/v1/otp**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/auth/v1/verify**', async (route) => {
    session = authSession({ userId: userB, email: 'b@example.com' });
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(session) });
  });

  await page.goto('/');
  await waitForTodayLoaded(page);
  await page.evaluate(() => localStorage.removeItem('sb-127-auth-token'));

  await recordButton(page).click();
  await page.getByRole('textbox', { name: '体重（kg）' }).fill('72.4');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText(/72\.4 kg ·/)).toBeVisible();
  await expect(page.getByText('未保存 ·', { exact: true })).toBeVisible();
  await expect(page.getByText('登录已过期，记录还没保存')).toBeVisible();
  expect(writes).toEqual([]);

  await page.getByRole('button', { name: '我的' }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole('textbox', { name: '邮箱' }).fill('b@example.com');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await page.getByRole('textbox', { name: '验证码', exact: true }).fill('123456');
  await waitForTodayLoaded(page);
  await expect(page.getByText(/72\.4 kg ·/)).toHaveCount(0);
  await expect(page.getByText('未保存 ·', { exact: true })).toHaveCount(0);
  await expect(page.getByText('登录已过期，记录还没保存')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重试', exact: true })).toHaveCount(0);
  expect(writes).toEqual([]);
});
