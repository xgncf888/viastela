import { expect, test } from '@playwright/test';

import { brand } from '../src/config/brand';
import { authSession, installApi, signIn } from './session';

test('web build shows the email login screen', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.goto('/');
  await expect(page.getByRole('heading', { name: brand.displayName })).toBeVisible();
  await expect(page.getByText('用邮箱登录')).toBeVisible();
  await expect(page.getByRole('button', { name: '使用 Google 登录' })).toBeVisible();
  await expect(page.getByRole('button', { name: '使用 GitHub 登录' })).toBeVisible();
  await expect(page.getByText('或', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '发送验证码' })).toBeVisible();

  const send = page.getByRole('button', { name: '发送验证码' });
  const privacy = page.getByRole('button', { name: '隐私政策' });
  await expect(privacy).toBeVisible();
  const sendBox = await send.boundingBox();
  const privacyBox = await privacy.boundingBox();
  expect(sendBox && privacyBox && privacyBox.y).toBeGreaterThan(sendBox.y);

  await send.click();
  await expect(page.getByText('请输入有效邮箱')).toBeVisible();
  await privacy.click();
  await expect(page.getByRole('heading', { name: '隐私政策' })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test('an unknown path offers 回到今日 and opens Today', async ({ page }) => {
  await signIn(page);
  await installApi(page, { weights: [] });
  await page.goto('/does-not-exist');
  await expect(page.getByText('找不到这一页')).toBeVisible();
  const home = page.getByRole('button', { name: '回到今日' });
  await expect(home).toBeVisible();
  await home.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: '回到今日' })).toHaveCount(0);
  await expect(page.getByText('先记第一笔').first()).toBeVisible();
  await expect(page.getByRole('button', { name: '今日' })).toBeVisible();
});

test('a direct /account/delete load renders the app', async ({ page }) => {
  const response = await page.goto('/account/delete');
  expect(response?.status()).toBe(200);
  expect(response?.headers()['content-type'] ?? '').toContain('text/html');
  await expect(page.getByRole('heading', { name: brand.displayName })).toBeVisible();
  await expect(page.getByText('用邮箱登录')).toBeVisible();
  await expect(page.getByText('NOT_FOUND')).toHaveCount(0);
});

test('starting Google sign-in disables GitHub and the email code button', async ({ page }) => {
  await page.route('**/auth/v1/authorize**', async (route) => {
    await route.abort('aborted');
  });
  await page.goto('/');
  await page.getByRole('button', { name: '使用 Google 登录' }).click();
  await expect(page.getByRole('button', { name: '使用 Google 登录' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '使用 GitHub 登录' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '发送验证码' })).toBeDisabled();
});

test('a failed provider return keeps the email and clears the error from the URL', async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('login-email', 'yifeng@example.com');
  });
  await page.goto('/?error=access_denied');
  const banner = page.getByRole('alert');
  await expect(banner).toHaveText('登录没有完成，请重试');
  await expect(banner).toHaveCSS('background-color', 'rgb(248, 238, 235)');
  const bannerBox = await banner.boundingBox();
  const googleBox = await page.getByRole('button', { name: '使用 Google 登录' }).boundingBox();
  expect(bannerBox && googleBox && bannerBox.y + bannerBox.height).toBeLessThanOrEqual(googleBox.y);
  await expect(page.getByLabel('邮箱')).toHaveValue('yifeng@example.com');
  await expect.poll(() => new URL(page.url()).searchParams.has('error')).toBe(false);
});

test('email sign-in after a provider failure shows no error after sign-out', async ({ page }) => {
  await installApi(page, { weights: [] });
  await page.route('**/auth/v1/otp**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  await page.route('**/auth/v1/verify**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(authSession()) });
  });
  await page.goto('/?error=access_denied');
  await expect(page.getByRole('alert')).toHaveText('登录没有完成，请重试');
  await page.getByRole('textbox', { name: '邮箱' }).fill('yifeng@example.com');
  await page.getByRole('button', { name: '发送验证码' }).click();
  await page.getByRole('textbox', { name: '验证码', exact: true }).fill('123456');
  await page.getByRole('button', { name: '验证并进入' }).click();
  await expect(page.getByText('今日').first()).toBeVisible();
  await page.getByRole('button', { name: '我的' }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('heading', { name: brand.displayName })).toBeVisible();
  await expect(page.getByText('登录没有完成，请重试')).toHaveCount(0);
});

test('signed-in shell switches tabs and opens the record sheet', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await signIn(page);
  await installApi(page, { weights: [] });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByText('今日').first()).toBeVisible();
  await expect(page.getByText('先记第一笔').first()).toBeVisible();

  await page.getByRole('button', { name: '记录' }).first().click();
  await expect(page.getByRole('heading', { name: '记录' })).toBeVisible();
  await expect(page.getByRole('button', { name: '训练' })).toBeVisible();
  await page.getByRole('button', { name: '学习' }).click();
  await expect(page.getByRole('textbox', { name: '主题' })).toBeVisible();
  await page.getByRole('button', { name: '时间块' }).click();
  await expect(page.getByText('即将推出')).toBeVisible();
  await page.getByRole('button', { name: '关闭' }).click();

  await page.getByRole('button', { name: '趋势' }).click();
  await expect(page.getByRole('heading', { name: '近 7 日' })).toBeVisible();
  await page.getByRole('button', { name: '我的' }).click();
  await expect(page.getByText('日切时间')).toBeVisible();
  await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.getByRole('heading', { name: brand.displayName })).toBeVisible();
  expect(pageErrors).toEqual([]);
});
