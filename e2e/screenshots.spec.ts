import { expect, test, type Locator, type Page, type Route } from '@playwright/test';

import { recordButton, recordSheetHeading, waitForTodayLoaded } from './selectors';
import { installApi, signIn, weightRow, type StudyRow, type TrainingRow } from './session';

/**
 * DESIGN §14 「截图测试」 (PR C). Runs only in the five screenshot projects (SCREENSHOTS=1), never
 * in the gating e2e run. Baselines come only from the CI Playwright container; see
 * .github/workflows/screenshots.yml. Every API call is mocked; every number here is made up.
 *
 * Determinism: fixed clock and UTC, reduced motion (the skeleton does not pulse), animations
 * and the caret disabled in toHaveScreenshot, fonts awaited, off-box requests aborted, and any
 * clock-time text (H:mm) masked.
 */

const day = '2026-10-27';
const now = `${day}T09:00:00.000Z`;
const at = (hour: number, minute = 0) => `${day}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
const accountId = '44444444-4444-4444-8444-444444444444';
const holdingId = '33333333-3333-4333-8333-333333333333';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'content-type': 'application/json',
};

const training: TrainingRow[] = [
  { id: 't-1', exercise: '深蹲', reps: 8, weight_kg: 40, band_level: null, recorded_at: at(7), tz: 'UTC', local_day: day, updated_at: at(7) },
  { id: 't-2', exercise: '深蹲', reps: 8, weight_kg: 40, band_level: null, recorded_at: at(7, 5), tz: 'UTC', local_day: day, updated_at: at(7, 5) },
  { id: 't-3', exercise: '俯卧撑', reps: 12, weight_kg: null, band_level: null, recorded_at: at(7, 10), tz: 'UTC', local_day: day, updated_at: at(7, 10) },
];
const study: StudyRow[] = [
  { id: 's-1', topic: '英语', duration_minutes: 30, note: null, recorded_at: at(8), tz: 'UTC', local_day: day, updated_at: at(8) },
];

/** Weight rows: 73.5 kg, then 73.6, 73.7 … one per hour from 01:15. */
function weights(count: number) {
  return Array.from({ length: count }, (_, index) => weightRow(`w-${index + 1}`, day, 73.5 + index / 10, index + 1));
}

type Hold = 'weights' | 'assets' | null;

async function open(
  page: Page,
  options: {
    path?: string;
    weightCount?: number;
    withTrainingStudy?: boolean;
    hold?: Hold;
    weightsFail?: boolean;
    assets?: 'ok' | 'quotes-fail';
  },
) {
  await page.clock.install({ time: new Date(now) });
  await signIn(page);
  await installApi(page, {
    weights: weights(options.weightCount ?? 0),
    training: options.withTrainingStudy ? training : [],
    study: options.withTrainingStudy ? study : [],
  });
  if (options.assets) await installAssets(page, options.assets === 'quotes-fail');
  if (options.hold === 'weights' || options.weightsFail) {
    await page.route('**/rest/v1/weight_records**', async (route) => {
      if (route.request().method() !== 'GET') return route.fallback();
      if (options.weightsFail) return route.fulfill({ status: 500, headers: cors, body: '{"message":"down"}' });
      // Never answered, so the skeleton stays up (frozen by reduced motion) until the shot.
    });
  }
  if (options.hold === 'assets') {
    await page.route('**/rest/v1/asset_accounts**', async () => {
      // Never answered.
    });
  }
  // Last registered runs first: nothing leaves the box.
  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.fallback();
    return route.abort();
  });
  await page.goto(options.path ?? '/');
}

async function installAssets(page: Page, quotesFail: boolean) {
  const quoteBody = {
    quotes: [{ symbol: 'AAA', price: 11, currency: 'USD', as_of: at(8, 30), status: 'fresh', source: 'finnhub' }],
    rates: [],
    source: 'finnhub',
    total_usd: 283,
    cash_usd: 250,
    securities_usd: 33,
    unpriced: 0,
    stale: false,
    snapshot: 'skipped',
  };
  if (quotesFail) {
    // A cached book from an earlier session, so the failure row shows 「更新失败 · 行情更新于 HH:mm」.
    await page.addInitScript(
      ({ key, book }) => localStorage.setItem(key, JSON.stringify(book)),
      { key: 'viastela.quote-cache.v1.11111111-1111-4111-8111-111111111111', book: quoteBody },
    );
  }
  await page.route('**/*', async (route: Route) => {
    const request = route.request();
    const url = request.url();
    if (!url.includes('127.0.0.1:54321')) return route.fallback();
    const ok = (body: unknown, status = 200) => route.fulfill({ status, headers: cors, body: JSON.stringify(body) });
    const object = (request.headers().accept ?? '').includes('vnd.pgrst.object');
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (url.includes('/functions/v1/quotes')) return quotesFail ? ok({ error: 'quote_unavailable' }, 500) : ok(quoteBody);
    const account = { id: accountId, name: '现金', currency: 'USD', deleted_at: null, created_at: '2026-01-01T00:00:00.000Z' };
    if (url.includes('/rest/v1/asset_accounts')) return ok(object ? account : [account]);
    if (url.includes('/rest/v1/account_balances'))
      return ok([{ id: 'b-1', account_id: accountId, amount: 250, usd_rate: null, recorded_at: at(8), tz: 'UTC', local_day: day, deleted_at: null }]);
    if (url.includes('/rest/v1/holdings'))
      return ok([{ id: holdingId, account_id: accountId, symbol: 'AAA', quantity: 3, cost_basis_usd: 10, deleted_at: null }]);
    if (url.includes('/rest/v1/net_worth_goals') || url.includes('/rest/v1/projection_assumptions')) return ok(object ? null : []);
    if (url.includes('/rest/v1/net_worth_snapshots') || url.includes('/rest/v1/asset_events')) return ok([]);
    return route.fallback();
  });
}

/** Scroll a row to mid-screen so the fixed tab bar never covers it. */
async function centre(locator: Locator) {
  await locator.evaluate((element) => element.scrollIntoView({ block: 'center' }));
}

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
}

/**
 * Standalone clock labels (TimelineItem's HH:mm) are masked. Only the label itself: a wider mask
 * would hide the rows the shot is for. Inline times (the quote failure row's 「行情更新于 08:30」)
 * come from a fixed fixture under the fixed clock and stay visible on purpose.
 */
function masks(page: Page) {
  return [page.getByText(/^\s*\d{1,2}:\d{2}\s*$/)];
}

async function shot(page: Page, name: string) {
  await settle(page);
  await expect(page).toHaveScreenshot(`${name}.png`, { mask: masks(page) });
}

test.describe('Today', () => {
  test('1 row', async ({ page }) => {
    await open(page, { weightCount: 1, withTrainingStudy: true });
    await waitForTodayLoaded(page);
    await shot(page, 'today-1-row');
  });

  test('7 rows', async ({ page }) => {
    await open(page, { weightCount: 7 });
    await waitForTodayLoaded(page);
    await expect(page.getByText('复测', { exact: true })).toHaveCount(6);
    await shot(page, 'today-7-rows');
  });

  test('empty', async ({ page }) => {
    await open(page, { weightCount: 0 });
    await waitForTodayLoaded(page);
    await shot(page, 'today-empty');
  });

  test('loading skeleton', async ({ page }) => {
    await open(page, { weightCount: 1, hold: 'weights' });
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached({ timeout: 4_000 });
    // Well inside the 8s timeout; reduced motion keeps the skeleton at one opacity.
    await shot(page, 'today-skeleton');
  });

  test('error', async ({ page }) => {
    await open(page, { weightCount: 1, weightsFail: true });
    await expect(page.getByText('没加载出来，检查网络后再试')).toBeVisible();
    await shot(page, 'today-error');
  });

  test('record sheet open', async ({ page }) => {
    await open(page, { weightCount: 1 });
    await waitForTodayLoaded(page);
    await recordButton(page).click();
    await expect(recordSheetHeading(page)).toBeVisible();
    await shot(page, 'record-sheet');
  });

  test('training sets', async ({ page }) => {
    await open(page, { weightCount: 1, withTrainingStudy: true });
    await waitForTodayLoaded(page);
    await page.getByText('查看每组', { exact: true }).click();
    const sets = page.getByText('12 次', { exact: false }).first();
    await centre(sets);
    await expect(sets).toBeVisible();
    await shot(page, 'training');
  });

  test('study records', async ({ page }) => {
    await open(page, { weightCount: 1, withTrainingStudy: true });
    await waitForTodayLoaded(page);
    await page.getByText('查看记录', { exact: true }).click();
    await expect(page.getByText('收起', { exact: true })).toBeVisible();
    const records = page.getByText('英语', { exact: false }).last();
    await centre(records);
    await expect(records).toBeVisible();
    await shot(page, 'study');
  });
});

test.describe('Assets', () => {
  test('loaded', async ({ page }) => {
    await open(page, { path: '/assets', assets: 'ok' });
    await expect(page.getByText('现金').first()).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await shot(page, 'assets-loaded');
  });

  test('skeleton', async ({ page }) => {
    await open(page, { path: '/assets', assets: 'ok', hold: 'assets' });
    await expect(page.locator('[aria-busy="true"]').first()).toBeAttached({ timeout: 4_000 });
    await shot(page, 'assets-skeleton');
  });

  test('quote failure row', async ({ page }) => {
    await open(page, { path: '/assets', assets: 'quotes-fail' });
    await expect(page.getByText(/更新失败 · 行情更新于 08:30/)).toBeVisible();
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
    await shot(page, 'assets-quote-failure');
  });
});
