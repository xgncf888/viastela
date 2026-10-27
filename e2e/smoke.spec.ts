import { expect, test } from '@playwright/test';

import { brand } from '../src/config/brand';
import { installApi, signIn } from './session';

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
