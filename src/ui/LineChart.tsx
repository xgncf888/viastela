import { createElement, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, Text as AxisText, View, type TextStyle } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

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
  const padY = theme.space.md;
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
  const yFor = (value: number) => {
    const ratio = (value - min) / span;
    return height - padY - ratio * (height - padY * 2);
  };
  const inner = width - padX * 2;
  return {
    width,
    height,
    placed: points.map((point) => ({
      id: point.id,
      x: padX + point.position * inner,
      rawY: yFor(point.raw),
      trendY: yFor(point.trend),
    })),
  };
}

function svg(tag: string, props: Record<string, unknown>, ...children: ReactNode[]) {
  return createElement(tag, props, ...children);
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
}: {
  plot: Plot;
  color: AppTheme['color'];
  grid: readonly ChartGridLine[];
  axis: ChartAxisLine | null;
}) {
  const trend = plot.placed.map((point) => `${point.x.toFixed(1)},${point.trendY.toFixed(1)}`).join(' ');
  return svg(
    'svg',
    {
      width: '100%',
      height: plot.height,
      viewBox: `0 0 ${plot.width} ${plot.height}`,
      role: 'presentation',
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
    svg('polyline', {
      points: trend,
      fill: 'none',
      stroke: color.moss,
      strokeWidth: theme.layout.stroke,
      strokeDasharray: '5 4',
      strokeLinejoin: 'round',
      strokeLinecap: 'round',
    }),
    plot.placed.map((point) =>
      svg('circle', {
        key: point.id,
        cx: point.x,
        cy: point.rawY,
        r: theme.layout.dot / 2,
        fill: color.accent,
      }),
    ),
  );
}

function NativePlot({
  plot,
  color,
  grid,
  axis,
}: {
  plot: Plot;
  color: AppTheme['color'];
  grid: readonly ChartGridLine[];
  axis: ChartAxisLine | null;
}) {
  const trend = plot.placed.map((point) => `${point.x.toFixed(1)},${point.trendY.toFixed(1)}`).join(' ');
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
      <Polyline
        points={trend}
        fill="none"
        stroke={color.moss}
        strokeWidth={theme.layout.stroke}
        strokeDasharray="5 4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {plot.placed.map((point) => (
        <Circle key={point.id} cx={point.x} cy={point.rawY} r={theme.layout.dot / 2} fill={color.accent} />
      ))}
    </Svg>
  );
}

export type ChartTone = 'accent' | 'moss' | 'muted' | 'line' | 'target';
export type ChartStyle = 'solid' | 'dashed' | 'dotted';

export type ChartSeries = {
  id: string;
  label: string;
  points: readonly { id: string; x: number; y: number }[];
  style: ChartStyle;
  tone: ChartTone;
  markers?: boolean;
  thin?: boolean;
};

type SeriesPlot = {
  width: number;
  height: number;
  series: {
    id: string;
    tone: ChartTone;
    style: ChartStyle;
    markers: boolean;
    thin: boolean;
    points: { id: string; x: number; y: number }[];
  }[];
};

const DASH: Record<ChartStyle, string | undefined> = {
  solid: undefined,
  dashed: '5 4',
  dotted: '2 3',
};

function buildSeriesPlot(series: readonly ChartSeries[], width: number, height: number): SeriesPlot | null {
  if (series.length === 0 || width <= 0) return null;
  const padX = theme.space.md;
  const padY = theme.space.md;
  const innerW = Math.max(width - padX * 2, 0);
  const innerH = Math.max(height - padY * 2, 0);
  return {
    width,
    height,
    series: series.map((item) => ({
      id: item.id,
      tone: item.tone,
      style: item.style,
      markers: item.markers === true,
      thin: item.thin === true,
      points: item.points.map((point) => ({
        id: point.id,
        x: padX + point.x * innerW,
        y: height - padY - point.y * innerH,
      })),
    })),
  };
}

function toneColor(tone: ChartTone, color: AppTheme['color']): string {
  if (tone === 'accent') return color.accent;
  if (tone === 'moss') return color.moss;
  if (tone === 'target') return color.target;
  if (tone === 'line') return color.line;
  return color.muted;
}

