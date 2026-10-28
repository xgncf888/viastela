/** How long a normal network request may run before the UI gives up. */
export const REQUEST_TIMEOUT_MS = 8000;

/**
 * Quotes edge function. Same budget as a normal request.
 * Pages and the quotes client import this instead of writing the number.
 */
export const QUOTES_TIMEOUT_MS = REQUEST_TIMEOUT_MS;

/** Wait before a loading skeleton, so a fast response does not flash. */
export const SKELETON_DELAY_MS = 1000;
