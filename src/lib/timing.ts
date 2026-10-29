/** Wait this long before a skeleton, so a fast response does not flash. */
export const LOADING_DELAY_MS = 1000;

/** Once a skeleton is on screen, keep it up at least this long. */
export const LOADING_MIN_VISIBLE_MS = 400;

/**
 * Give up on a load and enter the error state.
 * The quotes client uses the same budget via {@link QUOTES_TIMEOUT_MS}.
 */
export const LOAD_TIMEOUT_MS = 8000;

/** One breath of a skeleton: opaque, then dim, then opaque again. */
export const PULSE_DURATION_MS = 1600;

/**
 * Quotes edge function. Same budget as {@link LOAD_TIMEOUT_MS}.
 * Pages and the quotes client import this instead of writing the number.
 */
export const QUOTES_TIMEOUT_MS = LOAD_TIMEOUT_MS;
