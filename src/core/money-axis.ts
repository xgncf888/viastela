/**
 * Money y-axis from DESIGN §6.
 * Step is {1, 2, 2.5, 5} × 10ⁿ, with 3–5 ticks and bounds rounded outward.
 * Non-negative amounts start at 0. A negative value keeps 0 inside the domain.
 * `src/core` cannot import `src/ui`, so the projection chart reads this domain directly.
 */

const MANTISSA = [1, 2, 2.5, 5] as const;
const MIN_TICKS = 3;
const MAX_TICKS = 5;

export type MoneyTick = {
  value: number;
};

/** Tick values for a money y-axis. Labels are left to the chart. */
export function moneyAxis(values: readonly number[]): MoneyTick[] {
  const finite = finiteValues(values);
  const dataMin = Math.min(...finite);
  const dataMax = Math.max(...finite);
  const crossesZero = dataMin < 0;
  const lo = crossesZero ? dataMin : 0;
  const hi = crossesZero ? Math.max(dataMax, 0) : dataMax;
  return niceAxis(lo, hi).values.map((value) => ({ value }));
}

/** Inclusive min and max of `moneyAxis`. Projection y is this span, not the raw data span. */
export function moneyAxisDomain(values: readonly number[]): { min: number; max: number } {
  const ticks = moneyAxis(values);
  return {
    min: Math.min(...ticks.map((tick) => tick.value)),
    max: Math.max(...ticks.map((tick) => tick.value)),
  };
}

function finiteValues(values: readonly number[]): number[] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) throw new Error('Axis needs a finite value');
  return finite;
}

function niceAxis(
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
