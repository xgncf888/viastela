import { expect, test, type Page, type Route } from '@playwright/test';

import { installApi, signIn, weightRow } from './session';

const day = '2026-10-27';

test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 } });

function trackTraining() {
  const posts: string[] = [];
  const deletes: string[] = [];
  let otherWrites = 0;
  return {
    posts,
    deletes,
    otherWrites: () => otherWrites,
    onTrainingWrite: async (route: Route) => {
      posts.push(route.request().postData() ?? '');
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
    onTrainingDelete: (body: string) => {
      deletes.push(body);
    },
  };
}

async function expectNoWrites(writes: ReturnType<typeof trackTraining>) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(writes.deletes).toEqual([]);
}

async function openPausedToday(page: Page, writes: ReturnType<typeof trackTraining>) {
  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, {
    weights: [weightRow('w-1', day, 73.7)],
    onTrainingWrite: writes.onTrainingWrite,
    onTrainingDelete: writes.onTrainingDelete,
  });
  await page.goto('/');
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await page.clock.pauseAt(`${day}T08:01:00.000Z`);
}

async function saveSet(page: Page, exercise: string, reps: string, load: { weight: string } | { band: string }) {
  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: '训练' }).click();
  await page.getByRole('textbox', { name: '动作' }).fill(exercise);
  await page.getByRole('textbox', { name: '次数' }).fill(reps);
  if ('weight' in load) {
    await page.getByRole('button', { name: '重量' }).click();
    await page.getByRole('textbox', { name: '重量（kg）' }).fill(load.weight);
  } else {
    await page.getByRole('button', { name: '弹力带' }).click();
    await page.getByRole('button', { name: load.band, exact: true }).click();
  }
  await page.getByRole('button', { name: '保存' }).click();
}

test('记一组 lists it today, and 撤销 within 5s sends no write', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes);
  await saveSet(page, '卧推', '8', { weight: '40' });
  await expect(page.getByText('卧推', { exact: true })).toBeVisible();
  await expect(page.getByText('8 次 · 40.0 kg')).toBeVisible();
  await expect(writes.posts).toHaveLength(1);

  const card = page
    .locator('div')
    .filter({ hasText: '8 次 · 40.0 kg' })
    .filter({ has: page.getByRole('button', { name: '删除' }) })
    .last();
  await card.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('8 次 · 40.0 kg')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('已删除 · 撤销');
  await page.clock.fastForward(4_999);
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText('8 次 · 40.0 kg')).toBeVisible();
  await page.clock.fastForward(5_000);
  await expectNoWrites(writes);
});

test('no undo writes one deleted_at for the training set at 5s', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes);
  await saveSet(page, '卧推', '8', { weight: '40' });
  const created = JSON.parse(writes.posts[0] ?? '{}') as { id?: string };
  expect(created.id).toBeTruthy();

  const card = page
    .locator('div')
    .filter({ hasText: '8 次 · 40.0 kg' })
    .filter({ has: page.getByRole('button', { name: '删除' }) })
    .last();
  await card.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('8 次 · 40.0 kg')).toHaveCount(0);
  await page.clock.fastForward(4_999);
  await expectNoWrites(writes);
  await page.clock.fastForward(1);
  await expect.poll(() => writes.deletes.length).toBe(1);
  expect(writes.deletes[0]).toContain(created.id ?? '');
  expect(writes.deletes[0]).toContain('deleted_at');
  await page.clock.fastForward(5_000);
  expect(writes.deletes).toHaveLength(1);
});

test('a band set is listed with its level', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes);
  await saveSet(page, '引体向上', '6', { band: '红' });
  await expect(page.getByText('引体向上', { exact: true })).toBeVisible();
  await expect(page.getByText('6 次 · 弹力带 红')).toBeVisible();
  expect(writes.posts[0]).toContain('红');
  expect(writes.posts[0]).not.toContain('"weight":40');
});

test('two normal toasts wait in order and both appear after the undo toast', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes);
  await page.getByRole('button', { name: '删除' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '已删除' })).toBeVisible();

  await page.getByRole('button', { name: '再记 73.7 kg' }).click();
  await page.getByRole('button', { name: '保存' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '已删除' })).toBeVisible();
  await expect(page.getByText('已记录', { exact: true })).toHaveCount(0);

  await saveSet(page, '卧推', '8', { weight: '40' });
  await expect(page.getByRole('alert').filter({ hasText: '已删除' })).toBeVisible();
  await expect(page.getByText('已记录', { exact: true })).toHaveCount(0);
  await expect(page.getByText('已记下 卧推')).toHaveCount(0);

  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '已记录' })).toBeVisible();
  await expect(page.getByText('已记下 卧推')).toHaveCount(0);

  await page.clock.fastForward(2_601);
  await expect(page.getByRole('alert').filter({ hasText: '已记下 卧推' })).toBeVisible();
  await expect(page.getByText('已记录', { exact: true })).toHaveCount(0);
  await expectNoWrites(writes);
});
