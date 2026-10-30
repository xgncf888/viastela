import { createElement, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text as AxisText, View, type TextStyle } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { formatMonthDay } from '@/core/local-day';

import {
  chartDecorations,
  tickOffset,
  tickValueDomain,
  type ChartAxisLine,
  type ChartGridLine,
  type ChartTick,
  type ChartXTick,
} from './chart-ticks';
import { Row } from './layout';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme, type AppTheme } from './ThemeProvider';

export type { ChartTick, ChartXTick } from './chart-ticks';

export type LinePoint = {
  id: string;
  position: number;
  raw: number;
  trend: number;
};

type Placed = {
  id: string;
  position: number;
  raw: number;
  trend: number;
  x: number;
  rawY: number;
  trendY: number;
};

type Plot = {
  width: number;
  height: number;
  placed: Placed[];
};

function buildPlot(
  points: readonly LinePoint[],
  width: number,
  height: number,
  ticks?: readonly ChartTick[],
): Plot | null {
  if (points.length === 0 || width <= 0) return null;
  const padX = theme.space.md;
  const domain = tickValueDomain(ticks);
  let min: number;
  let max: number;
  if (domain) {
    min = domain.min;
    max = domain.max;
  } else {
    const values = points.flatMap((point) => [point.raw, point.trend]);
    min = Math.min(...values);
    max = Math.max(...values);
    if (max - min < 0.4) {
      const mid = (max + min) / 2;
      min = mid - 0.4;
      max = mid + 0.4;
    } else {
      const pad = (max - min) * 0.16;
      min -= pad;
      max += pad;
    }
  }
  const span = max - min;
  const yFor = (value: number) => tickOffset((value - min) / span, height);
  const inner = width - padX * 2;
  return {
    width,
    height,
    placed: points.map((point) => ({
      id: point.id,
      position: point.position,
      raw: point.raw,
      trend: point.trend,
      x: padX + point.position * inner,
      rawY: yFor(point.raw),
      trendY: yFor(point.trend),
    })),
  };
}

function svg(tag: string, props: Record<string, unknown>, ...children: ReactNode[]) {
  return createElement(tag, props, ...children);
}

/** Last point is `dotLast` with a card-colored stroke so it separates from the line. */
export function chartMarkerDot(
  index: number,
  count: number,
  fill: string,
  card: string,
): { r: number; fill: string; stroke?: string; strokeWidth?: number } {
  const last = count > 0 && index === count - 1;
  if (!last) return { r: theme.layout.dot / 2, fill };
  return {
    r: theme.layout.dotLast / 2,
    fill,
    stroke: card,
    strokeWidth: theme.border.width,
  };
}

function axisLines(axis: ChartAxisLine | null, width: number): ReactNode {
  if (!axis) return null;
  return [
    svg('line', {
      key: 'axis-y',
      x1: 0,
      x2: 0,
      y1: axis.top,
      y2: axis.bottom,
      stroke: axis.stroke,
      strokeWidth: theme.border.width,
    }),
    svg('line', {
      key: 'axis-x',
      x1: 0,
      x2: width,
      y1: axis.bottom,
      y2: axis.bottom,
      stroke: axis.stroke,
      strokeWidth: theme.border.width,
    }),
  ];
}

