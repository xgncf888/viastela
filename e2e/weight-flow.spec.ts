import { expect, test, type Page, type Route } from '@playwright/test';

import { closeRecordSheet, recordButton, recordSheetHeading, waitForTodayLoaded } from './selectors';
import { accountingDay, installApi, signIn, weightRow } from './session';

test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 } });

test('再记 opens a prefilled sheet and only saving adds a record', async ({ page }) => {
  const day = accountingDay();
  await signIn(page);
  await installApi(page, { weights: [weightRow('w-1', day, 73.7)] });
  await page.goto('/');
  await waitForTodayLoaded(page);
  await expect(page.getByRole('button', { name: '再记 73.7 kg' })).toBeVisible();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);

  await page.getByRole('button', { name: '再记 73.7 kg' }).click();
  await expect(recordSheetHeading(page, 'weight')).toBeVisible();
  const prefilled = page.getByRole('textbox', { name: '体重（kg）' });
  await expect(prefilled).toHaveValue('73.7');
  await expect(prefilled).toBeFocused();
  await expect(prefilled).toHaveAttribute('inputmode', 'decimal');
  await expect(page.getByRole('button', { name: /填入上次/ })).toHaveCount(0);
  await closeRecordSheet(page).click();
  await expect(recordSheetHeading(page, 'weight')).toBeHidden();
  await recordButton(page).click();
  await expect(page.getByRole('textbox', { name: '体重（kg）' })).toHaveValue('');
  await expect(page.getByRole('button', { name: '填入上次 73.7' })).toBeVisible();
  await closeRecordSheet(page).click();
  await expect(recordSheetHeading(page, 'weight')).toBeHidden();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await expect(page.getByText('复测', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: '再记 73.7 kg' }).click();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('复测', { exact: true })).toHaveCount(1);
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
});

test('saving a soft-deleted record says it was removed elsewhere and has no retry', async ({ page }) => {
  const day = accountingDay();
  await signIn(page);
  await installApi(page, {
    weights: [weightRow('w-1', day, 73.7)],
    onWrite: async (route) => {
      await route.fulfill({
        status: 400,
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          code: 'P0001',
          message: 'record deleted',
          details: null,
          hint: null,
        }),
      });
    },
  });
  await page.goto('/');
  await waitForTodayLoaded(page);
  await expect(page.getByRole('button', { name: '再记 73.7 kg' })).toBeVisible();
  await page.getByRole('button', { name: '再记 73.7 kg' }).click();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('这条记录已在其他设备删除')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试' })).toHaveCount(0);
});

test('a row-level security error other than record deleted can be retried', async ({ page }) => {
  const day = accountingDay();
  await signIn(page);
  await installApi(page, {
    weights: [weightRow('w-1', day, 73.7)],
    onWrite: async (route) => {
      await route.fulfill({
        status: 403,
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          code: '42501',
          message: 'new row violates row-level security policy for table "weight_records"',
          details: null,
          hint: null,
        }),
      });
    },
  });
  await page.goto('/');
  await waitForTodayLoaded(page);
  await expect(page.getByRole('button', { name: '再记 73.7 kg' })).toBeVisible();
  await page.getByRole('button', { name: '再记 73.7 kg' }).click();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('保存失败，请重试')).toBeVisible();
  await expect(recordSheetHeading(page)).toBeHidden();
  await expect(page.getByText('这条记录已在其他设备删除')).toHaveCount(0);
  await expect(page.getByText('保存失败，请重试')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试' })).toBeVisible();
});

test('a pending delete drops out of 复测 numbering and the 7-day average', async ({ page }) => {
  const writes = trackWrites();
  await openPausedToday(
    page,
    [
      weightRow('d24', '2026-10-24', 70, 8),
      weightRow('d25', '2026-10-25', 70, 8),
      weightRow('d26', '2026-10-26', 70, 8),
      weightRow('d27', day, 70, 8),
      weightRow('d27b', day, 72.4, 9),
    ],
    writes,
  );
  await expect(page.getByText('复测', { exact: true })).toHaveCount(1);
  await expect(page.getByText('70.0', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '删除' }).nth(0).click();
  await expect(page.getByText('复测', { exact: true })).toHaveCount(0);
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await expect(page.getByText('72.4 kg · 9:15')).toBeVisible();
  // 7-day average of the remaining morning weigh-ins: (70 + 70 + 70 + 72.4) / 4.
  await expect(page.getByText('70.6', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText('复测', { exact: true })).toHaveCount(1);
  await expect(page.getByText('70.0', { exact: true })).toBeVisible();
  await page.clock.fastForward(5_000);
  await expectNoWrites(writes);
});

const day = '2026-10-27';

function trackWrites() {
  const deletedAtWrites: string[] = [];
  let otherWrites = 0;
  return {
    deletedAtWrites,
    otherWrites: () => otherWrites,
    onWrite: async (route: Route) => {
      otherWrites += 1;
      await route.fulfill({
        status: 201,
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'application/json',
        },
        body: '[]',
      });
    },
    onSoftDelete: (body: string) => {
      deletedAtWrites.push(body);
    },
  };
}

