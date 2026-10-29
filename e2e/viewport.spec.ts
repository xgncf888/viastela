import { expect, test, type Page } from '@playwright/test';

import { navItem, navLabels, recordButton, recordSheetHeading, rowRecordButton, waitForTodayLoaded } from './selectors';
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

/**
 * DESIGN §4.2: on 390x844 the main 记录 button is on the first screen as long as the ledger has
 * at most 5 rows. Longer ledgers may push it below the fold; scrolling to it is expected there.
 */
const LEDGER_FITS = 5;
const LEDGER_LONG = 7;

async function openToday(page: Page, width: number, height: number, ledgerRows: number = LEDGER_FITS) {
  await page.setViewportSize({ width, height });
  await page.clock.install({ time: new Date(`${day}T09:00:00.000Z`) });
  await signIn(page);
  await installApi(page, {
    weights: Array.from({ length: ledgerRows }, (_, i) => i + 1).map((n) => weightRow(`w-${n}`, day, 72 + n / 10, n)),
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

// 等 PR4：主按钮移到 7 天均重标题下，1 条和 7 条时都应在 390×844 首屏内。
// On current main the button sits after the three status cards, so it is below the fold from the
// first ledger row on (top y≈892 with 1 row, ≈1388 with 5). PR4 replaces this with 1-row and
// 7-row no-scroll assertions and removes the 7-row scroll case below.
test.fixme('at 390x844 with a 5-row ledger the main 记录 button is on the first screen without scrolling（等 PR4：主按钮移到 7 天均重标题下，1 条和 7 条时都应在 390×844 首屏内）', async ({
  page,
}) => {
  await openToday(page, 390, 844, LEDGER_FITS);
  await expect(page.getByText(/^72\.5 kg · /)).toHaveCount(1);
  await expect(recordButton(page)).toBeVisible();
  await expect(recordButton(page)).toBeInViewport();
});

test('at 390x844 the tab bar never covers the last row', async ({ page }) => {
  await openToday(page, 390, 844, LEDGER_FITS);

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

// Removed after PR4, when the main button is on the first screen at any ledger length.
test('at 390x844 with a 7-row ledger the main 记录 button sits below the ledger and is reachable by scrolling', async ({
  page,
}) => {
  await openToday(page, 390, 844, LEDGER_LONG);
  // The last ledger row (the 7th weigh-in, 72.7 kg) is rendered.
  const lastLedgerRow = page.getByText(/^72\.7 kg · /);
  await expect(lastLedgerRow).toHaveCount(1);
  const button = recordButton(page);
  await expect(button).toHaveCount(1);

  // Below the ledger. Both boxes come from the same scroll position, so their order is layout order.
  const rowBox = await lastLedgerRow.boundingBox();
  const buttonBox = await button.boundingBox();
  expect(rowBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  expect(buttonBox!.y).toBeGreaterThanOrEqual(rowBox!.y + rowBox!.height);

  // Scrolling is allowed here (§4.2); after it the button is on screen and opens the record sheet.
  await button.scrollIntoViewIfNeeded();
  await expect(button).toBeVisible();
  await expect(button).toBeInViewport();
  await button.click();
  await expect(recordSheetHeading(page)).toBeVisible();
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

// Style PR1 (#22) added aria-selected to NavItem on web. The selected state is asserted via
// aria-selected, never by colour.
for (const viewport of [
  { name: 'phone tab bar', width: 390, height: 844 },
  { name: 'desktop sidebar', width: 1280, height: 800 },
]) {
  test(`the selected ${viewport.name} item is marked with aria-selected`, async ({ page }) => {
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
