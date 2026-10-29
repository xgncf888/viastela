import { expect, test } from '@playwright/test';

test('an unknown route shows the missing page', async ({ page }) => {
  await page.goto('/this-page-is-not-real');
  await expect(page.getByText('找不到这一页')).toBeVisible();
  await expect(page.getByText('这个地址没有对应的页面。')).toBeVisible();
  await expect(page.getByText('记下体重后，这里会显示近 7 日均重。')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '回到今日' })).toBeVisible();
});
