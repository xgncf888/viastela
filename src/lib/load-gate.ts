import { LOAD_TIMEOUT_MS, LOADING_DELAY_MS, LOADING_MIN_VISIBLE_MS } from './timing';

export type LoadPhase = 'idle' | 'delay' | 'skeleton' | 'hold' | 'timeout';

export type LoadMemory = {
  phase: LoadPhase;
  startedAt: number | null;
  shownAt: number | null;
};

export type LoadDecision = LoadMemory & {
  showSkeleton: boolean;
  busy: boolean;
  timedOut: boolean;
};

export const idleMemory: LoadMemory = { phase: 'idle', startedAt: null, shownAt: null };

export function sameMemory(left: LoadMemory, right: LoadMemory): boolean {
  return left.phase === right.phase && left.startedAt === right.startedAt && left.shownAt === right.shownAt;
}

function pack(
  phase: LoadPhase,
  startedAt: number | null,
  shownAt: number | null,
  showSkeleton: boolean,
  busy: boolean,
  timedOut: boolean,
): LoadDecision {
  return { phase, startedAt, shownAt, showSkeleton, busy, timedOut };
}

/**
 * One frame of the loading clock.
 * A skeleton appears only after the delay, then stays for the minimum hold.
 * The timeout is measured from the start of the episode, not from the skeleton.
 */
export function decideLoad(input: { loading: boolean; now: number; memory: LoadMemory }): LoadDecision {
  const { loading, now, memory } = input;

  if (!loading) {
    const holding =
      (memory.phase === 'skeleton' || memory.phase === 'hold') &&
      memory.shownAt !== null &&
      now - memory.shownAt < LOADING_MIN_VISIBLE_MS;
    if (holding) {
      return pack('hold', memory.startedAt, memory.shownAt, true, true, false);
    }
    return pack('idle', null, null, false, false, false);
  }

  // A new load during the minimum visible window keeps the skeleton. Going
  // back to `delay` would hide it and wait another second.
  if (
    memory.phase === 'hold' &&
    memory.shownAt !== null &&
    now - memory.shownAt < LOADING_MIN_VISIBLE_MS
  ) {
    return pack('skeleton', now - LOADING_DELAY_MS, memory.shownAt, true, true, false);
  }

  if (memory.phase === 'idle' || memory.phase === 'hold') {
    return pack('delay', now, null, false, true, false);
  }

  const startedAt = memory.startedAt ?? now;
  const elapsed = now - startedAt;
  if (memory.phase === 'timeout' || elapsed >= LOAD_TIMEOUT_MS) {
    const shownAt = memory.shownAt ?? (elapsed >= LOADING_DELAY_MS ? startedAt + LOADING_DELAY_MS : null);
    return pack('timeout', startedAt, shownAt, true, true, true);
  }
  if (elapsed < LOADING_DELAY_MS) {
    return pack('delay', startedAt, null, false, true, false);
  }
  return pack('skeleton', startedAt, memory.shownAt ?? now, true, true, false);
}

/** Milliseconds until the next phase boundary, or null when the clock can sleep. */
export function wakeDelay(
  input: { phase: LoadPhase; startedAt: number | null; shownAt: number | null },
  now: number,
): number | null {
  if (input.phase === 'delay' && input.startedAt !== null) {
    const wait = input.startedAt + LOADING_DELAY_MS - now;
    return wait > 0 ? wait : null;
  }
  if (input.phase === 'skeleton' && input.startedAt !== null) {
    const wait = input.startedAt + LOAD_TIMEOUT_MS - now;
    return wait > 0 ? wait : null;
  }
  if (input.phase === 'hold' && input.shownAt !== null) {
    const wait = input.shownAt + LOADING_MIN_VISIBLE_MS - now;
    return wait > 0 ? wait : null;
  }
  return null;
}
