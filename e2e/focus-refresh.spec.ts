import { expect, test, type Page } from '@playwright/test';

import { waitForTodayLoaded } from './selectors';
import { installApi, signIn, weightRow } from './session';

const day = '2026-10-29';

/**
 * Kilograms in the 今日 weight column.
 * 趋势 stays mounted and its smoothed-trend card repeats the same `N.N kg`
 * string, so a page-level exact match is ambiguous. The column heading is the
 * container this assertion is about.
 */
function todayWeightKg(page: Page, text: string) {
  return page.getByTestId('today-weight-column').getByText(text, { exact: true });
}
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'content-type': 'application/json',
};

test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 } });

test('returning to 时间线 background-refreshes once and keeps the old rows', async ({ page }) => {
  const rows: Record<string, unknown>[] = [
    {
      id: 'j-old',
      kind: 'journal',
      occurred_at: `${day}T08:00:00.000Z`,
      local_day: day,
      ref_id: null,
      payload: { body: '原来的日志', mood: null, tags: [] },
    },
  ];
  let timelineGets = 0;
  const timelineUrls: string[] = [];
  let delayNext = false;
  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, { weights: [weightRow('w-1', day, 76.4)] });
  await page.route('**/rest/v1/timeline**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    timelineGets += 1;
    timelineUrls.push(route.request().url());
    if (delayNext) {
      delayNext = false;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(rows) });
  });
  await page.route('**/rest/v1/asset_accounts**', async (route) => {
    await route.fulfill({ status: 200, headers: cors, body: '[]' });
  });
  await page.goto('/');
  await waitForTodayLoaded(page);
  await page.getByRole('button', { name: '时间线', exact: true }).click();
  await expect(page.getByText('原来的日志')).toBeVisible();
  // One page load is two scans: dated rows, then asset rows. A second load would be four.
  await expect.poll(() => timelineGets).toBe(2);
  expect(timelineUrls.filter((url) => url.includes('local_day=not.is.null'))).toHaveLength(1);
  expect(timelineUrls.filter((url) => url.includes('local_day=is.null'))).toHaveLength(1);

  await page.getByRole('button', { name: '今日', exact: true }).click();
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  rows.push({
    id: 'j-new',
    kind: 'journal',
    occurred_at: `${day}T08:50:00.000Z`,
    local_day: day,
    ref_id: null,
    payload: { body: '新写的一条日志', mood: null, tags: [] },
  });
  delayNext = true;
  const before = timelineGets;
  await page.getByRole('button', { name: '时间线', exact: true }).click();
  await expect(page.getByRole('heading', { name: '时间线' })).toBeVisible();
  await expect(page.getByText('原来的日志')).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(page.getByText('正在加载时间线')).toHaveCount(0);
  await expect(page.getByText('新写的一条日志')).toBeVisible();
  expect(timelineGets - before).toBe(2);
  expect(timelineUrls.filter((url) => url.includes('local_day=not.is.null'))).toHaveLength(2);
  expect(timelineUrls.filter((url) => url.includes('local_day=is.null'))).toHaveLength(2);
});

test('今日 first visit loads weight once, and a return refreshes once without a skeleton', async ({ page }) => {
  let weightGets = 0;
  let delayNext = false;
  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, { weights: [weightRow('w-1', day, 76.4)] });
  await page.route('**/rest/v1/weight_records**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    weightGets += 1;
    if (delayNext) {
      delayNext = false;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    await route.fallback();
  });
  await page.goto('/');
  await waitForTodayLoaded(page);
  // One read is the window list plus the newest row.
  await expect.poll(() => weightGets).toBe(2);

  await page.getByRole('button', { name: '时间线', exact: true }).click();
  await expect(page.getByRole('heading', { name: '时间线' })).toBeVisible();
  delayNext = true;
  const before = weightGets;
  await page.getByRole('button', { name: '今日', exact: true }).click();
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  await expect(page.getByText('76.4 kg', { exact: true })).toBeVisible();
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect.poll(() => weightGets - before).toBe(2);
});

test('今日 -> 趋势 -> 今日 within 400ms shows weight written while away', async ({ page }) => {
  const weights = [weightRow('w-1', day, 76.4)];
  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, { weights });
  await page.goto('/');
  await waitForTodayLoaded(page);
  await expect(todayWeightKg(page, '76.4 kg')).toBeVisible();

  weights.splice(0, 1, weightRow('w-2', day, 80.2));
  const started = Date.now();
  await page.getByRole('button', { name: '趋势', exact: true }).click({ noWaitAfter: true });
  await page.getByRole('button', { name: '今日', exact: true }).click({ noWaitAfter: true });
  expect(Date.now() - started).toBeLessThan(400);
  await expect(todayWeightKg(page, '80.2 kg')).toBeVisible();
  await expect(page.getByText('76.4 kg', { exact: true })).toHaveCount(0);
});

test('one tab tap replaces the route once and the current tab does not', async ({ page }) => {
  await page.addInitScript(() => {
    const replace = history.replaceState.bind(history);
    const count = { n: 0 };
    (window as unknown as { __replaces?: { n: number } }).__replaces = count;
    history.replaceState = (...args: Parameters<History['replaceState']>) => {
      count.n += 1;
      return replace(...args);
    };
  });
  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, { weights: [weightRow('w-1', day, 76.4)] });
  await page.goto('/');
  await waitForTodayLoaded(page);
  const read = () => page.evaluate(() => (window as unknown as { __replaces: { n: number } }).__replaces.n);
  const onToday = await read();
  await page.getByRole('button', { name: '今日', exact: true }).click();
  expect(await read()).toBe(onToday);
  await page.getByRole('button', { name: '趋势', exact: true }).click();
  await expect(page).toHaveURL(/\/trend$/);
  expect(await read()).toBe(onToday + 1);
});
