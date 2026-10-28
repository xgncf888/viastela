import { expect, test, type Page } from '@playwright/test';

import { navItem, navLabels, recordButton, rowRecordButton, waitForTodayLoaded } from './selectors';
import { installApi, signIn, weightRow, type TrainingRow } from './session';

// Shell layout at the phone and desktop widths. Every weight here is made up.

const day = '2026-10-27';

test.use({ timezoneId: 'UTC' });

function trainingRow(id: string, exercise: string, hour: number): TrainingRow {
  const recordedAt = `${day}T${String(hour).padStart(2, '0')}:00:00.000Z`;
  return {
    id,
    exercise,
    reps: 8,
    weight_kg: 20,
    band_level: null,
    recorded_at: recordedAt,
    tz: 'UTC',
    local_day: day,
    updated_at: recordedAt,
  };
}

async function openToday(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.clock.install({ time: new Date(`${day}T09:00:00.000Z`) });
  await signIn(page);
  // Enough rows that Today scrolls on a phone, so the last row can end up under the tab bar.
  await installApi(page, {
    weights: [1, 2, 3, 4, 5, 6].map((n) => weightRow(`w-${n}`, day, 72 + n / 10, n)),
    training: [trainingRow('t-1', '深蹲', 7)],
  });
  await page.goto('/');
  await waitForTodayLoaded(page);
  await expect(page.getByText('晨重', { exact: true })).toBeVisible();
}

/** The bottom bar is the grandparent of a tab item (TabBar > tabs > NavItem). */
function bottomBar(page: Page) {
  return navItem(page, '今日').locator('xpath=../..');
}

test('at 390x844 the main 记录 button shows and the tab bar never covers the last row', async ({ page }) => {
  await openToday(page, 390, 844);
  await expect(recordButton(page)).toBeVisible();
  await expect(recordButton(page)).toBeInViewport();

  const bar = bottomBar(page);
  await expect(bar).toBeVisible();
  const barBox = await bar.boundingBox();
  expect(barBox).not.toBeNull();
  // The bar sits at the bottom edge of the phone viewport.
  expect(barBox!.y + barBox!.height).toBeGreaterThanOrEqual(844 - 1);

  // Scroll Today to its end; the last row (the study card's record button) must sit above the bar.
  const lastRow = rowRecordButton(page, 'study');
  await expect(lastRow).toBeVisible();
  await page.mouse.move(195, 300);
  await page.mouse.wheel(0, 10_000);
  await expect
    .poll(async () => {
      const box = await lastRow.boundingBox();
      return box ? Math.round(box.y + box.height) : Number.POSITIVE_INFINITY;
    })
    .toBeLessThanOrEqual(Math.round(barBox!.y));
  await expect(lastRow).toBeInViewport();
});

test('at 1280 the nav is a left sidebar and there is no bottom bar', async ({ page }) => {
  await openToday(page, 1280, 800);
  await expect(recordButton(page)).toBeVisible();
  for (const label of navLabels) {
    // One nav item per label: the sidebar only, no second copy in a bottom bar.
    await expect(navItem(page, label)).toHaveCount(1);
    const box = await navItem(page, label).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(300);
    expect(box!.y).toBeLessThan(800 / 2);
  }
  const first = await navItem(page, '今日').boundingBox();
  const last = await navItem(page, '我的').boundingBox();
  // Stacked vertically like a sidebar, not laid out in a row like a tab bar.
  expect(Math.abs(first!.x - last!.x)).toBeLessThanOrEqual(2);
  expect(last!.y).toBeGreaterThan(first!.y);
});

// Enable when style PR1 (#22) merges: it adds aria-selected to NavItem on web. Current main only
// sets accessibilityState.selected, which react-native-web does not expose on role=button, and the
// selected tab is shown by colour only. The selected state must be asserted via aria-selected, not colour.
for (const viewport of [
  { name: 'phone tab bar', width: 390, height: 844 },
  { name: 'desktop sidebar', width: 1280, height: 800 },
]) {
  test.fixme(`the selected ${viewport.name} item is marked with aria-selected`, async ({ page }) => {
    await openToday(page, viewport.width, viewport.height);
    await expect(navItem(page, '今日')).toHaveAttribute('aria-selected', 'true');
    for (const label of navLabels.filter((item) => item !== '今日')) {
      await expect(navItem(page, label)).toHaveAttribute('aria-selected', 'false');
    }
    await navItem(page, '趋势').click();
    await expect(navItem(page, '趋势')).toHaveAttribute('aria-selected', 'true');
    await expect(navItem(page, '今日')).toHaveAttribute('aria-selected', 'false');
  });
}