function WebPlot({
  plot,
  color,
  grid,
  axis,
  activeId,
  focusSeries,
  onSelectId,
}: {
  plot: Plot;
  color: AppTheme['color'];
  grid: readonly ChartGridLine[];
  axis: ChartAxisLine | null;
  activeId?: string | null;
  focusSeries?: 'all' | 'raw' | 'trend';
  onSelectId?: (id: string | null) => void;
}) {
  const trend = plot.placed.map((point) => `${point.x.toFixed(1)},${point.trendY.toFixed(1)}`).join(' ');
  const rawLine = plot.placed.map((point) => `${point.x.toFixed(1)},${point.rawY.toFixed(1)}`).join(' ');
  const activePoint = activeId ? plot.placed.find((point) => point.id === activeId) ?? null : null;
  const dimRaw = focusSeries === 'trend';
  const dimTrend = focusSeries === 'raw';

  return svg(
    'svg',
    {
      width: '100%',
      height: plot.height,
      viewBox: `0 0 ${plot.width} ${plot.height}`,
      role: 'presentation',
      style: onSelectId ? { cursor: 'crosshair' } : undefined,
      onMouseLeave: onSelectId ? () => onSelectId(null) : undefined,
      onMouseMove: onSelectId
        ? (event: { currentTarget: { getBoundingClientRect?: () => { left: number; width: number } }; clientX?: number }) => {
            if (typeof event.clientX !== 'number' || !event.currentTarget?.getBoundingClientRect) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (!rect || rect.width <= 0) return;
            const relX = ((event.clientX - rect.left) / rect.width) * plot.width;
            let closest = plot.placed[0];
            let bestDist = Math.abs(relX - closest.x);
            for (const candidate of plot.placed) {
              const dist = Math.abs(relX - candidate.x);
              if (dist < bestDist) {
                closest = candidate;
                bestDist = dist;
              }
            }
            onSelectId(closest.id);
          }
        : undefined,
    },
    grid.map((line) =>
      svg('line', {
        key: line.y,
        x1: 0,
        x2: plot.width,
        y1: line.y,
        y2: line.y,
        stroke: line.stroke,
        strokeWidth: theme.border.width,
      }),
    ),
    axisLines(axis, plot.width),
    activePoint
      ? svg('line', {
          key: 'crosshair-x',
          x1: activePoint.x,
          x2: activePoint.x,
          y1: theme.space.xs,
          y2: plot.height - theme.space.xs,
          stroke: color.ink,
          strokeWidth: theme.border.width,
          strokeDasharray: '3 3',
          strokeOpacity: 0.35,
        })
      : null,
    plot.placed.length > 1
      ? svg('polyline', {
          key: 'raw-line',
          points: rawLine,
          fill: 'none',
          stroke: color.accent,
          strokeWidth: theme.border.width,
          strokeOpacity: dimRaw ? 0.15 : 0.38,
          strokeLinejoin: 'round',
          strokeLinecap: 'round',
        })
      : null,
    svg('polyline', {
      points: trend,
      fill: 'none',
      stroke: color.moss,
      strokeWidth: focusSeries === 'trend' ? theme.layout.strokeSelected : theme.layout.stroke,
      strokeDasharray: '5 4',
      strokeOpacity: dimTrend ? 0.25 : 1,
      strokeLinejoin: 'round',
      strokeLinecap: 'round',
    }),
    plot.placed.map((point, index) => {
      const isSelected = activePoint?.id === point.id;
      const base = chartMarkerDot(index, plot.placed.length, color.accent, color.card);
      return svg(
        'g',
        { key: point.id },
        isSelected
          ? svg('circle', {
              cx: point.x,
              cy: point.rawY,
              r: theme.layout.dotLast,
              fill: color.accentSoft,
            })
          : null,
        svg('circle', {
          cx: point.x,
          cy: point.rawY,
          r: isSelected ? theme.layout.dotLast / 2 + 1 : base.r,
          fill: base.fill,
          fillOpacity: dimRaw ? 0.3 : 1,
          stroke: isSelected ? color.card : base.stroke,
          strokeWidth: isSelected ? theme.layout.stroke : base.strokeWidth,
        }),
        isSelected
          ? svg('circle', {
              cx: point.x,
              cy: point.trendY,
              r: theme.layout.dot / 2 + 1,
              fill: color.moss,
              stroke: color.card,
              strokeWidth: theme.border.width,
            })
          : null,
      );
    }),
  );
}

