import { expect, type Locator, type Page } from '@playwright/test';

import { LOADING_TEXT } from '../src/features/weight/weight-copy';

/**
 * Selectors named after DESIGN §4.2 (arrives with style PR1 #22 / PR3).
 *
 * Current main already uses the §4.2 name for the main button (「记录」) and the sheet title
 * opened from it (「记录」). The per-row buttons are still 「记一笔」 on main, so those locators
 * accept either the §4.2 name or the legacy 「记一笔」 scoped to its Today section. Drop the
 * legacy branch once PR3 lands.
 */

export type RecordKind = 'weight' | 'training' | 'study';

const rowDesignName: Record<RecordKind, string> = {
  weight: '记录体重',
  training: '记录训练',
  study: '记录学习',
};

/** Today section headings on main (before the day switch). */
const rowLegacySection: Record<RecordKind, RegExp> = {
  weight: /^体重$/,
  training: /^(今天|\d+月\d+日)的训练$/,
  study: /^(今天|\d+月\d+日)的学习$/,
};

/** The single primary 「记录」 button (§4.2). Exact, so it never matches 「记录体重」 etc. */
export function recordButton(page: Page): Locator {
  return page.getByRole('button', { name: '记录', exact: true }).first();
}

/** Row-level record button: 「记录体重/训练/学习」 per §4.2, or legacy 「记一笔」 in that section. */
export function rowRecordButton(page: Page, kind: RecordKind): Locator {
  const design = page.getByRole('button', { name: rowDesignName[kind], exact: true });
  const legacy = page
    .getByText(rowLegacySection[kind])
    .locator('xpath=..')
    .getByRole('button', { name: '记一笔', exact: true });
  return design.or(legacy).first();
}

/**
 * Record sheet title. From the main button it is 「记录」; from a row button §4.2 makes it
 * 「记录体重/训练/学习」, while main still shows 「记录」 for every entry point.
 */
export function recordSheetHeading(page: Page, kind?: RecordKind): Locator {
  const name = kind ? new RegExp(`^(记录|${rowDesignName[kind]})$`) : /^记录(体重|训练|学习)?$/;
  return page.getByRole('heading', { name });
}

/** Record-type chip inside the sheet. Exact, so 「训练」 never matches a 「记录训练」 row button. */
export function typeChip(page: Page, label: '体重' | '训练' | '学习' | '时间块'): Locator {
  return page.getByRole('button', { name: label, exact: true });
}

/** Today has finished its first load: the record heading is shown and no section says 读取中. */
export async function waitForTodayLoaded(page: Page): Promise<void> {
  await expect(page.getByText(/^(今天|\d+月\d+日)的记录$/)).toBeVisible();
  await expect(page.getByText(LOADING_TEXT, { exact: true })).toHaveCount(0);
}

/** Bottom tab bar / sidebar nav items. */
export const navLabels = ['今日', '资产', '趋势', '我的'] as const;

export function navItem(page: Page, label: (typeof navLabels)[number]): Locator {
  return page.getByRole('button', { name: label, exact: true });
}
