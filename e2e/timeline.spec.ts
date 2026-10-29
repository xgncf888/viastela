import { expect, test, type Page, type Route } from '@playwright/test';

import { computeLocalDay } from '../src/core/local-day';
import { timelineDayKey, timelineDayLabel } from '../src/core/timeline-day';
import { navItem, waitForTodayLoaded } from './selectors';
import { authSession, installApi, userId } from './session';

const userB = '22222222-2222-4222-8222-222222222222';
const cashId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const deletedAccountId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'content-type': 'application/json',
};

type TimelineFixture = {
  id: string;
  kind: string;
  occurred_at: string;
  local_day: string | null;
  ref_id: string | null;
  payload: Record<string, unknown>;
};

function subject(authorization: string | undefined): string {
  const token = (authorization ?? '').replace(/^Bearer\s+/i, '');
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as { sub?: string };
    return payload.sub ?? '';
  } catch {
    return '';
  }
}

function fixtureRows(owner: string): TimelineFixture[] {
  if (owner === userB) {
    return [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
        kind: 'journal',
        occurred_at: '2026-10-26T04:00:00.000Z',
        local_day: '2026-10-26',
        ref_id: null,
        payload: { body: '乙的私人日志', mood: null, tags: [] },
      },
    ];
  }
  if (owner !== userId) return [];
  return [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      kind: 'journal',
      occurred_at: '2026-10-27T02:00:00.000Z',
      local_day: '2026-10-26',
      ref_id: null,
      payload: { body: '补记的一天', mood: 3, tags: ['旅行'] },
    },
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      kind: 'holding_added',
      occurred_at: '2026-10-26T20:30:00.000Z',
      local_day: null,
      ref_id: null,
      payload: { symbol: 'AAPL', after_quantity: 10 },
    },
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      kind: 'balance_recorded',
      occurred_at: '2026-10-27T01:00:00.000Z',
      local_day: '2026-10-27',
      ref_id: cashId,
      payload: { after_amount: 10, usd_rate: null, after_usd: null },
    },
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
      kind: 'balance_recorded',
      occurred_at: '2026-10-27T01:05:00.000Z',
      local_day: '2026-10-27',
      ref_id: deletedAccountId,
      payload: { after_amount: 99999, usd_rate: 1, after_usd: 99999 },
    },
  ];
}

async function installTimeline(page: Page, options?: { rejectNextJournal?: boolean }): Promise<TimelineFixture[]> {
  const written: TimelineFixture[] = [];
  await installApi(page, { weights: [] });
  const handle = async (route: Route) => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const url = request.url();
    const owner = subject(request.headers().authorization);
    if (url.includes('/rest/v1/profiles')) {
      await route.fulfill({
        status: 200,
        headers: cors,
        body: JSON.stringify({ user_id: owner || userId, day_switch: '06:00:00' }),
      });
      return;
    }
    if (url.includes('/rest/v1/asset_accounts')) {
      const accounts =
        owner === userId
          ? [{ id: cashId, name: '现金', currency: 'USD' }]
          : owner === userB
            ? [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: '乙的账户', currency: 'USD' }]
            : [];
      await route.fulfill({ status: 200, headers: cors, body: JSON.stringify(accounts) });
      return;
    }
    if (url.includes('/rest/v1/journal_entries') && request.method() === 'POST') {
      const parsed = request.postDataJSON() as
        | { id: string; body: string; entry_day: string; mood: number | null; tags: string[] }
        | { id: string; body: string; entry_day: string; mood: number | null; tags: string[] }[];
      const payload = Array.isArray(parsed) ? parsed[0] : parsed;
      if (options?.rejectNextJournal) {
        await route.fulfill({
          status: 400,
          headers: cors,
          body: JSON.stringify({
            code: '23514',
            message: 'entry_day 2026-10-28 is after today 2026-10-27 in Asia/Singapore',
          }),
        });
        return;
      }
      written.push({
        id: payload.id,
        kind: 'journal',
        occurred_at: new Date().toISOString(),
        local_day: payload.entry_day,
        ref_id: null,
        payload: { body: payload.body, mood: payload.mood, tags: payload.tags },
      });
      await route.fulfill({ status: 201, headers: cors, body: '[]' });
      return;
    }
    if (url.includes('/rest/v1/timeline')) {
      await route.fulfill({
        status: 200,
        headers: cors,
        body: JSON.stringify([...fixtureRows(owner), ...written.filter(() => owner === userId || owner === userB)]),
      });
      return;
    }
    await route.fallback();
  };
  await page.route(/\/rest\/v1\/profiles/, handle);
  await page.route(/\/rest\/v1\/asset_accounts/, handle);
  await page.route(/\/rest\/v1\/journal_entries/, handle);
  await page.route(/\/rest\/v1\/timeline/, handle);
  return written;
}

