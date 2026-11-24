import { expect, test } from '@playwright/test';

import { brand } from '../src/config/brand';
import { closeRecordSheet, recordButton, rowRecordButton, waitForTodayLoaded } from './selectors';

test.use({ baseURL: 'http://127.0.0.1:4174', actionTimeout: 8_000 });

function isRemoteDataRequest(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.endsWith('.supabase.co')) return true;
    if ((parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost') && parsed.port === '54321') {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

test('dev local mode stays on device, keep restores it, and clear removes it', async ({ page }) => {
  test.setTimeout(60_000);
  const remote: string[] = [];
  page.on('request', (request) => {
    if (isRemoteDataRequest(request.url())) remote.push(request.url());
  });

  await page.goto('/');
  await expect(page.getByRole('button', { name: '先不登录，直接用' })).toBeVisible();
  await expect(page.getByText('数据只存在这台设备上，不会同步。清除浏览器数据或卸载后无法恢复。')).toBeVisible();
  const send = page.getByRole('button', { name: '发送验证码' });
  const local = page.getByRole('button', { name: '先不登录，直接用' });
  const sendBox = await send.boundingBox();
  const localBox = await local.boundingBox();
  expect(sendBox && localBox && localBox.y).toBeGreaterThan(sendBox.y);

  await local.click();
  await expect(page.getByRole('alert', { name: '数据只存在这台设备上' })).toBeVisible();
  await waitForTodayLoaded(page);

  await recordButton(page).click();
  await page.getByRole('textbox', { name: '体重（kg）' }).fill('72.4');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText(/72\.4 kg/).first()).toBeVisible();

  await rowRecordButton(page, 'training').click();
  await page.getByRole('button', { name: '哑铃卧推', exact: true }).click();
  await page.getByRole('textbox', { name: '重量（kg）' }).fill('20');
  await page.getByRole('textbox', { name: '次数' }).fill('8');
  await page.getByRole('button', { name: '保存这一组' }).click();
  await closeRecordSheet(page).click();
  await expect(page.getByText('哑铃卧推').first()).toBeVisible();

  await rowRecordButton(page, 'study').click();
  await page.getByRole('textbox', { name: '主题' }).fill('分布式');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('分布式').first()).toBeVisible();
  expect(remote).toEqual([]);

  await page.getByRole('button', { name: '我的' }).click();
  await expect(page.getByText('未登录 · 数据仅存本机')).toBeVisible();
  await expect(page.getByRole('button', { name: '删除账号' })).toHaveCount(0);
  await page.getByRole('button', { name: '退出本地模式' }).click();
  await expect(page.getByRole('heading', { name: '退出本地模式？' })).toBeVisible();
  await expect(page.getByText('你的记录目前只存在这台设备上。')).toBeVisible();
  await page.getByRole('button', { name: '保留在本机' }).click();
  await expect(page.getByRole('heading', { name: brand.displayName })).toBeVisible();

  await page.getByRole('button', { name: '先不登录，直接用' }).click();
  await waitForTodayLoaded(page);
  await expect(page.getByText('72.4').first()).toBeVisible();
  await expect(page.getByText('分布式').first()).toBeVisible();

  await page.getByRole('button', { name: '我的' }).click();
  await page.getByRole('button', { name: '退出本地模式' }).click();
  await page.getByRole('button', { name: '清除本机数据' }).click();
  await expect(page.getByRole('heading', { name: '清除这台设备上的数据？' })).toBeVisible();
  await expect(page.getByText('需要的话，请先导出 JSON 备份。')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出备份' })).toBeVisible();
  await page.getByRole('button', { name: '清除', exact: true }).click();
  await expect
    .poll(async () => {
      const alert = page.getByRole('alert').first();
      if ((await alert.count()) === 0) return '';
      const name = (await alert.getAttribute('aria-label')) ?? '';
      if (name !== '本机数据已清除') await alert.click();
      return name;
    })
    .toBe('本机数据已清除');
  await expect(page.getByRole('button', { name: '先不登录，直接用' })).toBeVisible();

  await page.getByRole('button', { name: '先不登录，直接用' }).click();
  await waitForTodayLoaded(page);
  await expect(page.getByText('72.4')).toHaveCount(0);
  await expect(page.getByText('分布式')).toHaveCount(0);
  expect(remote).toEqual([]);
});
