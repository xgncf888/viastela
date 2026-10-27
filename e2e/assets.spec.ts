import { expect, test, type Page, type Route } from '@playwright/test';

import { authSession, installApi, userId } from './session';

const otherUserId = '22222222-2222-4222-8222-222222222222';
const accountId = '44444444-4444-4444-8444-444444444444';
const holdingId = '33333333-3333-4333-8333-333333333333';
const quoteKey = (id: string) => `viastela.quote-cache.v1.${id}`;

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'content-type': 'application/json',
};

type Holding = {
  id: string;
  account_id: string;
  symbol: string;
  quantity: number;
  cost_basis_usd: number | null;
  deleted_at: string | null;
};

type AssetEvent = {
  id: string;
  kind: string;
  symbol: string | null;
  occurred_at: string;
};

function quotesBody() {
  return {
    quotes: [
      {
        symbol: 'AAA',
        price: 64,
        currency: 'USD',
        as_of: '2026-01-15T00:30:00.000Z',
        status: 'fresh',
        source: 'finnhub',
      },
    ],
    rates: [],
    source: 'finnhub',
    total_usd: 64,
    cash_usd: 0,
    securities_usd: 64,
    unpriced: 0,
    stale: false,
    snapshot: 'skipped',
  };
}

async function fulfill(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({ status, headers: cors, body: JSON.stringify(body) });
}

function wantsObject(route: Route): boolean {
  return (route.request().headers().accept ?? '').includes('vnd.pgrst.object');
}

async function installAssets(
  page: Page,
  options: {
    holdings: Holding[];
    events: AssetEvent[];
    onHoldingPatch?: (body: string) => void;
    quotes?: { fail: boolean };
  },
): Promise<void> {
  const account = {
    id: accountId,
    name: '现金',
    currency: 'USD',
    deleted_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
  };
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();
    const api = url.includes('127.0.0.1:54321') || url.includes('localhost:54321');
    if (!api) {
      await route.fallback();
      return;
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (url.includes('/functions/v1/quotes')) {
      if (options.quotes?.fail) {
        await fulfill(route, { error: 'quote_unavailable' }, 502);
        return;
      }
      await fulfill(route, quotesBody());
      return;
    }
    if (url.includes('/rest/v1/asset_accounts')) {
      await fulfill(route, wantsObject(route) ? account : [account]);
      return;
    }
    if (url.includes('/rest/v1/account_balances')) {
      await fulfill(route, []);
      return;
    }
    if (url.includes('/rest/v1/holdings')) {
      if (request.method() === 'PATCH') {
        const body = request.postData() ?? '';
        options.onHoldingPatch?.(body);
        if (body.includes('deleted_at')) {
          const holding = options.holdings.find((row) => row.id === holdingId);
          if (holding) holding.deleted_at = '2026-01-15T00:00:00.000Z';
          options.events.push({
            id: '55555555-5555-4555-8555-555555555555',
            kind: 'holding_removed',
            symbol: 'AAA',
            occurred_at: '2026-01-15T00:00:00.000Z',
          });
        }
        await fulfill(route, [{ id: holdingId }]);
        return;
      }
      const live = options.holdings.filter((row) => row.deleted_at === null || !url.includes('deleted_at=is.null'));
      await fulfill(route, wantsObject(route) ? (live[0] ?? null) : live);
      return;
    }
    if (url.includes('/rest/v1/net_worth_goals') || url.includes('/rest/v1/projection_assumptions')) {
      await fulfill(route, wantsObject(route) ? null : []);
      return;
    }
    if (url.includes('/rest/v1/net_worth_snapshots')) {
      await fulfill(route, []);
      return;
    }
    if (url.includes('/rest/v1/asset_events')) {
      await fulfill(route, options.events);
      return;
    }
    await route.fallback();
  });
}

test.use({ serviceWorkers: 'allow' });

test('signing out clears the quote cache before the next person loads offline', async ({ page, context }) => {
  const events: AssetEvent[] = [];
  const quotes = { fail: false };
  await installApi(page, { weights: [] });
  await installAssets(page, { holdings: [], events, quotes });
  await page.route('**/auth/v1/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/logout')) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }
    await route.fallback();
  });

  await page.goto('/');
  await page.evaluate((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, authSession());
  await page.goto('/assets');
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await page.getByRole('button', { name: '显示金额' }).click();
  await expect(page.getByText('US$64.00').first()).toBeVisible();
  const stored = await page.evaluate((key) => localStorage.getItem(key), quoteKey(userId));
  expect(stored).toContain('64');

  quotes.fail = true;
  await page.getByRole('button', { name: '我的' }).click();
  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByText('用邮箱登录')).toBeVisible();
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), quoteKey(userId))).toBeNull();

  await page.evaluate((storedSession) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(storedSession));
  }, authSession({ userId: otherUserId, email: 'bei@example.com' }));
  await page.goto('/assets');
  await expect(page.locator('body')).not.toContainText('US$64.00');
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), quoteKey(otherUserId))).toBeNull();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('body')).not.toContainText('US$64.00');
});

test('undo within 5 seconds writes nothing', async ({ page }) => {
  const holdings: Holding[] = [
    {
      id: holdingId,
      account_id: accountId,
      symbol: 'AAA',
      quantity: 3,
      cost_basis_usd: 12,
      deleted_at: null,
    },
  ];
  const events: AssetEvent[] = [];
  let patches = 0;
  await installApi(page, { weights: [] });
  await installAssets(page, {
    holdings,
    events,
    onHoldingPatch: (body) => {
      if (body.includes('deleted_at')) patches += 1;
    },
  });
  await page.goto('/');
  await page.evaluate((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, authSession());
  await page.goto('/assets');
  await expect(page.getByText('AAA')).toBeVisible();
  await page.getByRole('button', { name: '删除' }).click();
  await page.getByRole('button', { name: '撤销' }).click();
  await page.waitForTimeout(6000);
  expect(patches).toBe(0);
  expect(holdings[0]?.deleted_at).toBeNull();
  expect(events).toHaveLength(0);
  await expect(page.getByText('AAA')).toBeVisible();
});

test('a holding delete commits once after 5 seconds', async ({ page }) => {
  const holdings: Holding[] = [
    {
      id: holdingId,
      account_id: accountId,
      symbol: 'AAA',
      quantity: 3,
      cost_basis_usd: 12,
      deleted_at: null,
    },
  ];
  const events: AssetEvent[] = [];
  let patches = 0;
  await installApi(page, { weights: [] });
  await installAssets(page, {
    holdings,
    events,
    onHoldingPatch: (body) => {
      if (body.includes('deleted_at')) patches += 1;
    },
  });
  await page.goto('/');
  await page.evaluate((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, authSession());
  await page.goto('/assets');
  await expect(page.getByText('AAA')).toBeVisible();
  const eventsBefore = events.length;
  await page.getByRole('button', { name: '删除' }).click();
  await expect.poll(() => patches, { timeout: 8000 }).toBe(1);
  expect(events.length).toBe(eventsBefore + 1);
  expect(events[0]?.kind).toBe('holding_removed');
  expect(holdings[0]?.deleted_at).not.toBeNull();
});