async function signInAs(page: Page, person: { userId: string; email: string }, unmask = false): Promise<void> {
  await page.addInitScript(
    ({ stored, maskKey }) => {
      localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
      if (maskKey) localStorage.setItem(maskKey, '0');
    },
    {
      stored: authSession(person),
      maskKey: unmask ? `viastela.amount-mask.v1.${person.userId}` : '',
    },
  );
}

test.describe('timeline', () => {
  test.use({ timezoneId: 'Asia/Singapore' });

  test('renders groups from the day switch and hides a deleted account balance', async ({ page }) => {
    await signInAs(page, { userId, email: 'yifeng@example.com' }, true);
    await installTimeline(page);
    await page.goto('/');
    await waitForTodayLoaded(page);
    await navItem(page, '时间线').click();
    await expect(page).toHaveURL(/\/timeline$/);
    await expect(page.getByRole('heading', { name: '时间线' })).toBeVisible();
    await expect(page.getByText('更新了 现金 余额')).toBeVisible();
    await expect(page.getByText('首次记录 US$10.00')).toBeVisible();
    await expect(page.getByText('99999')).toHaveCount(0);
    await expect(page.getByText('US$99,999.00')).toHaveCount(0);
    await expect(page.getByText('已注销')).toHaveCount(0);

    const today = computeLocalDay(new Date(), 'Asia/Singapore', '06:00');
    const assetDay = timelineDayKey(
      { localDay: null, occurredAt: '2026-10-26T20:30:00.000Z' },
      'Asia/Singapore',
      '06:00',
    );
    expect(assetDay).toBe('2026-10-26');
    expect(assetDay).not.toBe(today);
    const label = timelineDayLabel(assetDay, today);
    const text = await page.locator('body').innerText();
    const day = text.indexOf(label);
    const note = text.indexOf('补记的一天');
    const added = text.indexOf('新增持仓 AAPL');
    expect(day).toBeGreaterThanOrEqual(0);
    expect(note).toBeGreaterThan(day);
    expect(added).toBeGreaterThan(note);
    expect(text.slice(day, added)).not.toContain('今天');
  });

  test('keeps two users on their own rows', async ({ browser }) => {
    const contextA = await browser.newContext({
      timezoneId: 'Asia/Singapore',
      baseURL: 'http://127.0.0.1:4173',
    });
    const contextB = await browser.newContext({
      timezoneId: 'Asia/Singapore',
      baseURL: 'http://127.0.0.1:4173',
    });
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    await signInAs(pageA, { userId, email: 'a@example.com' }, true);
    await signInAs(pageB, { userId: userB, email: 'b@example.com' }, true);
    await installTimeline(pageA);
    await installTimeline(pageB);
    await pageA.goto('/timeline');
    await pageB.goto('/timeline');
    await expect(pageA.getByText('补记的一天')).toBeVisible();
    await expect(pageA.getByText('乙的私人日志')).toHaveCount(0);
    await expect(pageB.getByText('乙的私人日志')).toBeVisible();
    await expect(pageB.getByText('补记的一天')).toHaveCount(0);
    await expect(pageB.getByText('更新了 现金 余额')).toHaveCount(0);
    await contextA.close();
    await contextB.close();
  });

  test('records a journal after the write request returns', async ({ page }) => {
    await signInAs(page, { userId, email: 'yifeng@example.com' }, true);
    await installTimeline(page);
    await page.goto('/timeline');
    await page.getByRole('button', { name: '写日志' }).click();
    await page.getByLabel('正文').fill('  今天阳光很好  ');
    const recorded = page.waitForRequest(
      (request) => request.url().includes('/rest/v1/journal_entries') && request.method() === 'POST',
    );
    await page.getByRole('button', { name: '保存' }).click();
    const request = await recorded;
    const parsed = request.postDataJSON() as { body: string; entry_day: string; tags: string[] } | { body: string; entry_day: string; tags: string[] }[];
    const body = Array.isArray(parsed) ? parsed[0] : parsed;
    expect(body.body).toBe('今天阳光很好');
    expect(body.entry_day).toBe(computeLocalDay(new Date(), 'Asia/Singapore', '06:00'));
    expect(body.tags).toEqual([]);
    await expect.poll(async () => page.getByText('已记下').count()).toBeGreaterThan(0);
    await expect.poll(async () => page.getByText('今天阳光很好').count()).toBeGreaterThan(0);
  });

  test('maps a future-day 23514 to the form copy', async ({ page }) => {
    await signInAs(page, { userId, email: 'yifeng@example.com' });
    await installTimeline(page, { rejectNextJournal: true });
    await page.goto('/timeline');
    await page.getByRole('button', { name: '写日志' }).click();
    await page.getByLabel('正文').fill('想记明天');
    const recorded = page.waitForRequest(
      (request) => request.url().includes('/rest/v1/journal_entries') && request.method() === 'POST',
    );
    await page.getByRole('button', { name: '保存' }).click();
    await recorded;
    await expect.poll(async () => page.getByText('不能选择未来的日期').count()).toBeGreaterThan(0);
  });
});
