import { expect, test, type Page, type Route } from '@playwright/test';

import { installApi, signIn, weightRow, type TrainingRow } from './session';

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

function trainingSeed(
  id: string,
  exercise: string,
  recordedAt: string,
  localDay: string,
  reps = 5,
  tz = 'UTC',
): TrainingRow {
  return {
    id,
    exercise,
    reps,
    weight_kg: 60,
    band_level: null,
    recorded_at: recordedAt,
    tz,
    local_day: localDay,
    updated_at: recordedAt,
  };
}

async function expectNoWrites(writes: ReturnType<typeof trackTraining>) {
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(writes.deletes).toEqual([]);
}

async function openPausedToday(
  page: Page,
  writes: ReturnType<typeof trackTraining>,
  training: TrainingRow[] = [],
  extra: { emptyTrainingDelete?: boolean } = {},
) {
  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, {
    weights: [weightRow('w-1', day, 73.7)],
    training,
    onTrainingWrite: writes.onTrainingWrite,
    onTrainingDelete: writes.onTrainingDelete,
    emptyTrainingDelete: extra.emptyTrainingDelete,
  });
  await page.goto('/');
  await expect(page.getByText('晨重', { exact: true })).toHaveCount(1);
  await page.clock.pauseAt(`${day}T08:01:00.000Z`);
}

async function saveSet(page: Page, exercise: string, reps: string, load: { weight: string } | { band: string }) {
  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: '训练' }).click();
  const exerciseField = page.getByRole('textbox', { name: '动作' });
  if (!(await exerciseField.isVisible())) {
    await page.getByRole('button', { name: '+ 其他' }).click();
  }
  await exerciseField.fill(exercise);
  if ('weight' in load) {
    await page.getByRole('button', { name: '重量' }).click();
    await page.getByRole('textbox', { name: '重量（kg）' }).fill(load.weight);
  } else {
    await page.getByRole('button', { name: '弹力带' }).click();
    await page.getByRole('button', { name: load.band, exact: true }).click();
  }
  await page.getByRole('textbox', { name: '次数' }).fill(reps);
  await page.getByRole('button', { name: '保存这一组' }).click();
}

async function openSetDetail(page: Page, summary: string) {
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByRole('button', { name: summary }).click();
}

test('记一组 lists it today, and 撤销 within 5s sends no write', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes);
  await saveSet(page, '卧推', '8', { weight: '40' });
  await expect(page.getByText('8 次 · 40 kg')).toBeVisible();
  await expect(writes.posts).toHaveLength(1);
  await openSetDetail(page, '卧推 1 组');

  const card = page
    .locator('div')
    .filter({ hasText: '8 次 · 40 kg' })
    .filter({ has: page.getByRole('button', { name: '删除' }) })
    .last();
  await card.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('8 次 · 40 kg')).toHaveCount(0);
  await expect(page.getByRole('alert')).toContainText('已删除 · 撤销');
  await page.clock.fastForward(4_999);
  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByText('8 次 · 40 kg')).toBeVisible();
  await page.clock.fastForward(5_000);
  await expectNoWrites(writes);
});

test('no undo writes one deleted_at for the training set at 5s', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes);
  await saveSet(page, '卧推', '8', { weight: '40' });
  const created = JSON.parse(writes.posts[0] ?? '{}') as { id?: string };
  expect(created.id).toBeTruthy();
  await openSetDetail(page, '卧推 1 组');

  const card = page
    .locator('div')
    .filter({ hasText: '8 次 · 40 kg' })
    .filter({ has: page.getByRole('button', { name: '删除' }) })
    .last();
  await card.getByRole('button', { name: '删除' }).click();
  await expect(page.getByText('8 次 · 40 kg')).toHaveCount(0);
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
  await saveSet(page, '引体向上', '6', { band: '轻' });
  await expect(page.getByText('6 次 · 弹力带 轻')).toBeVisible();
  await openSetDetail(page, '引体向上 1 组');
  await expect(page.getByText('6 次 · 弹力带 轻')).toBeVisible();
  expect(writes.posts[0]).toContain('light');
  expect(writes.posts[0]).not.toContain('"weight_kg":40');
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
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '已删除' })).toBeVisible();
  await expect(page.getByText('已记录', { exact: true })).toHaveCount(0);
  await expect(page.getByText('已记入 10月27日 · 卧推 1 组')).toHaveCount(0);

  await page.getByRole('button', { name: '撤销' }).click();
  await expect(page.getByRole('alert').filter({ hasText: '已记录' })).toBeVisible();
  await expect(page.getByText('已记入 10月27日 · 卧推 1 组')).toHaveCount(0);

  await page.clock.fastForward(2_601);
  await expect(page.getByRole('alert').filter({ hasText: '已记入 10月27日 · 卧推 1 组' })).toBeVisible();
  await expect(page.getByText('已记录', { exact: true })).toHaveCount(0);
  await expectNoWrites(writes);
});

