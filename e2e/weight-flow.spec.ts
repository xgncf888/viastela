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
  await expect(page.getByRole('textbox', { name: '体重（kg）' })).toHaveValue('73.7');
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
