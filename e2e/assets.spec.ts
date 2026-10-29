import { expect, test, type Page, type Route } from '@playwright/test';

import { QUOTES_TIMEOUT_MS } from '../src/lib/timing';
import { lightColor } from '../src/ui/theme';
import { authSession, installApi, userId } from './session';

const otherUserId = '22222222-2222-4222-8222-222222222222';
const accountId = '44444444-4444-4444-8444-444444444444';
const holdingId = '33333333-3333-4333-8333-333333333333';
const quoteKey = (id: string) => `viastela.quote-cache.v1.${id}`;

function hexColor(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255})`;
}

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

type Balance = {
  id: string;
  account_id: string;
  amount: number;
  usd_rate: number | null;
  recorded_at: string;
  tz: string;
  local_day: string;
  deleted_at: string | null;
};

type GoalRow = {
  id: string;
  target_usd: number;
  target_date: string | null;
  updated_at: string;
};

type GoalLog = {
  writes: number;
  reads: number;
  failuresLeft: number;
  rows: GoalRow[];
};

function emptyGoalLog(): GoalLog {
  return { writes: 0, reads: 0, failuresLeft: 0, rows: [] };
}

function latestGoal(log: GoalLog): GoalRow | null {
  return [...log.rows].sort((left, right) => right.updated_at.localeCompare(left.updated_at))[0] ?? null;
}

function rememberGoal(log: GoalLog, body: string): void {
  log.writes += 1;
  const parsed = JSON.parse(body) as Partial<GoalRow> | Partial<GoalRow>[];
  const row = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!row?.id || typeof row.target_usd !== 'number') return;
  const next: GoalRow = {
    id: row.id,
    target_usd: row.target_usd,
    target_date: row.target_date ?? null,
    updated_at: new Date(Date.UTC(2026, 0, 15, 0, 0, log.writes)).toISOString(),
  };
  const index = log.rows.findIndex((item) => item.id === next.id);
  if (index === -1) log.rows.push(next);
  else log.rows[index] = next;
}

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
    balances?: Balance[];
    onHoldingPatch?: (body: string) => void;
    onAccountPatch?: (body: string) => void;
    quotes?: { fail: boolean };
    quotePlan?: (method: string) => 'ok' | 'hang' | 'hold' | 'preflight-403' | 'http-500';
    quoteBody?: () => unknown;
    hangQuote?: (route: Route) => Promise<void>;
    holdQuote?: (route: Route) => Promise<void>;
    goalLog?: GoalLog;
  },
): Promise<void> {
  const goalLog = options.goalLog ?? emptyGoalLog();
  const account: {
    id: string;
    name: string;
    currency: string;
    deleted_at: string | null;
    created_at: string;
  } = {
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
    if (url.includes('/functions/v1/quotes')) {
      if (request.method() === 'OPTIONS') {
        if (options.quotePlan?.('OPTIONS') === 'preflight-403') {
          await route.fulfill({ status: 403, headers: cors, body: 'forbidden' });
          return;
        }
        await route.fulfill({ status: 204, headers: cors });
        return;
      }
      const plan = options.quotePlan?.(request.method()) ?? (options.quotes?.fail ? 'fail' : 'ok');
      if (plan === 'hang') {
        await options.hangQuote?.(route);
        return;
      }
      if (plan === 'hold') {
        await options.holdQuote?.(route);
        return;
      }
      if (plan === 'http-500') {
        await fulfill(route, { error: 'quote_unavailable' }, 500);
        return;
      }
      if (plan === 'fail' || options.quotes?.fail) {
        await fulfill(route, { error: 'quote_unavailable' }, 502);
        return;
      }
      await fulfill(route, options.quoteBody?.() ?? quotesBody());
      return;
    }
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (url.includes('/rest/v1/asset_accounts')) {
      if (request.method() === 'PATCH') {
        const body = request.postData() ?? '';
        options.onAccountPatch?.(body);
        if (body.includes('deleted_at')) account.deleted_at = '2026-01-15T00:00:00.000Z';
        await fulfill(route, [{ id: account.id }]);
        return;
      }
      const shown = account.deleted_at === null || !url.includes('deleted_at=is.null');
      await fulfill(route, wantsObject(route) ? (shown ? account : null) : shown ? [account] : []);
      return;
    }
    if (url.includes('/rest/v1/account_balances')) {
      await fulfill(route, options.balances ?? []);
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
    if (url.includes('/rest/v1/net_worth_goals')) {
      const log = goalLog;
      if (request.method() !== 'GET' && request.method() !== 'HEAD') {
        if (log.failuresLeft > 0) {
          log.failuresLeft -= 1;
          log.writes += 1;
          await fulfill(route, { code: '42501', message: 'permission denied for table net_worth_goals' }, 403);
          return;
        }
        rememberGoal(log, request.postData() ?? '');
        await fulfill(route, [], 201);
        return;
      }
      log.reads += 1;
      const latest = latestGoal(log);
      await fulfill(route, wantsObject(route) ? latest : latest ? [latest] : []);
      return;
    }
    if (url.includes('/rest/v1/projection_assumptions')) {
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

test('no goal shows the guide, the conclusion, and no target legend', async ({ page }) => {
  await installApi(page, { weights: [] });
  await installAssets(page, { holdings: [], events: [] });
  await openAssets(page);
  await expect(page.getByText('还没设目标')).toBeVisible();
  const setGoal = page.getByRole('button', { name: '设一个目标' });
  await expect(setGoal).toBeVisible();
  await expect(setGoal).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(page.getByText('设一个目标后，这里会显示预计哪个月达成')).toBeVisible();
  await expect(page.getByText('目标', { exact: true })).toHaveCount(0);
  await expect(page.getByText('目标进度')).toHaveCount(0);
});

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

const balanceId = '66666666-6666-4666-8666-666666666666';
const balanceTitle = '更新了 现金 余额';

function cashBalance(): Balance {
  return {
    id: balanceId,
    account_id: accountId,
    amount: 40,
    usd_rate: 1,
    recorded_at: '2026-01-15T02:00:00.000Z',
    tz: 'UTC',
    local_day: '2026-01-15',
    deleted_at: null,
  };
}

test('the assets title stays visible while the page is loading', async ({ page }) => {
  const held: Route[] = [];
  await installApi(page, { weights: [] });
  await installAssets(page, { holdings: [], events: [] });
  await page.route('**/rest/v1/asset_accounts*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    held.push(route);
  });
  await openAssets(page);
  await expect(page.getByRole('heading', { name: '总资产' })).toBeVisible();
  await expect(page.locator('[role="status"]')).toHaveText('正在加载资产');
  await expect(page.getByRole('heading', { name: '总资产' })).toBeVisible();
  await expect(page.getByText('还没有账户')).toHaveCount(0);
  await Promise.all(held.map((route) => route.abort().catch(() => undefined)));
});

async function openAssets(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, authSession());
  await page.goto('/assets');
}

test('masked amounts read as 已隐藏金额 in the total, balance, and activity', async ({ page }) => {
  await installApi(page, { weights: [] });
  await installAssets(page, { holdings: [], events: [], balances: [cashBalance()] });
  await openAssets(page);
  await expect(page.getByRole('heading', { name: '总资产' })).toBeVisible();
  await expect(page.getByText('更新了 现金 余额')).toBeVisible();
  const snapshot = await page.locator('body').ariaSnapshot();
  const total = section(snapshot, '总资产', '预测');
  const balance = section(snapshot, '账户', '持仓');
  const activity = section(snapshot, '最近变动', '');
  for (const part of [total, balance, activity]) {
    expect(part).toContain('已隐藏金额');
    expect(part).not.toContain('••••');
  }
});

function section(snapshot: string, start: string, end: string): string {
  const from = snapshot.indexOf(start);
  const to = end.length === 0 ? snapshot.length : snapshot.indexOf(end, from + start.length);
  return snapshot.slice(from, to === -1 ? undefined : to);
}

test('资产 opens from the bottom bar and the sidebar', async ({ page }) => {
  await installApi(page, { weights: [] });
  await installAssets(page, { holdings: [], events: [] });
  await page.goto('/');
  await page.evaluate((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, authSession());

  for (const size of [
    { width: 390, height: 844 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.getByRole('button', { name: '资产', exact: true })).toBeVisible();
    const order = await page.getByRole('button').evaluateAll((nodes) =>
      nodes
        .map((node) => (node.textContent || '').replace(/\s+/g, ''))
        .filter((text) => ['今日', '资产', '趋势', '我的'].includes(text)),
    );
    expect(order).toEqual(['今日', '资产', '趋势', '我的']);

    await page.getByRole('button', { name: '资产', exact: true }).click();
    await expect(page).toHaveURL(/\/assets$/);
    await expect(page.getByRole('heading', { name: '总资产' })).toBeVisible();

    const labelColor = (name: string) =>
      page.getByRole('button', { name, exact: true }).evaluate((node, label) => {
        const match = Array.from(node.querySelectorAll('*')).find((el) => el.textContent === label);
        return getComputedStyle((match as HTMLElement) ?? (node as HTMLElement)).color;
      }, name);
    const selected = await page.getByRole('button', { name: '资产', exact: true });
    const ariaSelected = await selected.getAttribute('aria-selected');
    const ariaCurrent = await selected.getAttribute('aria-current');
    if (ariaSelected != null || (ariaCurrent != null && ariaCurrent !== 'false')) {
      expect(ariaSelected === 'true' || (ariaCurrent != null && ariaCurrent !== 'false')).toBe(true);
    }
    expect(await labelColor('资产')).toBe(hexColor(lightColor.ink));
    expect(await labelColor('今日')).not.toBe(hexColor(lightColor.ink));
  }
});

test('a deleted account balance stays out of recent activity, and undo brings it back', async ({ page }) => {
  const balances = [cashBalance()];
  let patches = 0;
  await installApi(page, { weights: [] });
  await installAssets(page, {
    holdings: [],
    events: [],
    balances,
    onAccountPatch: (body) => {
      if (body.includes('deleted_at')) patches += 1;
    },
  });
  await openAssets(page);
  await expect(page.getByText(balanceTitle)).toBeVisible();
  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText(balanceTitle)).toHaveCount(0);
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText(balanceTitle)).toBeVisible();
  expect(patches).toBe(0);
});

test('after the undo window a deleted account balance is still absent from recent activity', async ({ page }) => {
  const balances = [cashBalance()];
  let patches = 0;
  await installApi(page, { weights: [] });
  await installAssets(page, {
    holdings: [],
    events: [],
    balances,
    onAccountPatch: (body) => {
      if (body.includes('deleted_at')) patches += 1;
    },
  });
  await openAssets(page);
  await expect(page.getByText(balanceTitle)).toBeVisible();
  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText(balanceTitle)).toHaveCount(0);
  await expect.poll(() => patches, { timeout: 8000 }).toBe(1);
  await expect(page.getByText(balanceTitle)).toHaveCount(0);
});

const goalAmountLabel = '目标金额';
const goalSaved = '目标已更新';
const totalUnavailable = '总资产暂时算不出来';
const quoteMissReason = '行情暂时取不到';
const refreshFailed = '更新失败';
const quoteMissLine = '暂无价格，未计入总资产';
const maskedProgressHint = '金额已隐藏，点「显示」查看进度';

async function hangUntilClientAborts(route: Route): Promise<void> {
  await route.request().response();
  try {
    await route.abort();
  } catch {
    // The page already aborted the fetch.
  }
}

async function saveGoalAmount(page: Page, amount: string): Promise<void> {
  const create = page.getByRole('button', { name: '设一个目标' });
  if ((await create.count()) > 0) await create.click();
  else await page.getByRole('button', { name: '调整目标' }).click();
  await page.getByRole('textbox', { name: goalAmountLabel }).fill(amount);
  const started = Date.now();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText(goalSaved)).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole('heading', { name: '目标', exact: true })).toBeHidden({ timeout: 1000 });
  expect(Date.now() - started).toBeLessThan(1000);
}

test('a hanging quotes request still closes the goal sheet and then explains the miss', async ({ page }) => {
  test.setTimeout(QUOTES_TIMEOUT_MS + 20_000);
  const goalLog = emptyGoalLog();
  const aborts: string[] = [];
  page.on('requestfailed', (request) => {
    if (request.url().includes('/functions/v1/quotes') && request.method() === 'POST') {
      aborts.push(request.failure()?.errorText ?? '');
    }
  });
  await installApi(page, { weights: [] });
  await installAssets(page, {
    holdings: [
      {
        id: holdingId,
        account_id: accountId,
        symbol: 'ZZZ',
        quantity: 3,
        cost_basis_usd: null,
        deleted_at: null,
      },
    ],
    events: [],
    goalLog,
    quotePlan: () => 'hang',
    hangQuote: hangUntilClientAborts,
  });
  await openAssets(page);
  await expect(page.getByText(totalUnavailable)).toBeVisible({ timeout: QUOTES_TIMEOUT_MS + 4_000 });
  await expect(page.getByText(quoteMissReason)).toBeVisible();
  await expect(page.getByText(refreshFailed)).toBeVisible();
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
  await expect(page.getByText(quoteMissLine)).toBeVisible();
  await expect(page.getByText('读取中')).toHaveCount(0);
  expect(aborts.some((text) => /abort/i.test(text))).toBe(true);

  await saveGoalAmount(page, '500000');
  expect(goalLog.writes).toBe(1);
  await expect(page.getByText('读取中')).toHaveCount(0);
  await page.waitForTimeout(400);
  expect(goalLog.writes).toBe(1);
  await expect.poll(() => aborts.length, { timeout: QUOTES_TIMEOUT_MS + 4_000 }).toBeGreaterThanOrEqual(2);
});

for (const mode of ['preflight-403', 'http-500'] as const) {
  test(`quotes ${mode} still saves the goal and reopens the new amount`, async ({ page }) => {
    const goalLog = emptyGoalLog();
    await installApi(page, { weights: [] });
    await installAssets(page, {
      holdings: [],
      events: [],
      goalLog,
      quotePlan: (method) => (mode === 'preflight-403' && method === 'OPTIONS' ? 'preflight-403' : 'http-500'),
    });
    await openAssets(page);
    await expect(page.getByText(totalUnavailable)).toBeVisible();
    await expect(page.getByText(quoteMissReason)).toBeVisible();
    await expect(page.getByText(refreshFailed)).toBeVisible();
    await expect(page.getByText('读取中')).toHaveCount(0);
    await saveGoalAmount(page, '500000');
    expect(goalLog.writes).toBe(1);
    await expect(page.getByRole('button', { name: '调整目标' })).toBeVisible();
    await page.getByRole('button', { name: '调整目标' }).click();
    await expect(page.getByRole('textbox', { name: goalAmountLabel })).toHaveValue('500000');
  });
}

test('a failed goal write stays in the sheet and a retry saves once', async ({ page }) => {
  const goalLog = emptyGoalLog();
  goalLog.failuresLeft = 1;
  await installApi(page, { weights: [] });
  await installAssets(page, { holdings: [], events: [], goalLog });
  await openAssets(page);
  await page.getByRole('button', { name: '设一个目标' }).click();
  await page.getByRole('textbox', { name: goalAmountLabel }).fill('500000');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('保存失败，请重试')).toBeVisible();
  await expect(page.getByText(goalSaved)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '目标', exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: goalAmountLabel })).toHaveValue('500000');
  expect(goalLog.writes).toBe(1);
  expect(goalLog.rows).toHaveLength(0);
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText(goalSaved)).toBeVisible({ timeout: 1000 });
  await expect(page.getByRole('heading', { name: '目标', exact: true })).toBeHidden();
  expect(goalLog.writes).toBe(2);
  expect(goalLog.rows[0]?.target_usd).toBe(500000);
});

test('two goal saves during a reload keep the second amount', async ({ page }) => {
  const goalLog = emptyGoalLog();
  let quotePosts = 0;
  let releaseHold: (() => Promise<void>) | null = null;
  await installApi(page, { weights: [] });
  await installAssets(page, {
    holdings: [],
    events: [],
    goalLog,
    quotePlan: (method) => {
      if (method === 'OPTIONS') return 'ok';
      quotePosts += 1;
      return quotePosts === 2 ? 'hold' : 'ok';
    },
    holdQuote: (route) =>
      new Promise((resolve, reject) => {
        releaseHold = async () => {
          try {
            await fulfill(route, quotesBody());
            resolve();
          } catch (error) {
            reject(error instanceof Error ? error : new Error('hold failed'));
          }
        };
      }),
  });
  await openAssets(page);
  await expect(page.getByRole('button', { name: '设一个目标' })).toBeVisible();
  await saveGoalAmount(page, '500000');
  await expect.poll(() => goalLog.reads).toBeGreaterThanOrEqual(2);
  await expect.poll(() => quotePosts).toBe(2);
  const alert = page.getByRole('alert');
  if ((await alert.count()) > 0) await alert.click();
  await saveGoalAmount(page, '700000');
  await expect(page.getByRole('button', { name: '调整目标' })).toBeVisible();
  await page.getByRole('button', { name: '调整目标' }).click();
  await expect(page.getByRole('textbox', { name: goalAmountLabel })).toHaveValue('700000');
  await page.getByRole('button', { name: '关闭' }).click();
  if (!releaseHold) throw new Error('the first reload never held the quotes request');
  await releaseHold();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '调整目标' }).click();
  await expect(page.getByRole('textbox', { name: goalAmountLabel })).toHaveValue('700000');
  expect(goalLog.writes).toBe(2);
});

test('masked amounts hide the goal percent as well as the figures', async ({ page }) => {
  const goalLog = emptyGoalLog();
  goalLog.rows.push({
    id: '99999999-9999-4999-8999-999999999999',
    target_usd: 500000,
    target_date: null,
    updated_at: '2026-01-15T00:00:00.000Z',
  });
  await installApi(page, { weights: [] });
  await installAssets(page, {
    holdings: [],
    events: [],
    goalLog,
    quoteBody: () => ({
      quotes: [],
      rates: [],
      source: 'finnhub',
      total_usd: 12345,
      cash_usd: 0,
      securities_usd: 0,
      unpriced: 0,
      stale: false,
      snapshot: 'skipped',
    }),
  });
  await openAssets(page);
  await expect(page.getByText(maskedProgressHint)).toBeVisible();
  const text = await page.locator('body').innerText();
  const aria = await page.locator('body').ariaSnapshot();
  for (const blob of [text, aria]) {
    expect(blob).not.toContain('500000');
    expect(blob).not.toContain('500,000');
    expect(blob).not.toContain('12345');
    expect(blob).not.toContain('12,345');
    expect(blob).not.toContain('2%');
    expect(blob).not.toContain('目标进度');
  }
  const overview = section(aria, '总资产', '预测');
  expect(overview).toContain(maskedProgressHint);
  expect(overview).not.toContain('%');
  expect(overview).not.toContain('500000');
  expect(overview).not.toContain('12345');
  expect(overview).not.toContain('目标进度');
  const bar = page.getByRole('progressbar');
  await expect(bar).toHaveCount(1);
  expect(await bar.getAttribute('aria-valuenow')).toBeNull();
  const barLabel = (await bar.getAttribute('aria-label')) ?? '';
  expect(barLabel).not.toMatch(/\d|%/);
});

test('a failed quotes refresh shows the cached time and not a balance total', async ({ page }) => {
  await installApi(page, { weights: [] });
  await installAssets(page, {
    holdings: [],
    events: [],
    quotePlan: () => 'http-500',
  });
  await page.goto('/');
  await page.evaluate(
    ({ session, key, book }) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
      localStorage.setItem(key, JSON.stringify(book));
    },
    {
      session: authSession(),
      key: quoteKey(userId),
      book: {
        quotes: [
          {
            symbol: 'AAA',
            price: 11,
            currency: 'USD',
            as_of: '2026-01-15T00:30:00.000Z',
            status: 'fresh',
            source: 'finnhub',
          },
        ],
        rates: [],
        source: 'finnhub',
        total_usd: 12345,
        cash_usd: 0,
        securities_usd: 0,
        unpriced: 0,
        stale: false,
        snapshot: 'skipped',
      },
    },
  );
  let quotePosts = 0;
  page.on('request', (request) => {
    if (request.url().includes('/functions/v1/quotes') && request.method() === 'POST') quotePosts += 1;
  });
  await page.goto('/assets');
  await expect(page.getByText(/更新失败 · 行情更新于 \d{2}:\d{2} · 重试/)).toBeVisible();
  const failure = page.getByText(/更新失败 · 行情更新于 \d{2}:\d{2} · $/);
  await expect(failure).toHaveCSS('color', hexColor(lightColor.warning));
  const retry = page.getByRole('button', { name: '重试' });
  await expect(retry.getByText('重试', { exact: true })).toHaveCSS('color', hexColor(lightColor.accentText));
  const seen = quotePosts;
  expect(seen).toBeGreaterThan(0);
  await retry.click();
  await expect.poll(() => quotePosts).toBeGreaterThan(seen);
  await expect(page.getByText(quoteMissReason)).toHaveCount(0);
  await expect(page.getByText(quoteMissLine)).toHaveCount(0);
  const text = await page.locator('body').innerText();
  expect(text).not.toContain('12345');
  expect(text).not.toContain('12,345');
});

test('the assets skeleton sits inside cards and the eye waits until content loads', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installApi(page, { weights: [] });
  await installAssets(page, { holdings: [], events: [] });
  let release: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/rest/v1/asset_accounts*', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await gate;
    await route.fallback();
  });
  await page.goto('/');
  await page.evaluate((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, authSession());
  await page.goto('/assets');
  await expect(page.getByRole('heading', { name: '总资产' })).toBeVisible();
  await expect(page.getByRole('button', { name: '显示金额' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '隐藏金额' })).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveCount(0);
  await expect(page.locator('[role="status"]')).toHaveText('正在加载资产', { timeout: 4_000 });
  const blocks = await page.locator('[aria-hidden="true"]').evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      let framed = false;
      let current = node.parentElement;
      while (current) {
        if (parseFloat(getComputedStyle(current).borderTopWidth) > 0) {
          framed = true;
          break;
        }
        current = current.parentElement;
      }
      return { w: Math.round(rect.width), h: Math.round(rect.height), framed };
    }),
  );
  const sized = blocks.filter((block) => block.w > 0 && block.h > 0);
  expect(sized.every((block) => block.framed)).toBe(true);
  expect(sized.filter((block) => block.w === 160 && block.h === 24)).toHaveLength(1);
  expect(sized.filter((block) => block.w === 96 && block.h === 16)).toHaveLength(2);
  expect(sized.filter((block) => block.w === 56)).toHaveLength(4);
  expect(sized.filter((block) => block.w === 72)).toHaveLength(4);
  if (!release) throw new Error('the accounts request was never armed');
  release();
  const eye = page.getByRole('button', { name: '显示金额' });
  await expect(eye).toBeVisible();
  const title = await page.getByRole('heading', { name: '总资产' }).boundingBox();
  const toggle = await eye.boundingBox();
  expect(title).not.toBeNull();
  expect(toggle).not.toBeNull();
  expect(Math.abs(title!.y - toggle!.y)).toBeLessThan(24);
  expect(toggle!.x).toBeGreaterThan(title!.x);
});

test('a background refresh that throws keeps cached quotes and shows the failure line', async ({ page }) => {
  await installApi(page, { weights: [] });
  await installAssets(page, { holdings: [], events: [] });
  let failAccounts = false;
  await page.route('**/rest/v1/asset_accounts*', async (route) => {
    if (failAccounts && route.request().method() === 'GET') {
      await route.fulfill({ status: 500, headers: cors, body: JSON.stringify({ message: 'down' }) });
      return;
    }
    await route.fallback();
  });
  await openAssets(page);
  await expect(page.getByRole('button', { name: '显示金额' })).toBeVisible();
  await expect(page.getByText('现金', { exact: true })).toBeVisible();
  await expect(page.getByText(/更新失败/)).toHaveCount(0);
  failAccounts = true;
  await page.getByRole('button', { name: '3%', exact: true }).click();
  await expect(page.getByText(/更新失败 · 行情更新于 \d{2}:\d{2} · 重试/)).toBeVisible();
  const failure = page.getByText(/更新失败 · 行情更新于 \d{2}:\d{2} · $/);
  await expect(failure).toHaveCSS('color', hexColor(lightColor.warning));
  const retry = page.getByRole('button', { name: '重试' });
  await expect(retry.getByText('重试', { exact: true })).toHaveCSS('color', hexColor(lightColor.accentText));
  await expect(page.getByText('现金', { exact: true })).toBeVisible();
  await expect(page.getByText('总资产暂时算不出来')).toHaveCount(0);
  await expect(page.getByText('没加载出来，检查网络后再试')).toHaveCount(0);
});

test('a 200 stale quote body keeps the cached total and shows the failure line', async ({ page }) => {
  await installApi(page, { weights: [] });
  let quotePosts = 0;
  await installAssets(page, {
    holdings: [],
    events: [],
    quoteBody: () => ({
      quotes: [
        {
          symbol: 'AAA',
          price: 80,
          currency: 'USD',
          as_of: '2026-01-15T00:30:00.000Z',
          status: 'stale',
          source: 'finnhub',
        },
      ],
      rates: [],
      source: 'finnhub',
      total_usd: 80,
      cash_usd: 0,
      securities_usd: 80,
      unpriced: 0,
      stale: true,
      snapshot: 'skipped',
    }),
  });
  page.on('request', (request) => {
    if (request.url().includes('/functions/v1/quotes') && request.method() === 'POST') quotePosts += 1;
  });
  await openAssets(page);
  await expect(page.getByText(/更新失败 · 行情更新于 \d{2}:\d{2} · 重试/)).toBeVisible();
  const failure = page.getByText(/更新失败 · 行情更新于 \d{2}:\d{2} · $/);
  await expect(failure).toHaveCSS('color', hexColor(lightColor.warning));
  await expect(page.getByRole('button', { name: '重试' }).getByText('重试', { exact: true })).toHaveCSS(
    'color',
    hexColor(lightColor.accentText),
  );
  await expect(page.getByText('总资产暂时算不出来')).toHaveCount(0);
  await page.getByRole('button', { name: '显示金额' }).click();
  await expect(page.getByText('US$80.00').first()).toBeVisible();
  const seen = quotePosts;
  expect(seen).toBeGreaterThan(0);
  await page.getByRole('button', { name: '重试' }).click();
  await expect.poll(() => quotePosts).toBe(seen + 1);
});

test('a background quotes error with a cache shows the same failure line', async ({ page }) => {
  await installApi(page, { weights: [] });
  await installAssets(page, { holdings: [], events: [] });
  let failQuotes = false;
  await page.route('**/functions/v1/quotes', async (route) => {
    if (failQuotes && route.request().method() === 'POST') {
      await route.fulfill({ status: 500, headers: cors, body: JSON.stringify({ error: 'other' }) });
      return;
    }
    await route.fallback();
  });
  await openAssets(page);
  await expect(page.getByRole('button', { name: '显示金额' })).toBeVisible();
  await expect(page.getByText(/更新失败/)).toHaveCount(0);
  failQuotes = true;
  await page.getByRole('button', { name: '3%', exact: true }).click();
  await expect(page.getByText(/更新失败 · 行情更新于 \d{2}:\d{2} · 重试/)).toBeVisible();
  await expect(page.getByText('总资产暂时算不出来')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '显示金额' })).toBeVisible();
});
