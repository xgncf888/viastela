import { expect, test, type Route } from '@playwright/test';

import { LOAD_TIMEOUT_MS } from '../src/lib/timing';
import { lightColor } from '../src/ui/theme';
import { accountingDay, installApi, signIn, weightRow } from './session';

test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 } });

function rgb(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}

test('the record button stays named 记录 and sits below the ledger', async ({ page }) => {
  const day = accountingDay();
  await signIn(page);
  await installApi(page, { weights: [weightRow('w-1', day, 61.5)] });
  await page.goto('/');
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  const record = page.getByRole('button', { name: '记录', exact: true });
  await expect(record).toHaveCount(1);
  const ledger = await page.getByText('体重', { exact: true }).boundingBox();
  const button = await record.boundingBox();
  expect(ledger).not.toBeNull();
  expect(button).not.toBeNull();
  expect(button!.y).toBeGreaterThan(ledger!.y);
  await expect(page.getByRole('button', { name: '记一笔' }).first()).toBeVisible();
});

test('a hung today load shows retry and recovers', async ({ page }) => {
  test.setTimeout(LOAD_TIMEOUT_MS + 15_000);
  const day = accountingDay();
  const held: Route[] = [];
  let release = false;
  await signIn(page);
  await installApi(page, { weights: [weightRow('w-held', day, 61.5)] });
  await page.route('**/rest/v1/weight_records*', async (route) => {
    if (route.request().method() !== 'GET' || release) {
      await route.fallback();
      return;
    }
    held.push(route);
  });
  await page.goto('/');
  await expect(page.getByText('没加载出来，检查网络后再试')).toBeVisible({ timeout: LOAD_TIMEOUT_MS + 4_000 });
  const retry = page.getByRole('button', { name: '重试' });
  await expect(retry).toBeVisible();
  await expect(retry.getByText('重试', { exact: true })).toHaveCSS('color', rgb(lightColor.accentText));
  release = true;
  await retry.click();
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  await expect(page.getByText('没加载出来，检查网络后再试')).toHaveCount(0);
  await Promise.all(held.map((route) => route.abort().catch(() => undefined)));
});

test('a second hung request starts over at the skeleton and times out again', async ({ page }) => {
  test.setTimeout(LOAD_TIMEOUT_MS * 2 + 20_000);
  const day = accountingDay();
  const held: Route[] = [];
  await signIn(page);
  await installApi(page, { weights: [weightRow('w-held', day, 61.5)] });
  await page.route('**/rest/v1/weight_records*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    held.push(route);
  });
  await page.goto('/');
  await expect(page.getByText('没加载出来，检查网络后再试')).toBeVisible({ timeout: LOAD_TIMEOUT_MS + 4_000 });
  await expect(page.locator('[role="status"]')).toHaveCount(0);

  await page.getByRole('button', { name: '重试' }).click();
  const busy = page.locator('[aria-busy="true"]');
  await expect(busy.locator('[role="status"]')).toHaveText('正在加载今日');
  await expect(page.getByText('没加载出来，检查网络后再试')).toHaveCount(0);
  await expect.poll(() => busy.locator('[aria-hidden="true"]').count()).toBeGreaterThan(0);
  const box = await busy.locator('[aria-hidden="true"]').first().boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(0);
  await expect(page.getByText('没加载出来，检查网络后再试')).toHaveCount(0);

  await expect(page.getByText('没加载出来，检查网络后再试')).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
  await expect(page.locator('[role="status"]')).toHaveCount(0);
  await Promise.all(held.map((route) => route.abort().catch(() => undefined)));
});
