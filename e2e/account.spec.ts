import { expect, test, type Page } from '@playwright/test';

import { brand } from '../src/config/brand';

const userId = '11111111-1111-4111-8111-111111111111';

function unsignedJwt(payload: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.sig`;
}

async function signedIn(page: Page) {
  const session = {
    access_token: unsignedJwt({
      sub: userId,
      email: 'yifeng@example.com',
      role: 'authenticated',
      exp: 4_000_000_000,
    }),
    refresh_token: 'refresh-token',
    expires_at: 4_000_000_000,
    expires_in: 3_600,
    token_type: 'bearer',
    user: {
      id: userId,
      aud: 'authenticated',
      email: 'yifeng@example.com',
      app_metadata: { provider: 'email' },
      user_metadata: {},
      created_at: '2026-10-24T00:00:00.000Z',
    },
  };
  await page.addInitScript((stored) => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(stored));
  }, session);
}

async function columnMaxWidth(page: Page, heading: string): Promise<number | null> {
  return page.getByRole('heading', { name: heading }).evaluate((node) => {
    let current: HTMLElement | null = node.parentElement;
    while (current) {
      const max = getComputedStyle(current).maxWidth;
      if (max.endsWith('px')) {
        const value = Number.parseFloat(max);
        if (value > 0 && value < 2000) return value;
      }
      current = current.parentElement;
    }
    return null;
  });
}

test('privacy policy is a narrow document with the contact address', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/privacy');
  await expect(page.getByText('更新日期：2026年10月27日')).toBeVisible();
  await expect(page.getByRole('heading', { name: '隐私政策' })).toBeVisible();
  await expect(page.getByText('保存体重、训练组、学习记录', { exact: false })).toBeVisible();
  await expect(page.getByText('邮箱、显示名和头像', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('个人资料目前只有日切时间这一项设置。')).toBeVisible();
  await expect(page.getByText('我们不出售数据，不展示广告，也不把你的数据发给任何人工智能服务。')).toBeVisible();
  await expect(page.getByText('前提是每种登录方式给出的是同一个邮箱', { exact: false })).toBeVisible();
  await expect(page.getByText('邮箱验证码、Google 和 GitHub', { exact: false })).toBeVisible();
  await expect(page.getByText('xgncf888@gmail.com')).toBeVisible();
  await expect(page.getByText(brand.displayName, { exact: false }).first()).toBeVisible();

  const body = page.getByText('我们不出售数据，不展示广告，也不把你的数据发给任何人工智能服务。');
  const type = await body.evaluate((node) => {
    const style = getComputedStyle(node);
    return { fontSize: style.fontSize, lineHeight: style.lineHeight };
  });
  expect(type.lineHeight).toBe('24px');
  expect(await columnMaxWidth(page, '隐私政策')).toBe(680);
});

test('account deletion requires 删除, then shows the deleted page', async ({ page }) => {
  await signedIn(page);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/functions/v1/delete-account', async (route) => {
    await gate;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/auth/v1/logout**', (route) => route.fulfill({ status: 204, body: '' }));

  await page.goto('/');
  await page.getByRole('button', { name: '我的' }).click();
  await page.getByRole('button', { name: '删除账号' }).click();
  await expect(page.getByRole('heading', { name: '删除账号' })).toBeVisible();
  await expect(page.getByText('将删除你的体重记录。')).toBeVisible();
  await expect(page.getByText('将删除你的训练组。')).toBeVisible();
  await expect(page.getByText('将删除你的学习记录。')).toBeVisible();
  await expect(page.getByText('将删除你的个人资料，包括邮箱、显示名和头像。')).toBeVisible();
  await expect(page.getByText('删除后不能恢复。')).toBeVisible();
  await expect(page.getByText('xgncf888@gmail.com')).toBeVisible();

  const confirm = page.getByRole('textbox', { name: '确认' });
  const submit = page.getByRole('button', { name: '删除账号' });
  await expect(submit).toBeDisabled();
  await confirm.fill('删');
  await expect(submit).toBeDisabled();
  await confirm.fill('删除');
  await expect(submit).toBeEnabled();
  await submit.click();

  await expect(page.getByRole('heading', { name: '正在删除账号' })).toBeVisible();
  await expect(page.getByRole('progressbar', { name: '正在删除' })).toBeVisible();
  await expect(page.getByRole('button', { name: '取消' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '删除账号' })).toHaveCount(0);
  await page.goBack().catch(() => undefined);
  await expect(page.getByRole('heading', { name: '正在删除账号' })).toBeVisible();

  release();
  await expect(page.getByRole('heading', { name: '账号已删除' })).toBeVisible();
  await expect(page.getByText('你的记录已从星途中删除，数据库备份会在 30 天内清除')).toBeVisible();
  await page.getByRole('button', { name: '好的' }).click();
  await expect(page.getByRole('heading', { name: brand.displayName })).toBeVisible();
  await expect(page.getByText('用邮箱登录')).toBeVisible();
});

test('a failed account deletion returns to the explanation', async ({ page }) => {
  await signedIn(page);
  await page.route('**/functions/v1/delete-account', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'delete_failed' }) }),
  );

  await page.goto('/');
  await page.getByRole('button', { name: '我的' }).click();
  await page.getByRole('button', { name: '删除账号' }).click();
  await page.getByRole('textbox', { name: '确认' }).fill('删除');
  await page.getByRole('button', { name: '删除账号' }).click();
  await expect(page.getByRole('heading', { name: '删除账号' })).toBeVisible();
  await expect(page.getByText('删除失败，请重试')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '确认' })).toHaveValue('删除');
});