function NativePlot({
  plot,
  color,
  grid,
  axis,
  activeId,
  focusSeries,
}: {
  plot: Plot;
  color: AppTheme['color'];
  grid: readonly ChartGridLine[];
  axis: ChartAxisLine | null;
  activeId?: string | null;
  focusSeries?: 'all' | 'raw' | 'trend';
}) {
  const trend = plot.placed.map((point) => `${point.x.toFixed(1)},${point.trendY.toFixed(1)}`).join(' ');
  const activePoint = activeId ? plot.placed.find((point) => point.id === activeId) ?? null : null;
  const dimRaw = focusSeries === 'trend';
  const dimTrend = focusSeries === 'raw';

  return (
    <Svg width={plot.width} height={plot.height}>
      {grid.map((line) => (
        <Line
          key={line.y}
          x1={0}
          x2={plot.width}
          y1={line.y}
          y2={line.y}
          stroke={line.stroke}
          strokeWidth={theme.border.width}
        />
      ))}
      {axis ? (
        <>
          <Line x1={0} x2={0} y1={axis.top} y2={axis.bottom} stroke={axis.stroke} strokeWidth={theme.border.width} />
          <Line
            x1={0}
            x2={plot.width}
            y1={axis.bottom}
            y2={axis.bottom}
            stroke={axis.stroke}
            strokeWidth={theme.border.width}
          />
        </>
      ) : null}
      {activePoint ? (
        <Line
          x1={activePoint.x}
          x2={activePoint.x}
          y1={theme.space.xs}
          y2={plot.height - theme.space.xs}
          stroke={color.ink}
          strokeWidth={theme.border.width}
          strokeDasharray="3 3"
          strokeOpacity={0.35}
        />
      ) : null}
      <Polyline
        points={trend}
        fill="none"
        stroke={color.moss}
        strokeWidth={focusSeries === 'trend' ? theme.layout.strokeSelected : theme.layout.stroke}
        strokeDasharray="5 4"
        strokeOpacity={dimTrend ? 0.25 : 1}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {plot.placed.map((point, index) => {
        const isSelected = activePoint?.id === point.id;
        const mark = chartMarkerDot(index, plot.placed.length, color.accent, color.card);
        return (
          <Circle
            key={point.id}
            cx={point.x}
            cy={point.rawY}
            r={isSelected ? theme.layout.dotLast / 2 + 1 : mark.r}
            fill={mark.fill}
            fillOpacity={dimRaw ? 0.3 : 1}
            stroke={isSelected ? color.card : mark.stroke}
            strokeWidth={isSelected ? theme.layout.stroke : mark.stroke ? mark.strokeWidth : undefined}
          />
        );
      })}
    </Svg>
  );
}

export type ChartTone = 'accent' | 'ink' | 'moss' | 'muted' | 'target';

/** Weight and dash for one series. The chart does not derive these from `tone`. */
export type ChartStroke = {
  width: number;
  /** SVG stroke-dasharray. Omit for a solid line. */
  dash?: string;
};

export type ChartSeries = {
  id: string;
  label: string;
  points: readonly { id: string; x: number; y: number }[];
  tone: ChartTone;
  stroke: ChartStroke;
  /** Lower values paint first. Omit it and the series array order is the paint order. */
  layer?: number;
  markers?: boolean;
};

type SeriesPlot = {
  width: number;
  height: number;
  series: {
    id: string;
    label: string;
    tone: ChartTone;
    stroke: ChartStroke;
    markers: boolean;
    points: { id: string; x: number; y: number }[];
  }[];
};

/** Paint order. The legend keeps the caller's array order. */
function paintOrder(series: readonly ChartSeries[]): ChartSeries[] {
  return series
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.layer ?? a.index) - (b.item.layer ?? b.index) || a.index - b.index)
    .map((entry) => entry.item);
}

function buildSeriesPlot(series: readonly ChartSeries[], width: number, height: number): SeriesPlot | null {
  if (series.length === 0 || width <= 0) return null;
  const padX = theme.space.md;
  const innerW = Math.max(width - padX * 2, 0);
  return {
    width,
    height,
    series: paintOrder(series).map((item) => ({
      id: item.id,
      label: item.label,
      tone: item.tone,
      stroke: item.stroke,
      markers: item.markers === true,
      points: item.points.map((point) => ({
        id: point.id,
        x: padX + point.x * innerW,
        y: tickOffset(point.y, height),
      })),
    })),
  };
}

function toneColor(tone: ChartTone, color: AppTheme['color']): string {
  if (tone === 'accent') return color.accent;
  if (tone === 'ink') return color.ink;
  if (tone === 'moss') return color.moss;
  if (tone === 'target') return color.target;
  return color.muted;
}

