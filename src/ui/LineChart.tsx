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

export function LineChart({
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
  frame: { height: theme.layout.chart, width: '100%' },
});
