import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

import { accountingDay, installApi, signIn, weightRow, type TrainingRow } from './session';
import { recordButton, recordSheetHeading, waitForTodayLoaded } from './selectors';

/**
 * Same method before and after the lag fixes.
 * LAG_ASSERT=0 records the current build without the after-fix expectations.
 * LAG_SHOTS=1 writes pressed-state screenshots to LAG_SHOT_DIR (not the repo).
 */

const WRITE_DELAY_MS = 800;
const day = '2026-10-29';

test.use({ timezoneId: 'UTC', viewport: { width: 390, height: 844 }, colorScheme: 'light' });

type PressSample = {
  target: string;
  feedbackMs: number | null;
  releaseMs: number | null;
  before: string;
  pressed: string;
};

type SaveSample = {
  msUntilSheetClosedAndValueVisible: number;
  requestsStarted: { method: string; url: string }[];
  responsesCompleted: { method: string; url: string }[];
};

type TabSample = {
  screen: string;
  mountCountAfterAwayAndBack: number;
  fetchesOnReturn: number;
  skeletonVisibleOnReturn: boolean;
  probeSurvived: boolean;
};

function trainingRow(): TrainingRow {
  const recordedAt = `${day}T08:15:00.000Z`;
  return {
    id: 'set-1',
    exercise: '深蹲',
    reps: 8,
    weight_kg: 40,
    band_level: null,
    recorded_at: recordedAt,
    tz: 'UTC',
    local_day: day,
    updated_at: recordedAt,
  };
}