function SeriesWeb({
  plot,
  color,
  grid,
  axis,
  activePointId,
  focusedSeriesId,
  onSelectPointId,
}: {
  plot: SeriesPlot;
  color: AppTheme['color'];
  grid: readonly ChartGridLine[];
  axis: ChartAxisLine | null;
  activePointId?: string | null;
  focusedSeriesId?: string | null;
  onSelectPointId?: (id: string | null) => void;
}) {
  const allPoints = plot.series.flatMap((series) => series.points);
  const activePoint = activePointId ? allPoints.find((point) => point.id === activePointId) ?? null : null;

  return svg(
    'svg',
    {
      width: '100%',
      height: plot.height,
      viewBox: `0 0 ${plot.width} ${plot.height}`,
      role: 'presentation',
      style: onSelectPointId ? { cursor: 'crosshair' } : undefined,
      onMouseLeave: onSelectPointId ? () => onSelectPointId(null) : undefined,
      onMouseMove: onSelectPointId
        ? (event: { currentTarget: { getBoundingClientRect?: () => { left: number; width: number } }; clientX?: number }) => {
            if (typeof event.clientX !== 'number' || !event.currentTarget?.getBoundingClientRect || allPoints.length === 0) return;
            const rect = event.currentTarget.getBoundingClientRect();
            if (!rect || rect.width <= 0) return;
            const relX = ((event.clientX - rect.left) / rect.width) * plot.width;
            let closest = allPoints[0];
            let bestDist = Math.abs(relX - closest.x);
            for (const candidate of allPoints) {
              const dist = Math.abs(relX - candidate.x);
              if (dist < bestDist) {
                closest = candidate;
                bestDist = dist;
              }
            }
            onSelectPointId(closest.id);
          }
        : undefined,
    },
    grid.map((line) =>
      svg('line', {
        key: line.y,
        x1: 0,
        x2: plot.width,
        y1: line.y,
        y2: line.y,
        stroke: line.stroke,
        strokeWidth: theme.border.width,
      }),
    ),
    axisLines(axis, plot.width),
    activePoint
      ? svg('line', {
          key: 'crosshair-x',
          x1: activePoint.x,
          x2: activePoint.x,
          y1: theme.space.xs,
          y2: plot.height - theme.space.xs,
          stroke: color.ink,
          strokeWidth: theme.border.width,
          strokeDasharray: '3 3',
          strokeOpacity: 0.35,
        })
      : null,
    plot.series.map((series) => {
      const dimmed = focusedSeriesId != null && focusedSeriesId !== series.id;
      return svg('polyline', {
        key: series.id,
        points: series.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
        fill: 'none',
        stroke: toneColor(series.tone, color),
        strokeWidth: focusedSeriesId === series.id ? theme.layout.strokeSelected : series.stroke.width,
        strokeDasharray: series.stroke.dash,
        strokeOpacity: dimmed ? 0.22 : 1,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      });
    }),
    plot.series.flatMap((series) =>
      series.markers
        ? series.points.map((point, index) =>
            svg('circle', {
              key: `${series.id}-${point.id}`,
              cx: point.x,
              cy: point.y,
              ...chartMarkerDot(index, series.points.length, toneColor(series.tone, color), color.card),
            }),
          )
        : [],
    ),
  );
}

