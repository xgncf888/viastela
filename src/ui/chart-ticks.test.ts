import { expect, test } from '@jest/globals';

import { lightColor, theme } from './theme';
import { chartDecorations, moneyAxis, tickOffset, weightAxis, weightXLabels, yearXLabels } from './chart-ticks';

test('a 28-day weight axis labels every 7 days and ends on the 28th day', () => {
  const labels = weightXLabels(2026, 10, 1);
  expect(labels.map((tick) => tick.label)).toEqual(['10/01', '10/08', '10/15', '10/22', '10/28']);
  expect(labels[0].position).toBe(0);
  expect(labels[labels.length - 1].position).toBe(1);
  expect(labels).toHaveLength(5);
});

test('projection years use 4 to 6 labels', () => {
  const labels = yearXLabels(2026, 2036);
  expect(labels.map((tick) => tick.label)).toEqual(['2026', '2028', '2030', '2032', '2034', '2036']);
  expect(labels).toHaveLength(6);
  expect(labels[0].position).toBe(0);
  expect(labels[labels.length - 1].position).toBe(1);
});

test('a 220-tall chart places the grid and the axis from that height', () => {
  const height = theme.layout.chartWide;
  expect(height).toBe(220);
  const pad = theme.space.md;
  const inner = height - pad * 2;
  const ticks = [
    { position: 0, zero: false },
    { position: 0.5, zero: false },
    { position: 1, zero: true },
  ];
  const drawn = chartDecorations(ticks, lightColor, height);
  expect(drawn.lines.map((line) => line.y)).toEqual([
    height - pad,
    height - pad - 0.5 * inner,
    pad,
  ]);
  expect(drawn.lines[2].stroke).toBe(lightColor.muted);
  expect(drawn.axis).toEqual({ stroke: lightColor.chartAxis, top: pad, bottom: height - pad });
  expect(tickOffset(0, height)).toBe(height - pad);
  expect(tickOffset(1, height)).toBe(pad);
});

test('grid lines stay at 25/50/75% until ticks are passed, then sit on the ticks', () => {
  const height = theme.layout.chart;
  const pad = theme.space.md;
  const inner = height - pad * 2;
  const plain = chartDecorations(undefined, lightColor, height);
  expect(plain.axis).toBeNull();
  expect(plain.lines.map((line) => line.y)).toEqual([0.25, 0.5, 0.75].map((position) => height - pad - position * inner));
  expect(plain.lines.every((line) => line.stroke === lightColor.line)).toBe(true);

  const ticks = weightAxis([72, 76, 80]);
  const drawn = chartDecorations(ticks, lightColor, height);
  expect(drawn.lines.map((line) => line.y)).toEqual(ticks.map((tick) => tickOffset(tick.position, height)));
  expect(drawn.lines.every((line) => line.stroke === lightColor.chartGrid)).toBe(true);
  expect(drawn.axis).toEqual({
    stroke: lightColor.chartAxis,
    top: pad,
    bottom: height - pad,
  });

  const crossed = moneyAxis([-20_000, 80_000]);
  const signed = chartDecorations(crossed, lightColor, height);
  const zero = crossed.findIndex((tick) => tick.zero);
  expect(signed.lines[zero].stroke).toBe(lightColor.muted);
  expect(signed.lines.filter((line) => line.stroke === lightColor.chartGrid).length).toBe(crossed.length - 1);
});
