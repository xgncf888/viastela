import { expect, test, type Page, type Route } from '@playwright/test';

import { LOAD_TIMEOUT_MS } from '../src/lib/timing';
import { lightColor } from '../src/ui/theme';
import { closeRecordSheet } from './selectors';
import { accountingDay, installApi, signIn, weightRow } from './session';

test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 } });

function rgb(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}

test('the record button sits under the 7-day average and above one record', async ({ page }) => {
  const day = accountingDay();
  await signIn(page);
  await installApi(page, { weights: [weightRow('w-1', day, 80)] });
  await page.goto('/');
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  await expectRecordOnFirstScreen(page);
  await expect(page.getByRole('button', { name: '记一笔' }).first()).toBeVisible();
});

test('the record button stays on the first screen with seven records', async ({ page }) => {
  const day = accountingDay();
  const kilograms = [80, 80.1, 80.2, 80.3, 80.4, 80.5, 80.6];
  await signIn(page);
  await installApi(page, {
    weights: kilograms.map((value, index) => weightRow(`w-${index + 1}`, day, value, 8 + index)),
  });
  await page.goto('/');
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  await expect(page.getByText('复测', { exact: true })).toHaveCount(6);
  await expectRecordOnFirstScreen(page);
});

test('the weight column skeleton is two lines inside the card, and the status waits for it', async ({ page }) => {
  await signIn(page);
  await installApi(page, { weights: [] });
  await page.route('**/rest/v1/weight_records*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await new Promise(() => undefined);
  });
  await page.goto('/');
  await expect(page.getByRole('heading').first()).toBeVisible();
  const record = page.getByRole('button', { name: '记录', exact: true });
  await expect(record).toBeVisible();
  await expect(record).toBeInViewport();
  await expect(page.locator('[role="status"]')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveText('正在加载今日', { timeout: 4_000 });
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(1);
  const column = page.getByText('体重', { exact: true }).locator('..');
  await expect.poll(() => skeletonBars(column)).toBe(2);
  expect(await framed(column.locator('[aria-hidden="true"]').first())).toBe(true);
  await expect(record).toBeVisible();
  await expect(record).toBeInViewport();
  await expectRecordOpensSheet(page);
});

test('a weight load error is a muted dash and a single error card', async ({ page }) => {
  await signIn(page);
  await installApi(page, { weights: [] });
  await page.route('**/rest/v1/weight_records*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 500,
      headers: {
        'access-control-allow-origin': '*',
        'content-type': 'application/json',
      },
      body: '{"message":"down"}',
    });
  });
  await page.goto('/');
  await expect(page.getByText('没加载出来，检查网络后再试')).toHaveCount(1);
  const dash = page.getByText('体重', { exact: true }).locator('..').getByText('—', { exact: true });
  await expect(dash).toBeVisible();
  await expect(dash).toHaveCSS('color', rgb(lightColor.muted));
  expect(await framed(dash)).toBe(true);
  await expectRecordOpensSheet(page);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the skeleton stays dim and does not breathe', async ({ page }) => {
    await signIn(page);
    await installApi(page, { weights: [] });
    await page.route('**/rest/v1/weight_records*', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await new Promise(() => undefined);
    });
    await page.goto('/');
    await expect(page.locator('[role="status"]')).toHaveText('正在加载今日', { timeout: 4_000 });
    const first = await skeletonOpacity(page);
    expect(first).toBeCloseTo(0.7, 1);
    await page.waitForTimeout(400);
    expect(await skeletonOpacity(page)).toBeCloseTo(first, 2);
  });
});

async function skeletonBars(column: ReturnType<Page['locator']>): Promise<number> {
  return column.locator('div').evaluateAll((nodes) =>
    nodes.filter((node) => {
      const color = getComputedStyle(node).backgroundColor.replace(/\s/g, '');
      return color === 'rgb(226,223,213)' || color === 'rgba(226,223,213,1)';
    }).length,
  );
}

async function framed(node: ReturnType<Page['locator']>): Promise<boolean> {
  return node.evaluate((element) => {
    let current = element.parentElement;
    while (current) {
      if (parseFloat(getComputedStyle(current).borderTopWidth) > 0) return true;
      current = current.parentElement;
    }
    return false;
  });
}

async function skeletonOpacity(page: Page): Promise<number> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('[aria-hidden="true"]'));
    const bar = nodes.find((node) => {
      const color = getComputedStyle(node).backgroundColor.replace(/\s/g, '');
      return color.startsWith('rgb(226,223,213)') || color.startsWith('rgba(226,223,213');
    });
    return bar ? Number(getComputedStyle(bar).opacity) : -1;
  });
}

async function expectRecordOpensSheet(page: Page) {
  const record = page.getByRole('button', { name: '记录', exact: true });
  await expect(record).toBeVisible();
  await expect(record).toBeInViewport();
  await record.click();
  await expect(page.getByRole('heading', { name: '记录', exact: true })).toBeVisible();
  await closeRecordSheet(page).click();
  await expect(page.getByRole('heading', { name: '记录', exact: true })).toBeHidden();
}