async function expectNoWrites(writes: ReturnType<typeof trackWrites>) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(writes.deletedAtWrites).toEqual([]);
  expect(writes.otherWrites()).toBe(0);
}

async function openPausedToday(page: Page, weights: ReturnType<typeof weightRow>[], writes: ReturnType<typeof trackWrites>) {
  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, { weights, onWrite: writes.onWrite, onSoftDelete: writes.onSoftDelete });
  await page.goto('/');
  await waitForTodayLoaded(page);
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '删除' })).toHaveCount(weights.filter((row) => row.local_day === day).length);
  await page.clock.pauseAt(`${day}T08:01:00.000Z`);
}

test('删除 hides the row immediately and 撤销 within 5s sends no write', async ({ page }) => {
  const writes = trackWrites();
  await openPausedToday(page, [weightRow('w-1', day, 73.7)], writes);

  const remove = page.getByRole('button', { name: '删除' });
  await expect(remove).toBeVisible();
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  const buttonBox = await remove.boundingBox();
  const labelBox = await page.getByText('晨重', { exact: true }).boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(labelBox).not.toBeNull();
  expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
  expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
  expect(buttonBox!.width).toBeLessThan(200);
  expect(buttonBox!.x).toBeGreaterThan(labelBox!.x + labelBox!.width);

  await remove.click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('已删除 · 撤销');
  await page.clock.fastForward(4_999);
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await page.clock.fastForward(5_000);
  await expectNoWrites(writes);
});

test('no undo sends exactly one deleted_at soft-delete at 5s', async ({ page }) => {
  const writes = trackWrites();
  await openPausedToday(page, [weightRow('w-1', day, 73.7)], writes);

  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(0);
  await page.clock.fastForward(4_999);
  await expectNoWrites(writes);
  await page.clock.fastForward(1);
  await expect.poll(() => writes.deletedAtWrites.length).toBe(1);
  expect(writes.deletedAtWrites[0]).toContain('w-1');
  expect(writes.otherWrites()).toBe(0);
  await page.clock.fastForward(5_000);
  expect(writes.deletedAtWrites).toHaveLength(1);
});

test('background, close, or reload within 5s drops the delete', async ({ page }) => {
  const writes = trackWrites();
  await openPausedToday(page, [weightRow('w-1', day, 73.7)], writes);

  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.stringify(window.localStorage));
  expect(stored).not.toContain('w-1');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await page.clock.fastForward(5_000);
  await expectNoWrites(writes);

  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await page.clock.fastForward(5_000);
  await expectNoWrites(writes);

  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(0);
  await page.clock.resume();
  await page.reload();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await page.clock.pauseAt(`${day}T08:03:00.000Z`);
  await page.clock.fastForward(5_000);
  await expectNoWrites(writes);
});

test('a later delete restarts the shared undo window for every pending row', async ({ page }) => {
  const writes = trackWrites();
  await openPausedToday(page, [weightRow('w-1', day, 73.7, 8), weightRow('w-2', day, 74.1, 9)], writes);
  await expect(page.getByText('复测', { exact: true })).toHaveCount(1);

  await page.getByRole('button', { name: '删除' }).nth(0).click();
  await expect(page.getByRole('alert')).toContainText('已删除 · 撤销');
  await page.clock.fastForward(4_000);
  await expectNoWrites(writes);
  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(0);
  await expect(page.getByText('复测', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('已删除 2 条 · 撤销');
  await page.clock.fastForward(4_999);
  await expectNoWrites(writes);
  await page.clock.fastForward(1);
  await expect.poll(() => writes.deletedAtWrites.length).toBe(2);
  expect(writes.deletedAtWrites.some((body) => body.includes('w-1'))).toBe(true);
  expect(writes.deletedAtWrites.some((body) => body.includes('w-2'))).toBe(true);
  expect(writes.otherWrites()).toBe(0);
});

test('撤销 restores every pending row and sends no write', async ({ page }) => {
  const writes = trackWrites();
  await openPausedToday(page, [weightRow('w-1', day, 73.7, 8), weightRow('w-2', day, 74.1, 9)], writes);

  await page.getByRole('button', { name: '删除' }).nth(0).click();
  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByRole('alert')).toContainText('已删除 2 条 · 撤销');
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await expect(page.getByText('复测', { exact: true })).toHaveCount(1);
  await page.clock.fastForward(5_000);
  await expectNoWrites(writes);
});

test('saving a record does not cover the undo toast', async ({ page }) => {
  const writes = trackWrites();
  await openPausedToday(page, [weightRow('w-1', day, 73.7)], writes);

  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByRole('alert')).toContainText('已删除 · 撤销');
  await page.getByRole('button', { name: '再记 73.7 kg' }).click();
  await page.getByRole('textbox', { name: '体重（kg）' }).fill('80.2');
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('80.2 kg · 8:01')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('已删除 · 撤销');
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText('73.7 kg · 8:15')).toBeVisible();
  await expect(page.getByText('80.2 kg · 8:01')).toBeVisible();
  await page.clock.fastForward(5_000);
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(writes.deletedAtWrites).toEqual([]);
  expect(writes.otherWrites()).toBe(1);
});