test('saving two extra sets shows three rows for the same day', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes);
  await saveSet(page, '深蹲', '5', { weight: '100' });
  await expect(page.getByText('5 次 · 100 kg')).toHaveCount(1);
  await page.getByRole('button', { name: '+1 组' }).click();
  await page.getByRole('button', { name: '保存这一组' }).click();
  await expect(page.getByText('5 次 · 100 kg')).toHaveCount(2);
  await page.getByRole('button', { name: '+1 组' }).click();
  await page.getByRole('button', { name: '保存这一组' }).click();
  await expect(page.getByText('5 次 · 100 kg')).toHaveCount(3);
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByRole('button', { name: '深蹲 3 组' })).toBeVisible();

  expect(writes.posts).toHaveLength(3);
  const rows = writes.posts.map((body) => JSON.parse(body) as { id: string; local_day: string; exercise: string });
  expect(new Set(rows.map((row) => row.id)).size).toBe(3);
  expect(rows.every((row) => row.local_day === day && row.exercise === '深蹲')).toBe(true);
});

test('the most recently used exercise is the first chip', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes, [
    trainingSeed('old', '卧推', `${day}T06:00:00.000Z`, day),
    trainingSeed('newer', '深蹲', `${day}T07:30:00.000Z`, '2026-10-26'),
  ]);
  await expect(page.getByRole('button', { name: '卧推 1 组' })).toBeVisible();
  await expect(page.getByRole('button', { name: '深蹲 1 组' })).toHaveCount(0);

  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: '训练' }).click();
  const chips = page.getByRole('button').filter({ hasText: /^(深蹲|卧推)$/ });
  await expect(chips.nth(0)).toHaveText('深蹲');
  await expect(chips.nth(1)).toHaveText('卧推');
  await expect(page.getByRole('button', { name: '哑铃卧推' })).toHaveCount(0);
});

test('with no training history the form offers the six home exercises', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes);
  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: '训练' }).click();
  for (const name of ['哑铃卧推', '单臂划船', '肩推', '深蹲', '弹力带面拉', '俯卧撑']) {
    await expect(page.getByRole('button', { name })).toBeVisible();
  }
  await expect(page.getByRole('textbox', { name: '动作' })).toHaveCount(0);
});

test('完成 asks before leaving an edited set, and an unchanged +1 组 closes', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes);

  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: '训练' }).click();
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByRole('button', { name: '保存这一组并完成' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '记录' })).toBeHidden();
  expect(writes.posts).toHaveLength(0);

  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: '训练' }).click();
  await page.getByRole('button', { name: '哑铃卧推' }).click();
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByRole('button', { name: '保存这一组并完成' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '记录' })).toBeHidden();
  expect(writes.posts).toHaveLength(0);

  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: '训练' }).click();
  await page.getByRole('button', { name: '哑铃卧推' }).click();
  await page.getByRole('textbox', { name: '重量（kg）' }).fill('20');
  await page.getByRole('textbox', { name: '次数' }).fill('10');
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByRole('button', { name: '保存这一组并完成' })).toBeVisible();
  await expect(page.getByRole('button', { name: '不保存，直接完成' })).toBeVisible();
  await page.getByRole('button', { name: '不保存，直接完成' }).click();
  await expect(page.getByRole('heading', { name: '记录' })).toBeHidden();
  expect(writes.posts).toHaveLength(0);

  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: '训练' }).click();
  await page.getByRole('button', { name: '哑铃卧推' }).click();
  await page.getByRole('textbox', { name: '重量（kg）' }).fill('20');
  await page.getByRole('textbox', { name: '次数' }).fill('10');
  await page.getByRole('button', { name: '完成' }).click();
  await page.getByRole('button', { name: '保存这一组并完成' }).click();
  await expect.poll(() => writes.posts.length).toBe(1);
  await expect(page.getByRole('heading', { name: '记录' })).toBeHidden();
  await expect(page.getByRole('button', { name: '哑铃卧推 1 组' })).toBeVisible();
});

