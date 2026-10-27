import { expect, test } from '@playwright/test';

import { accountingDay, installApi, signIn, weightRow } from './session';

test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 } });

test('再记 opens a prefilled sheet and only saving adds a record', async ({ page }) => {
  const day = accountingDay();
  await signIn(page);
  await installApi(page, { weights: [weightRow('w-1', day, 73.7)] });
  await page.goto('/');
  await expect(page.getByRole('button', { name: '再记 73.7 kg' })).toBeVisible();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);

  await page.getByRole('button', { name: '再记 73.7 kg' }).click();
  await expect(page.getByRole('heading', { name: '记录' })).toBeVisible();
  const prefilled = page.getByRole('textbox', { name: '体重（kg）' });
  await expect(prefilled).toHaveValue('73.7');
  await expect(prefilled).toBeFocused();
  await expect(prefilled).toHaveAttribute('inputmode', 'decimal');
  await expect(page.getByRole('button', { name: /填入上次/ })).toHaveCount(0);
  await page.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByRole('heading', { name: '记录' })).toBeHidden();
  await page.getByRole('button', { name: '记录' }).click();
  await expect(page.getByRole('textbox', { name: '体重（kg）' })).toHaveValue('');
  await expect(page.getByRole('button', { name: '填入上次 73.7' })).toBeVisible();
  await page.getByRole('button', { name: '关闭' }).click();
  await expect(page.getByRole('heading', { name: '记录' })).toBeHidden();
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
  await page.getByRole('button', { name: '再记 73.7 kg' }).click();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByText('这条记录已在其他设备删除')).toBeVisible();
  await expect(page.getByRole('button', { name: '重试' })).toHaveCount(0);
});

test('删除 then 撤销 writes nothing; letting the toast expire soft-deletes once', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-27T08:00:00.000Z') });
  let writes = 0;
  let softDeletes = 0;
  await signIn(page);
  await installApi(page, {
    weights: [weightRow('w-1', '2026-10-27', 73.7)],
    onWrite: async (route) => {
      writes += 1;
      await route.fulfill({
        status: 201,
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'application/json',
        },
        body: '[]',
      });
    },
    onSoftDelete: () => {
      softDeletes += 1;
    },
  });
  await page.goto('/');
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await page.clock.pauseAt('2026-10-27T08:01:00.000Z');

  const remove = page.getByRole('button', { name: '删除' });
  const buttonBox = await remove.boundingBox();
  const labelBox = await page.getByText('晨重', { exact: true }).boundingBox();
  expect(buttonBox).not.toBeNull();
  expect(labelBox).not.toBeNull();
  expect(buttonBox!.height).toBeGreaterThanOrEqual(44);
  expect(buttonBox!.width).toBeGreaterThanOrEqual(44);
  expect(buttonBox!.width).toBeLessThan(200);
  expect(buttonBox!.x).toBeGreaterThan(labelBox!.x + labelBox!.width);
  expect(Math.abs(buttonBox!.y - labelBox!.y)).toBeLessThan(24);

  await remove.click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('已删除 · 撤销');
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.clock.fastForward(5_000);
  expect(softDeletes).toBe(0);
  expect(writes).toBe(0);

  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(0);
  await page.clock.fastForward(5_000);
  await expect.poll(() => softDeletes).toBe(1);
  expect(writes).toBe(0);
  await page.clock.fastForward(5_000);
  expect(softDeletes).toBe(1);
  expect(writes).toBe(0);
});