async function timePress(page: Page, locator: Locator, target: string): Promise<PressSample> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`no box for ${target}`);
  const x = box.x + box.width / 2;
  const y = box.y + Math.min(box.height / 2, 18);
  const handle = await locator.elementHandle();
  if (!handle) throw new Error(`no handle for ${target}`);
  await handle.evaluate((el) => {
    const read = () => {
      const style = getComputedStyle(el);
      return `bg=${style.backgroundColor} opacity=${style.opacity} transform=${style.transform} selected=${el.getAttribute('aria-selected') ?? ''}`;
    };
    const state = {
      start: 0,
      hit: null as number | null,
      before: read(),
      pressed: read(),
      releaseStart: 0,
      releaseHit: null as number | null,
      resting: read(),
    };
    (window as unknown as { __lagPress?: typeof state }).__lagPress = state;
    const onDown = () => {
      state.before = read();
      state.start = performance.now();
      const loop = () => {
        const now = read();
        const elapsed = performance.now() - state.start;
        const visible =
          now.includes('opacity=0.86') ||
          now.includes('rgba(38, 36, 31, 0.06)') ||
          now.includes('rgb(241, 239, 232)');
        if (state.hit == null && visible && now !== state.before) state.hit = elapsed;
        state.pressed = now;
        if (elapsed < 90) requestAnimationFrame(loop);
        else if (state.hit == null) state.hit = null;
      };
      requestAnimationFrame(loop);
    };
    el.addEventListener('mousedown', onDown, { capture: true });
    (window as unknown as { __lagPressOff?: () => void }).__lagPressOff = () =>
      el.removeEventListener('mousedown', onDown, { capture: true });
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForFunction(
    () => {
      const state = (window as unknown as { __lagPress?: { hit: number | null; start: number } }).__lagPress;
      return !state || (state.start > 0 && performance.now() - state.start > 120);
    },
    null,
    { timeout: 2000 },
  );
  if (process.env.LAG_SHOTS === '1') {
    const dir = process.env.LAG_SHOT_DIR ?? '/tmp/press-shots';
    mkdirSync(dir, { recursive: true });
    const clip = {
      x: Math.max(0, box.x - 8),
      y: Math.max(0, box.y - 8),
      width: Math.min(box.width + 16, 390),
      height: box.height + 16,
    };
    await page.screenshot({ path: `${dir}/${target}.png`, clip });
  }
  await handle.evaluate((el) => {
    const read = () => {
      const style = getComputedStyle(el);
      return `bg=${style.backgroundColor} opacity=${style.opacity} transform=${style.transform} selected=${el.getAttribute('aria-selected') ?? ''}`;
    };
    const state = (window as unknown as { __lagPress: { pressed: string; releaseStart: number; releaseHit: number | null; resting: string } }).__lagPress;
    const pressedLook = read();
    state.pressed = pressedLook;
    state.releaseStart = performance.now();
    const loop = () => {
      const now = read();
      if (now !== pressedLook) {
        state.releaseHit = performance.now() - state.releaseStart;
        state.resting = now;
        return;
      }
      if (performance.now() - state.releaseStart > 500) {
        state.resting = now;
        return;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  // Release outside the control so the press feedback ends without firing onPress.
  await page.mouse.move(2, 2);
  await page.mouse.up();
  await page.waitForFunction(
    () => {
      const state = (window as unknown as { __lagPress?: { releaseHit: number | null; releaseStart: number } }).__lagPress;
      return !state || state.releaseHit != null || (state.releaseStart > 0 && performance.now() - state.releaseStart > 500);
    },
    null,
    { timeout: 2000 },
  );
  const sample = await page.evaluate(() => {
    const state = (window as unknown as { __lagPress: PressSample & { hit: number | null; releaseHit: number | null; before: string; pressed: string } }).__lagPress;
    (window as unknown as { __lagPressOff?: () => void }).__lagPressOff?.();
    return state;
  });
  return {
    target,
    feedbackMs: sample.hit,
    releaseMs: sample.releaseHit,
    before: sample.before,
    pressed: sample.pressed,
  };
}

async function stamp(locator: Locator): Promise<string> {
  const token = `probe-${Math.random().toString(36).slice(2)}`;
  await locator.evaluate((el, value) => {
    el.setAttribute('data-mount-probe', value);
  }, token);
  return token;
}

async function probeAlive(page: Page, token: string): Promise<boolean> {
  return page.evaluate((value) => document.querySelector(`[data-mount-probe="${value}"]`) != null, token);
}

test('press, save, and tab switch timings', async ({ page }) => {
  test.setTimeout(90_000);
  const presses: PressSample[] = [];
  const weightTraffic: { method: string; url: string; kind: 'request' | 'response' }[] = [];
  let recordWeightTraffic = false;
  page.on('request', (request) => {
    if (!recordWeightTraffic) return;
    if (!request.url().includes('/rest/v1/weight_records')) return;
    weightTraffic.push({ method: request.method(), url: request.url(), kind: 'request' });
  });
  page.on('response', (response) => {
    if (!recordWeightTraffic) return;
    if (!response.url().includes('/rest/v1/weight_records')) return;
    weightTraffic.push({ method: response.request().method(), url: response.url(), kind: 'response' });
  });

  const timelineRequests: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (url.includes('/rest/v1/timeline') || url.includes('/rest/v1/asset_accounts') || url.includes('/rest/v1/profiles')) {
      timelineRequests.push(`${request.method()} ${url.split('?')[0]}`);
    }
  });

  await page.clock.install({ time: new Date(`${day}T08:00:00.000Z`) });
  await signIn(page);
  await installApi(page, {
    weights: [weightRow('w-1', day, 73.7)],
    training: [trainingRow()],
    onWrite: async (route) => {
      await new Promise((resolve) => setTimeout(resolve, WRITE_DELAY_MS));
      await route.fulfill({
        status: 201,
        headers: { 'access-control-allow-origin': '*', 'content-type': 'application/json' },
        body: '[]',
      });
    },
  });
  let delayTimeline = false;
  await page.route('**/rest/v1/timeline**', async (route) => {
    if (delayTimeline) await new Promise((resolve) => setTimeout(resolve, 1100));
    await route.fallback();
  });
  await page.route('**/rest/v1/asset_accounts**', async (route) => {
    if (delayTimeline) await new Promise((resolve) => setTimeout(resolve, 1100));
    await route.fallback();
  });
  await page.goto('/');
  await waitForTodayLoaded(page);

  const todayHeading = page.getByRole('heading').first();
  const todayProbe = await stamp(todayHeading);
  await page.getByRole('button', { name: '时间线', exact: true }).click();
  await expect(page.getByRole('heading', { name: '时间线' })).toBeVisible();
  const timelineHeading = page.getByRole('heading', { name: '时间线' });
  const timelineProbe = await stamp(timelineHeading);
  delayTimeline = true;
  const fetchesBeforeReturn = timelineRequests.length;
  await page.getByRole('button', { name: '今日', exact: true }).click();
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
  const todayAliveAfterReturn = await probeAlive(page, todayProbe);
  await page.getByRole('button', { name: '时间线', exact: true }).click();
  await expect(page.getByRole('heading', { name: '时间线' })).toBeVisible();
  const timelineAlive = await probeAlive(page, timelineProbe);
  const fetchesOnReturn = timelineRequests.length - fetchesBeforeReturn;
  let skeleton = false;
  const skeletonDeadline = Date.now() + 1500;
  while (Date.now() < skeletonDeadline) {
    skeleton = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-busy="true"]')].some((node) => {
        const box = (node as HTMLElement).getBoundingClientRect();
        return box.width > 0 && box.height > 0;
      }),
    );
    if (skeleton) break;
    await page.waitForTimeout(50);
  }

  await page.getByRole('button', { name: '今日', exact: true }).click();
  await waitForTodayLoaded(page);

  presses.push(await timePress(page, recordButton(page), 'primary'));
  presses.push(await timePress(page, page.getByRole('button', { name: '深蹲 1 组' }), 'status-card'));
  presses.push(await timePress(page, page.getByRole('button', { name: '今日', exact: true }), 'tab'));
  await recordButton(page).click();
  await expect(recordSheetHeading(page)).toBeVisible();
  presses.push(await timePress(page, page.getByRole('button', { name: /填入上次/ }), 'secondary'));
  presses.push(await timePress(page, page.getByRole('button', { name: '关闭', exact: true }), 'ghost'));
  if (await recordSheetHeading(page).isVisible()) {
    await page.getByRole('button', { name: '关闭', exact: true }).click();
  }
  await expect(recordSheetHeading(page)).toBeHidden();

  recordWeightTraffic = true;
  await page.getByRole('button', { name: '再记 73.7 kg' }).click();
  await page.getByRole('textbox', { name: '体重（kg）' }).fill('76.4');
  const saveStarted = await page.evaluate(() => performance.now());
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await expect(recordSheetHeading(page)).toBeHidden();
  await expect(page.getByText('76.4 kg', { exact: true })).toBeVisible();
  const saveMs = await page.evaluate((started) => performance.now() - started, saveStarted);
  recordWeightTraffic = false;

  const save: SaveSample = {
    msUntilSheetClosedAndValueVisible: Math.round(saveMs),
    requestsStarted: weightTraffic.filter((item) => item.kind === 'request').map(({ method, url }) => ({ method, url })),
    responsesCompleted: weightTraffic.filter((item) => item.kind === 'response').map(({ method, url }) => ({ method, url })),
  };
  const tabs: TabSample[] = [
    {
      screen: 'TodayScreen',
      mountCountAfterAwayAndBack: todayAliveAfterReturn ? 1 : 2,
      fetchesOnReturn: 0,
      skeletonVisibleOnReturn: false,
      probeSurvived: todayAliveAfterReturn,
    },
    {
      screen: 'TimelineScreen',
      mountCountAfterAwayAndBack: timelineAlive ? 1 : 2,
      fetchesOnReturn,
      skeletonVisibleOnReturn: skeleton,
      probeSurvived: timelineAlive,
    },
  ];

  const report = {
    accountingDay: accountingDay(new Date(`${day}T08:01:00.000Z`)),
    writeDelayMs: WRITE_DELAY_MS,
    presses,
    save,
    tabs,
  };
  const out = process.env.LAG_REPORT ?? '/tmp/lag-report.json';
  writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (process.env.LAG_ASSERT === '0') return;

  const byTarget = Object.fromEntries(presses.map((press) => [press.target, press]));
  expect(byTarget.primary?.feedbackMs ?? 999).toBeLessThan(120);
  expect(byTarget.primary?.pressed).toContain('opacity=0.86');
  expect(byTarget.primary?.pressed).toContain('matrix(0.98');
  const release = await recordButton(page).evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(release).toMatch(/0\.1s|100ms/);
  for (const name of ['status-card', 'tab']) {
    expect(byTarget[name]?.feedbackMs ?? 999, name).toBeLessThan(120);
    expect(byTarget[name]?.pressed, name).toContain('rgba(38, 36, 31, 0.06)');
  }
  for (const name of ['secondary', 'ghost']) {
    expect(byTarget[name]?.pressed, name).toMatch(/rgba?\(241, 239, 232/);
    expect(byTarget[name]?.pressed, name).not.toContain('matrix(1, 0, 0, 1, 0, 1)');
  }
  expect(save.responsesCompleted.filter((item) => item.method === 'GET')).toEqual([]);
  expect(save.msUntilSheetClosedAndValueVisible).toBeLessThan(WRITE_DELAY_MS);
  for (const tab of tabs) {
    expect(tab.mountCountAfterAwayAndBack, tab.screen).toBe(1);
    expect(tab.probeSurvived, tab.screen).toBe(true);
  }
  expect(tabs[1].fetchesOnReturn).toBe(0);
  expect(tabs[1].skeletonVisibleOnReturn).toBe(false);
});
