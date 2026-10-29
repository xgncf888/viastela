import { expect, test, type Route } from '@playwright/test';

import { recordSheetHeading, rowRecordButton, typeChip, waitForTodayLoaded } from './selectors';
import { installApi, signIn } from './session';

// G1: from Today, log weight, one training set, and one study record in under three minutes.
// The data layer is the mocked Supabase from session.ts; every number here is made up.

const day = '2026-10-27';
const G1_BUDGET_MS = 180_000;

test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 } });

function created(posts: string[]) {
  return async (route: Route) => {
    posts.push(route.request().postData() ?? '');
    await route.fulfill({
      status: 201,
      headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
      body: '[]',
    });
  };
}

test('G1 logs weight, a training set, and a study record from Today within 180s', async ({ page }) => {
  // Give the run more room than the budget so the wall-time assertion, not the runner, is the gate.
  test.setTimeout(G1_BUDGET_MS + 30_000);
  const weightPosts: string[] = [];
  const trainingPosts: string[] = [];
  const studyPosts: string[] = [];

  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, {
    weights: [],
    onWrite: created(weightPosts),
    onTrainingWrite: created(trainingPosts),
    onStudyWrite: created(studyPosts),
  });
  await page.goto('/');
  await waitForTodayLoaded(page);
  await expect(page.getByText('先记第一笔').first()).toBeVisible();
  await page.clock.pauseAt(`${day}T08:01:00.000Z`);

  const started = Date.now();

  // Weight
  await rowRecordButton(page, 'weight').click();
  await expect(recordSheetHeading(page, 'weight')).toBeVisible();
  await page.getByRole('textbox', { name: '体重（kg）' }).fill('72.4');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  await expect(page.getByText('72.4 kg · 8:01')).toBeVisible();
  await expect.poll(() => weightPosts.length).toBe(1);

  // Training set
  await rowRecordButton(page, 'training').click();
  await expect(recordSheetHeading(page, 'training')).toBeVisible();
  await expect(typeChip(page, '训练')).toBeVisible();
  await page.getByRole('button', { name: '深蹲', exact: true }).click();
  await page.getByRole('textbox', { name: '重量（kg）' }).fill('40');
  await page.getByRole('textbox', { name: '次数' }).fill('8');
  await page.getByRole('button', { name: '保存这一组' }).click();
  await expect(page.getByText('8 次 · 40 kg')).toBeVisible();
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByRole('button', { name: '深蹲 1 组' })).toBeVisible();
  await expect.poll(() => trainingPosts.length).toBe(1);

  // Study record
  await rowRecordButton(page, 'study').click();
  await expect(recordSheetHeading(page, 'study')).toBeVisible();
  await page.getByRole('textbox', { name: '主题' }).fill('英语');
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(page.getByRole('button', { name: '英语 30 分钟' })).toBeVisible();
  await expect.poll(() => studyPosts.length).toBe(1);

  await expect(page.getByText('今天都记完了')).toBeVisible();
  const elapsed = Date.now() - started;
  test.info().annotations.push({ type: 'g1-wall-ms', description: String(elapsed) });
  expect(elapsed).toBeLessThan(G1_BUDGET_MS);

  const weight = JSON.parse(weightPosts[0] ?? '{}') as { weight_kg?: number };
  const set = JSON.parse(trainingPosts[0] ?? '{}') as { exercise?: string; reps?: number; weight_kg?: number };
  const study = JSON.parse(studyPosts[0] ?? '{}') as { topic?: string; duration_minutes?: number };
  expect(weight.weight_kg).toBe(72.4);
  expect(set).toMatchObject({ exercise: '深蹲', reps: 8, weight_kg: 40 });
  expect(study).toMatchObject({ topic: '英语', duration_minutes: 30 });
});
