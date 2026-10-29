import { expect, test } from '@playwright/test';

import { installApi, signIn, weightRow } from './session';

const day = '2026-10-27';

test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 } });

async function openPausedToday(page: import('@playwright/test').Page) {
  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
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
          code: '42501',
          message: 'new row violates row-level security policy',
          details: null,
          hint: null,
        }),
      });
    },
  });
  await page.goto('/');
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await page.clock.pauseAt(`${day}T08:01:00.000Z`);
}

test('an error toast stacks above the undo toast while both stay visible', async ({ page }) => {
  await openPausedToday(page);
  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '已删除' })).toBeVisible();

  await page.getByRole('button', { name: '再记 73.7 kg' }).click();
  await page.getByRole('button', { name: '保存' }).click();

  const error = page.getByRole('alert').filter({ hasText: '保存失败，请重试' });
  const undo = page.getByRole('alert').filter({ hasText: '已删除' });
  await expect(error).toBeVisible();
  await expect(undo).toBeVisible();
  const errorBox = await error.boundingBox();
  const undoBox = await undo.boundingBox();
  expect(errorBox).not.toBeNull();
  expect(undoBox).not.toBeNull();
  expect(errorBox!.y).toBeLessThan(undoBox!.y);
});