test('an unchanged +1 组 prefill closes without another row', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes, [trainingSeed('seed', '深蹲', `${day}T07:00:00.000Z`, day)]);
  await page.getByRole('button', { name: '记录', exact: true }).click();
  await page.getByRole('button', { name: '训练' }).click();
  await page.getByRole('button', { name: '深蹲', exact: true }).click();
  await page.getByRole('button', { name: '+1 组' }).click();
  await page.getByRole('button', { name: '完成' }).click();
  await expect(page.getByRole('button', { name: '保存这一组并完成' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '记录' })).toBeHidden();
  expect(writes.posts).toHaveLength(0);
});

test.describe('Singapore accounting day', () => {
  test.use({ timezoneId: 'Asia/Singapore', viewport: { width: 390, height: 844 } });

  test('a record at 01:30 local counts for the previous day', async ({ page }) => {
    const writes = trackTraining();
    await page.clock.install({ time: new Date('2026-10-26T17:29:00.000Z') });
    await signIn(page);
    await installApi(page, {
      weights: [weightRow('w-1', '2026-10-26', 70, 1)],
      training: [
        trainingSeed('prev', '深蹲', '2026-10-26T17:30:00.000Z', '2026-10-26', 5, 'Asia/Singapore'),
        trainingSeed('calendar', '卧推', '2026-10-26T17:30:00.000Z', '2026-10-27', 5, 'Asia/Singapore'),
      ],
      onTrainingWrite: writes.onTrainingWrite,
      onTrainingDelete: writes.onTrainingDelete,
    });
    await page.goto('/');
    await expect(page.getByText('10月26日的训练')).toBeVisible();
    await page.clock.pauseAt('2026-10-26T17:30:00.000Z');
    await expect(page.getByRole('button', { name: '深蹲 1 组' })).toBeVisible();
    await expect(page.getByRole('button', { name: '卧推 1 组' })).toHaveCount(0);

    await saveSet(page, '硬拉', '3', { weight: '80' });
    await expect.poll(() => writes.posts.length).toBe(1);
    const saved = JSON.parse(writes.posts[0] ?? '{}') as { local_day?: string; tz?: string; recorded_at?: string };
    expect(saved.local_day).toBe('2026-10-26');
    expect(saved.tz).toBe('Asia/Singapore');
    expect(saved.recorded_at?.startsWith('2026-10-26T17:30')).toBe(true);
  });
});

test('a soft delete that matches no row says delete failed', async ({ page }) => {
  const writes = trackTraining();
  await openPausedToday(page, writes, [], { emptyTrainingDelete: true });
  await saveSet(page, '卧推', '8', { weight: '40' });
  await openSetDetail(page, '卧推 1 组');
  const card = page
    .locator('div')
    .filter({ hasText: '8 次 · 40 kg' })
    .filter({ has: page.getByRole('button', { name: '删除' }) })
    .last();
  await card.getByRole('button', { name: '删除' }).click();
  await page.clock.fastForward(5_000);
  await expect(page.getByText('删除失败，请重试')).toBeVisible();
  await expect(page.getByText('8 次 · 40 kg')).toBeVisible();
  expect(writes.deletes).toHaveLength(1);
});