function SeriesNative({
  plot,
  color,
  grid,
  axis,
}: {
  plot: SeriesPlot;
  color: AppTheme['color'];
  grid: readonly ChartGridLine[];
  axis: ChartAxisLine | null;
}) {
  return (
    <Svg width={plot.width} height={plot.height}>
      {grid.map((line) => (
        <Line
          key={line.y}
          x1={0}
          x2={plot.width}
          y1={line.y}
          y2={line.y}
          stroke={line.stroke}
          strokeWidth={theme.border.width}
        />
      ))}
      {axis ? (
        <>
          <Line x1={0} x2={0} y1={axis.top} y2={axis.bottom} stroke={axis.stroke} strokeWidth={theme.border.width} />
          <Line
            x1={0}
            x2={plot.width}
            y1={axis.bottom}
            y2={axis.bottom}
            stroke={axis.stroke}
            strokeWidth={theme.border.width}
          />
        </>
      ) : null}
      {plot.series.map((series) => (
        <Polyline
          key={series.id}
          points={series.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke={toneColor(series.tone, color)}
          strokeWidth={series.stroke.width}
          strokeDasharray={series.stroke.dash}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {plot.series.flatMap((series) =>
        series.markers
          ? series.points.map((point, index) => {
              const mark = chartMarkerDot(index, series.points.length, toneColor(series.tone, color), color.card);
              return (
                <Circle
                  key={`${series.id}-${point.id}`}
                  cx={point.x}
                  cy={point.y}
                  r={mark.r}
                  fill={mark.fill}
                  stroke={mark.stroke}
                  strokeWidth={mark.stroke ? mark.strokeWidth : undefined}
                />
              );
            })
          : [],
      )}
    </Svg>
  );
}

type ScaleProps = {
  /** Y ticks. Grid lines move onto these. Omit them and the chart keeps the 25/50/75% grid. */
  ticks?: readonly ChartTick[];
  /** Written once at the top of the axis. Not repeated on each tick. */
  unit?: string;
  /** X ticks. Omit them and the chart keeps `startLabel` / `endLabel`. */
  xTicks?: readonly ChartXTick[];
  /** Plot height. Defaults to `layout.chart`. Callers pass `chartPhone`, `chartShort`, or `chartWide`. */
  height?: number;
  /** Enables interactive crosshair inspection and live readout bar. */
  interactive?: boolean;
  /** Externally controlled selected point ID for table-to-chart two-way highlighting. */
  selectedPointId?: string | null;
  /** Callback fired when a point is hovered or tapped. */
  onSelectPointId?: (id: string | null) => void;
};

export function LineChart(
  props:
    | ({
        points: readonly LinePoint[];
        startLabel: string;
        endLabel: string;
        rawLabel: string;
        trendLabel: string;
        accessibilityLabel: string;
        series?: undefined;
      } & ScaleProps)
    | ({
        series: readonly ChartSeries[];
        startLabel: string;
        endLabel: string;
        accessibilityLabel: string;
        points?: undefined;
      } & ScaleProps),
) {
  if (props.series) return <SeriesLineChart {...props} series={props.series} />;
  return <LegacyLineChart {...props} />;
}

function SeriesLineChart({
  series,
  startLabel,
  endLabel,
  accessibilityLabel,
  ticks,
  unit,
  xTicks,
  height = theme.layout.chart,
  interactive = false,
  selectedPointId,
  onSelectPointId,
}: {
  series: readonly ChartSeries[];
  startLabel: string;
  endLabel: string;
  accessibilityLabel: string;
} & ScaleProps) {
  const { color } = useTheme();
  const [internalPointId, setInternalPointId] = useState<string | null>(null);
  const [focusedSeriesId, setFocusedSeriesId] = useState<string | null>(null);
  const activePointId = selectedPointId !== undefined ? selectedPointId : internalPointId;

  function handleSelectPoint(id: string | null) {
    setInternalPointId(id);
    onSelectPointId?.(id);
  }

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <ChartCanvas
        ticks={ticks}
        unit={unit}
        color={color}
        height={height}
        renderPlot={(width, grid, axis) => {
          const plot = buildSeriesPlot(series, width, height);
          if (!plot) return null;
          return Platform.OS === 'web' ? (
            <SeriesWeb
              plot={plot}
              color={color}
              grid={grid}
              axis={axis}
              activePointId={interactive ? activePointId : null}
              focusedSeriesId={interactive ? focusedSeriesId : null}
              onSelectPointId={interactive ? handleSelectPoint : undefined}
            />
          ) : (
            <SeriesNative plot={plot} color={color} grid={grid} axis={axis} />
          );
        }}
      />
      <XLabels xTicks={xTicks} startLabel={startLabel} endLabel={endLabel} inset={ticks && ticks.length > 0 ? theme.layout.axisGutter : 0} />
      <Legend wrap>
        {series.map((item) => {
          const isFocused = focusedSeriesId === item.id;
          const content = (
            <Row gap="xs" align="center">
              <LegendSwatch dash={item.stroke.dash} color={toneColor(item.tone, color)} />
              <Text variant="caption">{item.label}</Text>
            </Row>
          );
          if (!interactive) return <View key={item.id}>{content}</View>;
          return (
            <Pressable
              key={item.id}
              onPress={() => setFocusedSeriesId((current) => (current === item.id ? null : item.id))}
              style={[
                styles.legendButton,
                {
                  borderColor: isFocused ? color.ink : color.line,
                  backgroundColor: isFocused ? color.fill : 'transparent',
                },
              ]}
            >
              {content}
            </Pressable>
          );
        })}
      </Legend>
      {interactive ? (
        <View style={[styles.inspectBar, { backgroundColor: color.fill, borderColor: color.line }]}>
          <Row justify="between" align="center" gap="sm" wrap>
            <Row gap="xs" align="center">
              <View style={[styles.inspectDot, { backgroundColor: activePointId ? color.accent : color.moss }]} />
              <Text variant="caption">
                {activePointId ? `十字检视 · 节点 ${activePointId}` : '移动指针或轻触图例胶囊，可单独聚焦曲线与节点'}
              </Text>
            </Row>
            {focusedSeriesId ? (
              <Text variant="caption" tone="accent">
                {`已聚焦：${series.find((item) => item.id === focusedSeriesId)?.label ?? focusedSeriesId}`}
              </Text>
            ) : null}
          </Row>
        </View>
      ) : null}
    </View>
  );
}

function Legend({ children, wrap = false }: { children: ReactNode; wrap?: boolean }) {
  return (
    <View style={styles.legend}>
      <Row gap="md" wrap={wrap}>
        {children}
      </Row>
    </View>
  );
}

function LegendSwatch({ dash, color }: { dash?: string; color: string }) {
  if (!dash) return <View style={[styles.dot, { backgroundColor: color }]} />;
  if (dash === '2 3') return <View style={[styles.swatch, styles.dotted, { borderColor: color }]} />;
  return <View style={[styles.swatch, styles.dashed, { borderColor: color }]} />;
}

function formatPointLabel(id: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(id) ? formatMonthDay(id) : id;
}

function LegacyLineChart({
  points,
  startLabel,
  endLabel,
  rawLabel,
  trendLabel,
  accessibilityLabel,
  ticks,
  unit,
  xTicks,
  height = theme.layout.chart,
  interactive = false,
  selectedPointId,
  onSelectPointId,
}: {
  points: readonly LinePoint[];
  startLabel: string;
  endLabel: string;
  rawLabel: string;
  trendLabel: string;
  accessibilityLabel: string;
} & ScaleProps) {
  const { color } = useTheme();
  const [internalId, setInternalId] = useState<string | null>(null);
  const [focusSeries, setFocusSeries] = useState<'all' | 'raw' | 'trend'>('all');
  const activeId = selectedPointId !== undefined ? selectedPointId : internalId;

  function handleSelect(id: string | null) {
    setInternalId(id);
    onSelectPointId?.(id);
  }

  const activeIndex = activeId ? points.findIndex((point) => point.id === activeId) : points.length - 1;
  const inspected = activeIndex >= 0 ? points[activeIndex] : points[points.length - 1];
  const prevPoint = activeIndex > 0 ? points[activeIndex - 1] : null;
  const rawDelta = inspected && prevPoint ? inspected.raw - prevPoint.raw : null;

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <ChartCanvas
        ticks={ticks}
        unit={unit}
        color={color}
        height={height}
        renderPlot={(width, grid, axis) => {
          const plot = buildPlot(points, width, height, ticks);
          if (!plot) return null;
          return Platform.OS === 'web' ? (
            <WebPlot
              plot={plot}
              color={color}
              grid={grid}
              axis={axis}
              activeId={interactive ? activeId : null}
              focusSeries={interactive ? focusSeries : 'all'}
              onSelectId={interactive ? handleSelect : undefined}
            />
          ) : (
            <NativePlot
              plot={plot}
              color={color}
              grid={grid}
              axis={axis}
              activeId={interactive ? activeId : null}
              focusSeries={interactive ? focusSeries : 'all'}
            />
          );
        }}
      />
      <XLabels xTicks={xTicks} startLabel={startLabel} endLabel={endLabel} inset={ticks && ticks.length > 0 ? theme.layout.axisGutter : 0} />
      <Legend>
        {interactive ? (
          <>
            <Pressable
              onPress={() => setFocusSeries((current) => (current === 'raw' ? 'all' : 'raw'))}
              style={[
                styles.legendButton,
                {
                  borderColor: focusSeries === 'raw' ? color.ink : color.line,
                  backgroundColor: focusSeries === 'raw' ? color.fill : 'transparent',
                },
              ]}
            >
              <Row gap="xs" align="center">
                <View style={[styles.dot, { backgroundColor: color.accent }]} />
                <Text variant="caption">{rawLabel}</Text>
              </Row>
            </Pressable>
            <Pressable
              onPress={() => setFocusSeries((current) => (current === 'trend' ? 'all' : 'trend'))}
              style={[
                styles.legendButton,
                {
                  borderColor: focusSeries === 'trend' ? color.ink : color.line,
                  backgroundColor: focusSeries === 'trend' ? color.fill : 'transparent',
                },
              ]}
            >
              <Row gap="xs" align="center">
                <View style={[styles.dash, { backgroundColor: color.moss }]} />
                <Text variant="caption">{trendLabel}</Text>
              </Row>
            </Pressable>
          </>
        ) : (
          <>
            <Row gap="xs">
              <View style={[styles.dot, { backgroundColor: color.accent }]} />
              <Text variant="caption">{rawLabel}</Text>
            </Row>
            <Row gap="xs">
              <View style={[styles.dash, { backgroundColor: color.moss }]} />
              <Text variant="caption">{trendLabel}</Text>
            </Row>
          </>
        )}
      </Legend>
      {interactive && inspected ? (
        <View style={[styles.inspectBar, { backgroundColor: color.fill, borderColor: color.line }]}>
          <Row justify="between" align="center" gap="sm" wrap>
            <Row gap="xs" align="center">
              <View style={[styles.inspectDot, { backgroundColor: activeId ? color.accent : color.moss }]} />
              <Text variant="caption">
                {activeId ? `实时检视 ${formatPointLabel(inspected.id)}` : `最新节点 ${formatPointLabel(inspected.id)}`}
              </Text>
            </Row>
            <Row gap="md" align="center" wrap>
              <Text variant="caption">
                {`晨重 ${inspected.raw.toFixed(1)}${unit ? ` ${unit}` : ''}`}
              </Text>
              <Text variant="caption">
                {`平滑 ${inspected.trend.toFixed(2)}${unit ? ` ${unit}` : ''}`}
              </Text>
              {rawDelta !== null ? (
                <Text variant="caption" tone={rawDelta <= 0 ? 'accent' : 'muted'}>
                  {`较前次 ${rawDelta > 0 ? '+' : ''}${rawDelta.toFixed(1)}${unit ? ` ${unit}` : ''}`}
                </Text>
              ) : null}
            </Row>
          </Row>
        </View>
      ) : null}
    </View>
  );
}

function ChartCanvas({
  ticks,
  unit,
  color,
  height,
  renderPlot,
}: {
  ticks?: readonly ChartTick[];
  unit?: string;
  color: AppTheme['color'];
  height: number;
  renderPlot: (width: number, grid: readonly ChartGridLine[], axis: ChartAxisLine | null) => ReactNode;
}) {
  const [width, setWidth] = useState(0);
  const decorations = chartDecorations(ticks, color, height);
  const hasTicks = (ticks?.length ?? 0) > 0;
  const plot = (
    <View
      style={[hasTicks ? styles.plot : styles.frame, { height }]}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        setWidth((current) => (current === next ? current : next));
      }}
    >
      {width > 0 ? renderPlot(width, decorations.lines, decorations.axis) : null}
    </View>
  );
  if (!hasTicks && !unit) return plot;
  return (
    <View>
      {unit ? <UnitLabel unit={unit} /> : null}
      {hasTicks ? (
        <View style={[styles.axisRow, { height }]}>
          <YAxis ticks={ticks ?? []} height={height} />
          {plot}
        </View>
      ) : (
        plot
      )}
    </View>
  );
}

