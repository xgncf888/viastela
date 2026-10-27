import { expect, test } from '@playwright/test';

import { brand } from '../src/config/brand';

const userId = '11111111-1111-4111-8111-111111111111';

function unsignedJwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
}

test('web build shows the email login screen', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: brand.displayName })).toBeVisible();
  await expect(page.getByText('用邮箱登录')).toBeVisible();
  await expect(page.getByRole('button', { name: '发送验证码' })).toBeVisible();

  await page.getByRole('button', { name: '发送验证码' }).click();
  await expect(page.getByText('请输入有效邮箱')).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('signed-in shell switches tabs and opens the record sheet', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  const session = {
    access_token: unsignedJwt({
      sub: userId,
      email: 'yifeng@example.com',
      role: 'authenticated',
      exp: 4_000_000_000,
    }),
    refresh_token: 'refresh-token',
    expires_at: 4_000_000_000,
    expires_in: 3_600,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      email: 'yifeng@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-10-24T00:00:00.000Z',
    },
  };
  await page.addInitScript((stored) => {
    // Storage key matches the bundled EXPO_PUBLIC_SUPABASE_URL host (127.0.0.1).
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, session);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('今日').first()).toBeVisible();
  await expect(page.getByText('先记第一笔').first()).toBeVisible();

  await page.getByRole('button', { name: '记录' }).first().click();
  await expect(page.getByRole('heading', { name: '记录' })).toBeVisible();
  await expect(page.getByRole('button', { name: '训练' })).toBeVisible();
  await page.getByRole('button', { name: '学习' }).click();
  await expect(page.getByText('即将推出')).toBeVisible();
  await page.getByRole('button', { name: '关闭' }).click();

  await page.getByRole('button', { name: '趋势' }).click();
  await expect(page.getByRole('heading', { name: '近 7 日' })).toBeVisible();
  await page.getByRole('button', { name: '我的' }).click();
  await expect(page.getByText('日界时间')).toBeVisible();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('heading', { name: brand.displayName })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
