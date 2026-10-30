/**
 * Y-axis ticks from DESIGN.md §6.
 * Pure numbers and labels. Pixel placement stays in the chart.
 */

const MANTISSA = [1, 2, 2.5, 5] as const;
const MIN_TICKS = 3;
const MAX_TICKS = 5;

/** DESIGN.md §6. Weight never steps finer than half a kilogram. */
const WEIGHT_MIN_STEP = 0.5;
/** DESIGN.md §6. A span below this is drawn around the median, ±0.5 kg. */
const WEIGHT_TIGHT_SPAN = 0.8;
const WEIGHT_TIGHT_PAD = 0.5;

export type ChartTick = {
  /** 0 is the bottom of the plot, 1 is the top. */
  position: number;
  label: string;
  /** Data value. The legacy weight chart uses these as its y domain. */
  value: number;
  /** Draw this grid line in `muted` instead of `chartGrid`. */
  zero: boolean;
};

/** Lowest and highest tick values, when every tick has a finite value. */
export function tickValueDomain(ticks: readonly Pick<ChartTick, 'value'>[] | undefined): { min: number; max: number } | null {
  if (!ticks || ticks.length < 2) return null;
  const values: number[] = [];
  for (const tick of ticks) {
    if (typeof tick.value !== 'number' || !Number.isFinite(tick.value)) return null;
    values.push(tick.value);
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return null;
  return { min, max };
}

/**
 * 3–5 ticks. Step is {1, 2, 2.5, 5} × 10ⁿ.
 * Bounds round outward to a multiple of the step.
 */
export function niceAxis(
  min: number,
  max: number,
  options?: { minStep?: number },
): { min: number; max: number; step: number; values: number[] } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('Axis bounds must be finite');
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  const minStep = options?.minStep ?? 0;
  if (hi === lo) hi = lo + (minStep > 0 ? minStep : 1);

  let best: { step: number; values: number[] } | null = null;
  for (const step of niceSteps(hi - lo, minStep)) {
    const values = cover(lo, hi, step);
    if (values.length < MIN_TICKS || values.length > MAX_TICKS) continue;
    if (!best || preferAxis(values, step, best.values, best.step)) best = { step, values };
  }
  if (!best) {
    const step = Math.max(minStep, 1);
    best = { step, values: cover(lo, hi, step).slice(0, MAX_TICKS) };
  }
  return {
    min: best.values[0],
    max: best.values[best.values.length - 1],
    step: best.step,
    values: best.values,
  };
}

/** Plain numbers, or the compact money form `0 / 200k / 1.2M`. The unit is not included. */
export function formatChartTick(value: number, format: 'plain' | 'compact'): string {
  if (!Number.isFinite(value)) throw new Error('Tick value must be finite');
  if (format === 'plain') return trimNumber(value);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}${trimNumber(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trimNumber(abs / 1_000)}k`;
  return trimNumber(value);
}

/** Weight y axis. Minimum step 0.5 kg. A span under 0.8 kg is median ± 0.5 kg. */
export function weightAxis(values: readonly number[]): ChartTick[] {
  const finite = finiteValues(values);
  const sorted = [...finite].sort((a, b) => a - b);
  const span = sorted[sorted.length - 1] - sorted[0];
  const lo = span < WEIGHT_TIGHT_SPAN ? median(sorted) - WEIGHT_TIGHT_PAD : sorted[0];
  const hi = span < WEIGHT_TIGHT_SPAN ? median(sorted) + WEIGHT_TIGHT_PAD : sorted[sorted.length - 1];
  return ticksFrom(niceAxis(lo, hi, { minStep: WEIGHT_MIN_STEP }), 'plain');
}

/**
 * Money y axis. A non-negative minimum starts at 0.
 * A negative value keeps 0 on the axis and marks that tick.
 * All zeros use a minimum step of 1 so the domain has a width.
 */
export function moneyAxis(values: readonly number[], options?: { minStep?: number }): ChartTick[] {
  const finite = finiteValues(values);
  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  const crossesZero = dataMin < 0;
  const lo = crossesZero ? dataMin : 0;
  const hi = crossesZero ? Math.max(dataMax, 0) : dataMax;
  const allZero = finite.every((value) => value === 0);
  const minStep = options?.minStep ?? (allZero ? 1 : 0);
  return ticksFrom(niceAxis(lo, hi, minStep > 0 ? { minStep } : undefined), 'compact', crossesZero);
}

/**
 * Projection y ticks. Same values as `moneyAxis`.
 * Non-negative data floors at 0. The chart leaves room above the x-axis in the plot, not by adding a negative tick.
 */
export function projectionMoneyAxis(values: readonly number[]): ChartTick[] {
  return moneyAxis(values);
}

function ticksFrom(
  axis: { min: number; max: number; values: number[] },
  format: 'plain' | 'compact',
  zeroLine = false,
): ChartTick[] {
  const span = axis.max - axis.min;
  return axis.values.map((value) => ({
    value,
    position: span === 0 ? 0 : (value - axis.min) / span,
    label: formatChartTick(value, format),
    zero: zeroLine && Math.abs(value) < 1e-9,
  }));
}

function finiteValues(values: readonly number[]): number[] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) throw new Error('Axis needs a finite value');
  return finite;
}

function median(sorted: readonly number[]): number {
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

function niceSteps(span: number, minStep: number): number[] {
  const anchor = Math.max(span, minStep, 1e-9);
  const exp = Math.floor(Math.log10(anchor));
  const steps: number[] = [];
  for (let power = exp - 2; power <= exp + 3; power += 1) {
    const base = 10 ** power;
    for (const mantissa of MANTISSA) {
      const step = mantissa * base;
      if (step + 1e-12 >= minStep) steps.push(step);
    }
  }
  return steps;
}

/** Round outward onto the step, then extend until there are at least 3 ticks. */
function cover(min: number, max: number, step: number): number[] {
  const factor = 10 ** decimalsOf(step);
  const stepInt = Math.round(step * factor);
  let start = Math.floor((min * factor) / stepInt + 1e-8) * stepInt;
  let end = Math.ceil((max * factor) / stepInt - 1e-8) * stepInt;
  let guard = 0;
  while ((end - start) / stepInt + 1 < MIN_TICKS && guard < 8) {
    end += stepInt;
    guard += 1;
  }
  const count = Math.round((end - start) / stepInt) + 1;
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push((start + index * stepInt) / factor);
  }
  return values;
}

function decimalsOf(step: number): number {
  for (let decimals = 0; decimals <= 8; decimals += 1) {
    const factor = 10 ** decimals;
    if (Math.abs(step * factor - Math.round(step * factor)) < 1e-6) return decimals;
  }
  return 8;
}

/** Prefer 4 ticks, then 5, then 3. Then the tighter domain, then the smaller step. */
function preferAxis(values: number[], step: number, otherValues: number[], otherStep: number): boolean {
  const rank = tickRank(values.length) - tickRank(otherValues.length);
  if (rank !== 0) return rank < 0;
  const span = values[values.length - 1] - values[0];
  const otherSpan = otherValues[otherValues.length - 1] - otherValues[0];
  if (span !== otherSpan) return span < otherSpan;
  return step < otherStep;
}

function tickRank(count: number): number {
  if (count === 4) return 0;
  if (count === 5) return 1;
  return 2;
}

function trimNumber(value: number): string {
  const negative = value < 0;
  const text = Math.abs(value).toFixed(6).replace(/\.?0+$/, '');
  return `${negative ? '-' : ''}${text === '' ? '0' : text}`;
}