function UnitLabel({ unit }: { unit: string }) {
  const { color } = useTheme();
  return (
    <AxisText
      accessible={false}
      maxFontSizeMultiplier={theme.fontScale.heading}
      style={[axisTextStyle(color.muted), styles.unit]}
    >
      {unit}
    </AxisText>
  );
}

function YAxis({ ticks, height }: { ticks: readonly ChartTick[]; height: number }) {
  const { color } = useTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.gutter, { height }]}
    >
      {ticks.map((tick, index) => (
        <AxisText
          key={`${index}-${tick.label}`}
          accessible={false}
          maxFontSizeMultiplier={theme.fontScale.heading}
          style={[
            axisTextStyle(color.muted),
            {
              position: 'absolute',
              top: tickOffset(tick.position, height) - theme.lineHeight.tick / 2,
              left: 0,
              width: theme.layout.axisGutter,
            },
          ]}
        >
          {tick.label}
        </AxisText>
      ))}
    </View>
  );
}

function XLabels({
  xTicks,
  startLabel,
  endLabel,
  inset,
}: {
  xTicks?: readonly ChartXTick[];
  startLabel: string;
  endLabel: string;
  inset: number;
}) {
  if (!xTicks || xTicks.length === 0) {
    return (
      <Row justify="between">
        <Text variant="muted">{startLabel}</Text>
        <Text variant="muted">{endLabel}</Text>
      </Row>
    );
  }
  return <XAxis ticks={xTicks} inset={inset} />;
}

