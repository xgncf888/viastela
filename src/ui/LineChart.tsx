import { createElement, useState, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { Row } from './layout';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme, type AppTheme } from './ThemeProvider';

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
  gridY: number[];
};

function buildPlot(points: readonly LinePoint[], width: number, height: number): Plot | null {
  if (points.length === 0 || width <= 0) return null;
  const padX = theme.space.md;
  const padY = theme.space.md;
  const values = points.flatMap((point) => [point.raw, point.trend]);
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (max - min < 0.4) {
    const mid = (max + min) / 2;
    min = mid - 0.4;
    max = mid + 0.4;
  } else {
    const pad = (max - min) * 0.16;
    min -= pad;
    max += pad;
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
    gridY: [0.25, 0.5, 0.75].map((ratio) => yFor(min + span * ratio)),
  };
}

function svg(tag: string, props: Record<string, unknown>, ...children: ReactNode[]) {
  return createElement(tag, props, ...children);
}

function WebPlot({ plot, color }: { plot: Plot; color: AppTheme['color'] }) {
  const trend = plot.placed.map((point) => `${point.x.toFixed(1)},${point.trendY.toFixed(1)}`).join(' ');
  return svg(
    'svg',
    {
      width: '100%',
      height: plot.height,
      viewBox: `0 0 ${plot.width} ${plot.height}`,
      role: 'presentation',
    },
    plot.gridY.map((y) =>
      svg('line', {
        key: y,
        x1: 0,
        x2: plot.width,
        y1: y,
        y2: y,
        stroke: color.line,
        strokeWidth: theme.border.width,
      }),
    ),
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

function NativePlot({ plot, color }: { plot: Plot; color: AppTheme['color'] }) {
  const trend = plot.placed.map((point) => `${point.x.toFixed(1)},${point.trendY.toFixed(1)}`).join(' ');
  return (
    <Svg width={plot.width} height={plot.height}>
      {plot.gridY.map((y) => (
        <Line
          key={y}
          x1={0}
          x2={plot.width}
          y1={y}
          y2={y}
          stroke={color.line}
          strokeWidth={theme.border.width}
        />
      ))}
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

export type ChartTone = 'accent' | 'moss' | 'muted' | 'line';
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
  gridY: number[];
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
    gridY: [0.25, 0.5, 0.75].map((ratio) => height - padY - ratio * innerH),
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
  if (tone === 'line') return color.line;
  return color.muted;
}

function SeriesWeb({ plot, color }: { plot: SeriesPlot; color: AppTheme['color'] }) {
  return svg(
    'svg',
    { width: '100%', height: plot.height, viewBox: `0 0 ${plot.width} ${plot.height}`, role: 'presentation' },
    plot.gridY.map((y) =>
      svg('line', { key: y, x1: 0, x2: plot.width, y1: y, y2: y, stroke: color.line, strokeWidth: theme.border.width }),
    ),
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

function SeriesNative({ plot, color }: { plot: SeriesPlot; color: AppTheme['color'] }) {
  return (
    <Svg width={plot.width} height={plot.height}>
      {plot.gridY.map((y) => (
        <Line key={y} x1={0} x2={plot.width} y1={y} y2={y} stroke={color.line} strokeWidth={theme.border.width} />
      ))}
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

export function LineChart(
  props:
    | {
        points: readonly LinePoint[];
        startLabel: string;
        endLabel: string;
        rawLabel: string;
        trendLabel: string;
        accessibilityLabel: string;
        series?: undefined;
      }
    | {
        series: readonly ChartSeries[];
        startLabel: string;
        endLabel: string;
        accessibilityLabel: string;
        points?: undefined;
      },
) {
  if (props.series) return <SeriesLineChart {...props} series={props.series} />;
  return <LegacyLineChart {...props} />;
}

function SeriesLineChart({
  series,
  startLabel,
  endLabel,
  accessibilityLabel,
}: {
  series: readonly ChartSeries[];
  startLabel: string;
  endLabel: string;
  accessibilityLabel: string;
}) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const plot = buildSeriesPlot(series, width, theme.layout.chart);
  return (
    <View accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={styles.frame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {plot ? Platform.OS === 'web' ? <SeriesWeb plot={plot} color={color} /> : <SeriesNative plot={plot} color={color} /> : null}
      </View>
      <Row gap="md" wrap>
        {series.map((item) => (
          <Row key={item.id} gap="xs">
            <LegendSwatch styleName={item.style} color={toneColor(item.tone, color)} />
            <Text variant="muted">{item.label}</Text>
          </Row>
        ))}
      </Row>
      <Row justify="between">
        <Text variant="muted">{startLabel}</Text>
        <Text variant="muted">{endLabel}</Text>
      </Row>
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
}: {
  points: readonly LinePoint[];
  startLabel: string;
  endLabel: string;
  rawLabel: string;
  trendLabel: string;
  accessibilityLabel: string;
}) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const plot = buildPlot(points, width, theme.layout.chart);

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
      <View style={styles.frame} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {plot ? Platform.OS === 'web' ? <WebPlot plot={plot} color={color} /> : <NativePlot plot={plot} color={color} /> : null}
      </View>
      <Row justify="between">
        <Text variant="muted">{startLabel}</Text>
        <Text variant="muted">{endLabel}</Text>
      </Row>
    </View>
  );
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
  frame: { height: theme.layout.chart, width: '100%' },
});
