import { moneyAxisDomain } from './money-axis';
import { actualSeriesNote } from './quote-label';
import type { NetWorthProjection } from './projection';
import { annualRatePercent } from './projection-copy';

export type ChartTone = 'accent' | 'moss' | 'muted' | 'target';
export type ChartStyle = 'solid' | 'dashed' | 'dotted';

export type ProjectionChartPoint = { id: string; x: number; y: number };

export type ProjectionChartSeries = {
  id: string;
  label: string;
  style: ChartStyle;
  tone: ChartTone;
  markers: boolean;
  thin: boolean;
  points: ProjectionChartPoint[];
};

export type ProjectionChart = {
  series: ProjectionChartSeries[];
  note: string | null;
  accessibilityLabel: string;
};

/**
 * Positions are 0 to 1 inside the money-axis domain, not the raw data min and max.
 * The chart does not know dollars.
 * The selected line is moss. The other two are thinner muted dashes.
 * The target line uses the target tone and a dotted stroke. Actual points are omitted until there are two of them.
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
  const domain = moneyAxisDomain(values);
  const domainSpan = domain.max - domain.min;
  const yOf = (value: number) => (domainSpan === 0 ? 0.5 : (value - domain.min) / domainSpan);
  const series: ProjectionChartSeries[] = [];
  const span = Math.max(input.lines[0].points.length - 1, 1);
  if (input.targetUsd !== null) {
    series.push({
      id: 'target',
      label: '目标',
      style: 'dotted',
      tone: 'target',
      markers: false,
      thin: false,
      points: [
        { id: 'target-start', x: 0, y: yOf(input.targetUsd) },
        { id: 'target-end', x: 1, y: yOf(input.targetUsd) },
      ],
    });
  }
  input.lines.forEach((line, index) => {
    if (index === main) return;
    series.push(lineSeries(line, labels[index] ?? '', index, span, yOf, true));
  });
  series.push(lineSeries(input.lines[main] ?? input.lines[0], labels[main] ?? '', main, span, yOf, false));
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
        tone: 'accent',
        markers: true,
        thin: false,
        points,
      });
    }
  }
  const shownActual = series.find((item) => item.id === 'actual')?.points.length ?? 0;
  return {
    series,
    note: actualSeriesNote({ snapshot: input.snapshot, actualPoints: shownActual }),
    accessibilityLabel:
      input.targetUsd === null ? `实际、${labels.join('、')}` : `实际、${labels.join('、')}、目标，预计达标月份`,
  };
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
  thin: boolean,
): ProjectionChartSeries {
  return {
    id: `rate-${index}`,
    label,
    style: 'dashed',
    tone: thin ? 'muted' : 'moss',
    markers: false,
    thin,
    points: line.points.map((point, pointIndex) => ({
      id: `${index}-${point.month}`,
      x: pointIndex / span,
      y: yOf(point.netWorthUsd),
    })),
  };
}