function XAxis({ ticks, inset }: { ticks: readonly ChartXTick[]; inset: number }) {
  const { color } = useTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.xAxis, { marginLeft: inset }]}
    >
      {ticks.map((tick, index) => (
        <AxisText
          key={`${index}-${tick.label}`}
          accessible={false}
          maxFontSizeMultiplier={theme.fontScale.heading}
          style={[axisTextStyle(color.muted), xTickStyle(tick.position)]}
        >
          {tick.label}
        </AxisText>
      ))}
    </View>
  );
}

function axisTextStyle(color: string): TextStyle {
  return {
    color,
    fontSize: theme.font.tick,
    lineHeight: theme.lineHeight.tick,
    fontWeight: theme.fontWeight.regular,
    fontFamily: Platform.OS === 'web' ? theme.fontFamily.mono : undefined,
    fontVariant: ['tabular-nums', 'lining-nums'],
    textAlign: 'right',
  };
}

function xTickStyle(position: number): TextStyle {
  if (position <= 0) return { position: 'absolute', left: 0, top: 0, textAlign: 'left' };
  if (position >= 1) return { position: 'absolute', right: 0, top: 0, textAlign: 'right' };
  return {
    position: 'absolute',
    left: `${position * 100}%`,
    top: 0,
    textAlign: 'center',
  };
}