async function expectRecordOnFirstScreen(page: Page) {
  const record = page.getByRole('button', { name: '记录', exact: true });
  await expect(record).toHaveCount(1);
  await expect(record).toBeInViewport();
  const title = await page.getByText('7 日均重', { exact: true }).boundingBox();
  const button = await record.boundingBox();
  const morning = await page.getByText('晨重', { exact: true }).boundingBox();
  expect(title).not.toBeNull();
  expect(button).not.toBeNull();
  expect(morning).not.toBeNull();
  expect(button!.y).toBeGreaterThan(title!.y);
  expect(button!.y + button!.height).toBeLessThanOrEqual(morning!.y);
  expect(button!.y + button!.height).toBeLessThanOrEqual(844);
  const position = await record.evaluate((node) => getComputedStyle(node).position);
  expect(position === 'static' || position === 'relative').toBe(true);
  const scrolled = await page.evaluate(() =>
    Array.from(document.querySelectorAll('div')).some((node) => node.scrollTop > 1),
  );
  expect(scrolled).toBe(false);
}

test('the record button keeps one y through wait, skeleton, content, error, and timeout', async ({ page }) => {
  test.setTimeout(LOAD_TIMEOUT_MS + 30_000);
  const day = accountingDay();
  const ys: Record<string, number> = {};
  let holding = true;
  const parked: (() => void)[] = [];
  await signIn(page);
  await installApi(page, { weights: [weightRow('w-1', day, 72, 8)] });
  await page.route('**/rest/v1/weight_records*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    if (holding) await new Promise<void>((resolve) => parked.push(resolve));
    await route.fallback();
  });
  await page.goto('/');
  await expect(page.getByText('7 日均重', { exact: true })).toBeVisible();
  await expect(page.locator('[role="status"]')).toHaveCount(0);
  ys.wait = await recordButtonY(page);

  await expect(page.locator('[role="status"]')).toHaveText('正在加载今日', { timeout: 4_000 });
  ys.skeleton = await recordButtonY(page);

  await expect(page.getByText('没加载出来，检查网络后再试')).toBeVisible({ timeout: LOAD_TIMEOUT_MS });
  const average = page.getByText('7 日均重', { exact: true }).locator('xpath=../..');
  const column = page.getByText('体重', { exact: true }).locator('..');
  await expect(average.getByText('—', { exact: true })).toBeVisible();
  await expect(column.getByText('—', { exact: true })).toBeVisible();
  expect(await skeletonBars(average)).toBe(0);
  expect(await skeletonBars(column)).toBe(0);
  ys.timeout = await recordButtonY(page);

  await page.getByRole('button', { name: '重试' }).click();
  await expect.poll(() => skeletonBars(average), { timeout: 4_000 }).toBeGreaterThan(0);
  ys.retrySkeleton = await recordButtonY(page);
  holding = false;
  parked.splice(0).forEach((release) => release());
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  await expect(page.getByText('数据不足', { exact: true })).toBeVisible();
  ys.content1 = await recordButtonY(page);

  await page.unroute('**/rest/v1/weight_records*');
  await installApi(page, {
    weights: [72, 73, 74, 75, 76, 77, 78].map((kilograms, index) => weightRow(`w-${index}`, day, kilograms, 8 + index)),
  });
  await page.goto('/');
  await expect(page.getByText('复测', { exact: true })).toHaveCount(6);
  await expect(page.getByText('数据不足', { exact: true })).toBeVisible();
  ys.content7 = await recordButtonY(page);

  await installApi(page, {
    weights: [0, 1, 2, 3].map((ago) => weightRow(`d-${ago}`, shiftDay(day, -ago), 72 + ago, 8)),
  });
  await page.goto('/');
  await expect(page.getByText('73.5', { exact: false })).toBeVisible();
  await expect(page.getByText('数据不足', { exact: true })).toHaveCount(0);
  ys.contentAverage = await recordButtonY(page);

  await page.route('**/rest/v1/weight_records*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 500,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: '{"message":"down"}',
    });
  });
  await page.goto('/');
  await expect(page.getByText('没加载出来，检查网络后再试')).toBeVisible();
  await expect(page.getByText('7 日均重', { exact: true }).locator('xpath=../..').getByText('—', { exact: true })).toBeVisible();
  ys.error500 = await recordButtonY(page);

  const values = Object.values(ys);
  const low = Math.min(...values);
  const high = Math.max(...values);
  expect(high - low, JSON.stringify(ys)).toBeLessThanOrEqual(1);
});

async function recordButtonY(page: Page): Promise<number> {
  const box = await page.getByRole('button', { name: '记录', exact: true }).boundingBox();
  expect(box).not.toBeNull();
  return box!.y;
}

function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

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
  await expectRecordOpensSheet(page);
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