function SeriesWeb({
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
  return svg(
    'svg',
    { width: '100%', height: plot.height, viewBox: `0 0 ${plot.width} ${plot.height}`, role: 'presentation' },
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
    plot.series.map((series) =>
      svg('polyline', {
        key: series.id,
        points: series.points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' '),
        fill: 'none',
        stroke: toneColor(series.tone, color),
        strokeWidth: series.thin ? theme.border.width : theme.layout.stroke,
        strokeDasharray: DASH[series.style],
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      }),
    ),
    plot.series.flatMap((series) =>
      series.markers
        ? series.points.map((point) =>
            svg('circle', {
              key: `${series.id}-${point.id}`,
              cx: point.x,
              cy: point.y,
              r: theme.layout.dot / 2,
              fill: toneColor(series.tone, color),
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
          strokeWidth={series.thin ? theme.border.width : theme.layout.stroke}
          strokeDasharray={DASH[series.style]}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {plot.series.flatMap((series) =>
        series.markers
          ? series.points.map((point) => (
              <Circle
                key={`${series.id}-${point.id}`}
                cx={point.x}
                cy={point.y}
                r={theme.layout.dot / 2}
                fill={toneColor(series.tone, color)}
              />
            ))
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
}: {
  series: readonly ChartSeries[];
  startLabel: string;
  endLabel: string;
  accessibilityLabel: string;
} & ScaleProps) {
  const { color } = useTheme();
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
            <SeriesWeb plot={plot} color={color} grid={grid} axis={axis} />
          ) : (
            <SeriesNative plot={plot} color={color} grid={grid} axis={axis} />
          );
        }}
      />
      <Row gap="md" wrap>
        {series.map((item) => (
          <Row key={item.id} gap="xs">
            <LegendSwatch styleName={item.style} color={toneColor(item.tone, color)} />
            <Text variant="muted">{item.label}</Text>
          </Row>
        ))}
      </Row>
      <XLabels xTicks={xTicks} startLabel={startLabel} endLabel={endLabel} inset={ticks && ticks.length > 0 ? theme.layout.axisGutter : 0} />
    </View>
  );
}

function LegendSwatch({ styleName, color }: { styleName: ChartStyle; color: string }) {
  if (styleName === 'solid') return <View style={[styles.dot, { backgroundColor: color }]} />;
  if (styleName === 'dotted') {
    return <View style={[styles.swatch, styles.dotted, { borderColor: color }]} />;
  }
  return <View style={[styles.swatch, styles.dashed, { borderColor: color }]} />;
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
}: {
  points: readonly LinePoint[];
  startLabel: string;
  endLabel: string;
  rawLabel: string;
  trendLabel: string;
  accessibilityLabel: string;
} & ScaleProps) {
  const { color } = useTheme();

  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Row gap="md">
        <Row gap="xs">
          <View style={[styles.dot, { backgroundColor: color.accent }]} />
          <Text variant="muted">{rawLabel}</Text>
        </Row>
        <Row gap="xs">
          <View style={[styles.dash, { backgroundColor: color.moss }]} />
          <Text variant="muted">{trendLabel}</Text>
        </Row>
      </Row>
      <ChartCanvas
        ticks={ticks}
        unit={unit}
        color={color}
        height={height}
        renderPlot={(width, grid, axis) => {
          const plot = buildPlot(points, width, height, ticks);
          if (!plot) return null;
          return Platform.OS === 'web' ? (
            <WebPlot plot={plot} color={color} grid={grid} axis={axis} />
          ) : (
            <NativePlot plot={plot} color={color} grid={grid} axis={axis} />
          );
        }}
      />
      <XLabels xTicks={xTicks} startLabel={startLabel} endLabel={endLabel} inset={ticks && ticks.length > 0 ? theme.layout.axisGutter : 0} />
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
  frame: { width: '100%' },
  plot: { flex: 1 },
  axisRow: { flexDirection: 'row', width: '100%' },
  gutter: { width: theme.layout.axisGutter },
  unit: { width: theme.layout.axisGutter, textAlign: 'right' },
  xAxis: { height: theme.lineHeight.tick, position: 'relative' },
});
