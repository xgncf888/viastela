import { projectionMoneyAxis, tickValueDomain, type ChartTick } from './chart-axis';
import { actualSeriesNote } from './quote-label';
import type { NetWorthProjection } from './projection';
import { annualRatePercent } from './projection-copy';

export type ChartTone = 'accent' | 'ink' | 'muted' | 'target';
export type ChartStyle = 'solid' | 'dashed' | 'dotted';

export type ProjectionChartPoint = { id: string; x: number; y: number };

export type ProjectionChartSeries = {
  id: string;
  label: string;
  style: ChartStyle;
  tone: ChartTone;
  /** Lower layers paint first. The legend follows array order, not this. */
  layer: number;
  markers: boolean;
  points: ProjectionChartPoint[];
};

export type ProjectionChart = {
  /** Legend order: actual, then the rates in the order given, then target. */
  series: ProjectionChartSeries[];
  /** Y ticks from `projectionMoneyAxis`. The screen passes these into the chart. */
  ticks: ChartTick[];
  /** Id of the selected rate series. Stroke weight is chosen from this, not from tone. */
  selectedSeriesId: string;
  note: string | null;
  accessibilityLabel: string;
};

const LAYER_TARGET = 0;
const LAYER_ALTERNATE = 1;
const LAYER_SELECTED = 2;
const LAYER_ACTUAL = 3;

/**
 * Positions are 0 to 1 inside the projection money axis, not the raw data min and max.
 * The chart does not know dollars. Color is `tone`. Weight and dash are not.
 * Actual is `ink` and solid. The selected rate is `accent` and solid.
 * The other two rates are `muted` dashes. The target is `target`, dotted.
 * Stroke widths live in the theme (`layout.stroke`, `strokeSelected`, `strokeMinor`, `border.width`).
 * Actual points are omitted until there are two of them.
 */
export function projectionChart(input: {
  lines: readonly [NetWorthProjection, NetWorthProjection, NetWorthProjection];
  rates: readonly [number, number, number];
  mainRateIndex: number;
  actual: readonly { month: string; totalUsd: number }[];
  /** Null omits the target line. There is no fallback goal. */
  targetUsd: number | null;
  snapshot: 'written' | 'skipped' | null;
}): ProjectionChart {
  const labels = input.rates.map((rate) => `${annualRatePercent(rate)}%`);
  const main = clampIndex(input.mainRateIndex);
  const actualMonths = input.actual
    .map((point) => ({ month: point.month.slice(0, 7), totalUsd: point.totalUsd }))
    .filter((point) => /^\d{4}-\d{2}$/.test(point.month));
  const values = [
    ...(input.targetUsd === null ? [] : [input.targetUsd]),
    ...input.lines.flatMap((line) => line.points.map((point) => point.netWorthUsd)),
    ...actualMonths.map((point) => point.totalUsd),
  ];
  const ticks = projectionMoneyAxis(values);
  const domain = moneyDomain(ticks, values);
  const domainSpan = domain.max - domain.min;
  const yOf = (value: number) => (domainSpan === 0 ? 0.5 : (value - domain.min) / domainSpan);
  const span = Math.max(input.lines[0].points.length - 1, 1);
  const series: ProjectionChartSeries[] = [];
  if (actualMonths.length >= 2) {
    const byMonth = new Map(input.lines[main]?.points.map((point, index) => [point.month, index]));
    const points: ProjectionChartPoint[] = [];
    for (const point of actualMonths) {
      const index = byMonth?.get(point.month);
      if (index === undefined) continue;
      points.push({ id: point.month, x: index / span, y: yOf(point.totalUsd) });
    }
    if (points.length >= 2) {
      series.push({
        id: 'actual',
        label: '实际',
        style: 'solid',
        tone: 'ink',
        layer: LAYER_ACTUAL,
        markers: true,
        points,
      });
    }
  }
  input.lines.forEach((line, index) => {
    series.push(lineSeries(line, labels[index] ?? '', index, span, yOf, index === main));
  });
  if (input.targetUsd !== null) {
    series.push({
      id: 'target',
      label: '目标',
      style: 'dotted',
      tone: 'target',
      layer: LAYER_TARGET,
      markers: false,
      points: [
        { id: 'target-start', x: 0, y: yOf(input.targetUsd) },
        { id: 'target-end', x: 1, y: yOf(input.targetUsd) },
      ],
    });
  }
  const shownActual = series.find((item) => item.id === 'actual')?.points.length ?? 0;
  return {
    series,
    ticks,
    selectedSeriesId: `rate-${main}`,
    note: actualSeriesNote({ snapshot: input.snapshot, actualPoints: shownActual }),
    accessibilityLabel:
      input.targetUsd === null ? `实际、${labels.join('、')}` : `实际、${labels.join('、')}、目标，预计达标月份`,
  };
}

/** Inclusive min and max of the ticks. A single finite value stays put. */
function moneyDomain(ticks: readonly ChartTick[], values: readonly number[]): { min: number; max: number } {
  const domain = tickValueDomain(ticks);
  if (domain) return domain;
  const only = values.find((value) => Number.isFinite(value)) ?? 0;
  return { min: only, max: only };
}

function clampIndex(mainRateIndex: number): number {
  if (mainRateIndex <= 1) return 0;
  if (mainRateIndex >= 3) return 2;
  return mainRateIndex - 1;
}

function lineSeries(
  line: NetWorthProjection,
  label: string,
  index: number,
  span: number,
  yOf: (value: number) => number,
  selected: boolean,
): ProjectionChartSeries {
  return {
    id: `rate-${index}`,
    label,
    style: selected ? 'solid' : 'dashed',
    tone: selected ? 'accent' : 'muted',
    layer: selected ? LAYER_SELECTED : LAYER_ALTERNATE,
    markers: false,
    points: line.points.map((point, pointIndex) => ({
      id: `${index}-${point.month}`,
      x: pointIndex / span,
      y: yOf(point.netWorthUsd),
    })),
  };
}
