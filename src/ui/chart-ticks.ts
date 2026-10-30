import {
  type ChartTick,
} from '@/core/chart-axis';

import { theme } from './theme';

export type { ChartTick } from '@/core/chart-axis';
export { formatChartTick, moneyAxis, niceAxis, tickValueDomain, weightAxis } from '@/core/chart-axis';

/**
 * Y-axis ticks and units from DESIGN.md §6.
 * The chart draws what the caller passes. These helpers build that input.
 * They are not theme tokens: §6 states the numbers directly.
 */

/** DESIGN.md §6. 28 days, a label every 7 days, and the last day. Five labels. */
const WEIGHT_WINDOW_DAYS = 28;
const WEIGHT_LABEL_STEP = 7;

export type ChartXTick = {
  /** 0 is the left edge, 1 is the right edge. */
  position: number;
  label: string;
};

export type ChartGridLine = {
  y: number;
  stroke: string;
};

export type ChartAxisLine = {
  stroke: string;
  top: number;
  bottom: number;
};

type AxisColors = {
  line: string;
  chartGrid: string;
  muted: string;
  chartAxis: string;
};

/** Vertical offset of a 0–1 axis position. 0 sits on the bottom padding. */
export function tickOffset(position: number, height: number = theme.layout.chart): number {
  const padY = theme.space.md;
  const inner = Math.max(height - padY * 2, 0);
  return height - padY - position * inner;
}

/**
 * Grid lines for the four chart renderers.
 * Without ticks this is the existing 25/50/75% grid in `line`.
 * With ticks the lines sit on the ticks, in `chartGrid`, and 0 is `muted`.
 */
export function chartDecorations(
  ticks: readonly Pick<ChartTick, 'position' | 'zero'>[] | undefined,
  color: AxisColors,
  height: number = theme.layout.chart,
): { lines: ChartGridLine[]; axis: ChartAxisLine | null } {
  const padY = theme.space.md;
  const hasTicks = (ticks?.length ?? 0) > 0;
  const positions = hasTicks ? (ticks ?? []) : [{ position: 0.25, zero: false }, { position: 0.5, zero: false }, { position: 0.75, zero: false }];
  return {
    lines: positions.map((tick) => ({
      y: tickOffset(tick.position, height),
      stroke: !hasTicks ? color.line : tick.zero ? color.muted : color.chartGrid,
    })),
    axis: hasTicks
      ? { stroke: color.chartAxis, top: padY, bottom: height - padY }
      : null,
  };
}

/** `10/01` … `10/28` across the 28-day window. Five labels. */
export function weightXLabels(year: number, month: number, day: number): ChartXTick[] {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error('Weight axis dates must be integers');
  }
  const last = WEIGHT_WINDOW_DAYS - 1;
  const indexes = [0, WEIGHT_LABEL_STEP, WEIGHT_LABEL_STEP * 2, WEIGHT_LABEL_STEP * 3, last];
  return indexes.map((index) => {
    const date = new Date(Date.UTC(year, month - 1, day + index));
    return {
      position: index / last,
      label: `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())}`,
    };
  });
}

/** Projection years. Four to six labels when the span has that many distinct years. */
export function yearXLabels(startYear: number, endYear: number): ChartXTick[] {
  if (!Number.isInteger(startYear) || !Number.isInteger(endYear)) throw new Error('Years must be integers');
  if (endYear < startYear) throw new Error('End year is before the start year');
  const span = endYear - startYear;
  if (span === 0) return [{ position: 0, label: String(startYear) }];
  for (const step of [1, 2, 5, 10, 20, 25, 50]) {
    if (span % step !== 0) continue;
    const count = span / step + 1;
    if (count < 4 || count > 6) continue;
    const labels: ChartXTick[] = [];
    for (let year = startYear; year <= endYear; year += step) {
      labels.push({ position: (year - startYear) / span, label: String(year) });
    }
    return labels;
  }
  if (span + 1 < 4) {
    return Array.from({ length: span + 1 }, (_, index) => ({
      position: index / span,
      label: String(startYear + index),
    }));
  }
  const count = Math.min(6, span + 1);
  const seen = new Set<number>();
  const labels: ChartXTick[] = [];
  for (let index = 0; index < count; index += 1) {
    const year = index === count - 1 ? endYear : startYear + Math.round((span * index) / (count - 1));
    if (seen.has(year)) continue;
    seen.add(year);
    labels.push({ position: (year - startYear) / span, label: String(year) });
  }
  return labels;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
