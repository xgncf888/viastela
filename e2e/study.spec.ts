import { expect, test, type Page, type Route } from '@playwright/test';

import { installApi, signIn, weightRow } from './session';

const day = '2026-10-27';

test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 } });

function trackStudy() {
  const posts: string[] = [];
  const deletes: string[] = [];
  return {
    posts,
    deletes,
    onStudyWrite: async (route: Route) => {
      posts.push(route.request().postData() ?? '');
      await route.fulfill({
        status: 201,
        headers: {
          'access-control-allow-origin': '*',
          'content-type': 'application/json',
        },
        body: '[]',
      });
    },
    onStudyDelete: (body: string) => {
      deletes.push(body);
    },
  };
}

async function openPausedToday(page: Page, writes: ReturnType<typeof trackStudy>) {
  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, {
    weights: [weightRow('w-1', day, 73.4)],
    onStudyWrite: writes.onStudyWrite,
    onStudyDelete: writes.onStudyDelete,
  });
  await page.goto('/');
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await page.clock.pauseAt(`${day}T08:01:00.000Z`);
}

async function openStudyFromToday(page: Page) {
  await page.getByText('今天的学习', { exact: true }).locator('xpath=..').getByRole('button', { name: '记一笔' }).click();
  await expect(page.getByRole('textbox', { name: '主题' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '体重（kg）' })).toHaveCount(0);
}

test('记一笔 adds a study record and 撤销 within 5s sends no write', async ({ page }) => {
  const writes = trackStudy();
  await openPausedToday(page, writes);
  await openStudyFromToday(page);
  await page.getByRole('textbox', { name: '主题' }).fill('AI Infra');
  await page.getByRole('button', { name: '45', exact: true }).click();
  await page.getByRole('textbox', { name: '收获（选填）' }).fill('看完一篇笔记');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect.poll(() => writes.posts.length).toBe(1);
  const saved = JSON.parse(writes.posts[0] ?? '{}') as { topic?: string; duration_minutes?: number; note?: string };
  expect(saved.topic).toBe('AI Infra');
  expect(saved.duration_minutes).toBe(45);
  expect(saved.note).toBe('看完一篇笔记');
  await expect(page.getByRole('button', { name: 'AI Infra 45 分钟' })).toBeVisible();

  await page.getByRole('button', { name: 'AI Infra 45 分钟' }).click();
  const card = page
    .locator('div')
    .filter({ hasText: '45 分钟 · 看完一篇笔记' })
    .filter({ has: page.getByRole('button', { name: '删除' }) })
    .last();
  await card.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('45 分钟 · 看完一篇笔记')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('已删除 · 撤销');
  await page.clock.fastForward(4_999);
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText('45 分钟 · 看完一篇笔记')).toBeVisible();
  await page.clock.fastForward(5_000);
  expect(writes.deletes).toEqual([]);
});

test('no undo writes one deleted_at for the study record at 5s', async ({ page }) => {
  const writes = trackStudy();
  await openPausedToday(page, writes);
  await openStudyFromToday(page);
  await page.getByRole('textbox', { name: '主题' }).fill('英语');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  const created = JSON.parse(writes.posts[0] ?? '{}') as { id?: string; duration_minutes?: number };
  expect(created.duration_minutes).toBe(30);
  await page.getByRole('button', { name: '英语 30 分钟' }).click();
  const card = page
    .locator('div')
    .filter({ hasText: '30 分钟' })
    .filter({ has: page.getByRole('button', { name: '删除' }) })
    .last();
  await card.getByRole('button', { name: '删除' }).click();
  await page.clock.fastForward(4_999);
  expect(writes.deletes).toEqual([]);
  await page.clock.fastForward(1);
  await expect.poll(() => writes.deletes.length).toBe(1);
  expect(writes.deletes[0]).toContain(created.id ?? '');
  expect(writes.deletes[0]).toContain('deleted_at');
});

test('G1 logs weight, training, and study from today', async ({ page }) => {
  const started = Date.now();
  const trainingPosts: string[] = [];
  const studyPosts: string[] = [];
  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, {
    weights: [],
    onWrite: async (route) => {
      await route.fulfill({
        status: 201,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: '[]',
      });
    },
    onTrainingWrite: async (route) => {
      trainingPosts.push(route.request().postData() ?? '');
      await route.fulfill({
        status: 201,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: '[]',
      });
    },
    onStudyWrite: async (route) => {
      studyPosts.push(route.request().postData() ?? '');
      await route.fulfill({
        status: 201,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: '[]',
      });
    },
  });
  await page.goto('/');
  await expect(page.getByText('先记第一笔').first()).toBeVisible();
  await page.clock.pauseAt(`${day}T08:01:00.000Z`);

  await page.getByRole('button', { name: '记录', exact: true }).first().click();
  await page.getByRole('textbox', { name: '体重（kg）' }).fill('73.4');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: '训练' }).click();
  await page.getByRole('button', { name: '深蹲', exact: true }).click();
  await page.getByRole('textbox', { name: '重量（kg）' }).fill('60');
  await page.getByRole('textbox', { name: '次数' }).fill('8');
  await page.getByRole('button', { name: '保存这一组' }).click();
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByRole('button', { name: '深蹲 1 组' })).toBeVisible();

  await page.getByText('今天的学习', { exact: true }).locator('xpath=..').getByRole('button', { name: '记一笔' }).click();
  await page.getByRole('textbox', { name: '主题' }).fill('AI Infra');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: 'AI Infra 30 分钟' })).toBeVisible();
  await expect(page.getByText('今天都记完了')).toBeVisible();

  expect(trainingPosts).toHaveLength(1);
  expect(studyPosts).toHaveLength(1);
  expect(Date.now() - started).toBeLessThan(3 * 60 * 1000);
});