const styles = StyleSheet.create({
  dot: {
    width: theme.space.sm,
    height: theme.space.sm,
    borderRadius: theme.radius.pill,
  },
  dash: {
    width: theme.space.md,
    height: theme.layout.stroke,
    borderRadius: theme.radius.pill,
  },
  swatch: {
    width: theme.space.md,
    height: theme.space.sm,
    backgroundColor: 'transparent',
  },
  dashed: {
    borderBottomWidth: theme.layout.stroke,
    borderStyle: 'dashed',
  },
  dotted: {
    borderBottomWidth: theme.layout.stroke,
    borderStyle: 'dotted',
  },
  legend: { marginTop: theme.space.sm },
  legendButton: {
    paddingHorizontal: theme.space.sm,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  inspectBar: {
    marginTop: theme.space.sm,
    paddingHorizontal: theme.space.ms,
    paddingVertical: theme.space.xs,
    borderRadius: theme.radius.sm,
    borderWidth: theme.border.width,
  },
  inspectDot: {
    width: theme.layout.dot,
    height: theme.layout.dot,
    borderRadius: theme.radius.pill,
  },
  frame: { width: '100%' },
  plot: { flex: 1 },
  axisRow: { flexDirection: 'row', width: '100%' },
  gutter: { width: theme.layout.axisGutter },
  unit: { width: theme.layout.axisGutter, textAlign: 'right' },
  xAxis: { height: theme.lineHeight.tick, position: 'relative' },
});
