import { expect, test } from '@jest/globals';

import { decideLoad, idleMemory, wakeDelay, type LoadMemory } from '@/lib/load-gate';
import { LOAD_TIMEOUT_MS, LOADING_DELAY_MS, LOADING_MIN_VISIBLE_MS } from '@/lib/timing';

const start = 10_000;

function at(memory: LoadMemory, loading: boolean, now: number) {
  return decideLoad({ loading, now, memory });
}

test('a response inside the delay never shows a skeleton', () => {
  const waiting = at(idleMemory, true, start);
  expect(waiting).toMatchObject({ phase: 'delay', showSkeleton: false, busy: true, timedOut: false, startedAt: start });
  expect(wakeDelay(waiting, start)).toBe(LOADING_DELAY_MS);

  const stillWaiting = at(waiting, true, start + LOADING_DELAY_MS - 1);
  expect(stillWaiting.showSkeleton).toBe(false);
  expect(stillWaiting.busy).toBe(true);

  const done = at(stillWaiting, false, start + LOADING_DELAY_MS - 1);
  expect(done).toMatchObject({ phase: 'idle', showSkeleton: false, busy: false, timedOut: false });
  expect(wakeDelay(done, start + LOADING_DELAY_MS - 1)).toBeNull();
});

test('a skeleton stays up for the minimum hold after the load finishes', () => {
  const waiting = at(idleMemory, true, start);
  const shown = at(waiting, true, start + LOADING_DELAY_MS);
  expect(shown).toMatchObject({
    phase: 'skeleton',
    showSkeleton: true,
    busy: true,
    timedOut: false,
    shownAt: start + LOADING_DELAY_MS,
  });
  expect(wakeDelay(shown, start + LOADING_DELAY_MS)).toBe(LOAD_TIMEOUT_MS - LOADING_DELAY_MS);

  const finished = at(shown, false, start + LOADING_DELAY_MS + 100);
  expect(finished).toMatchObject({ phase: 'hold', showSkeleton: true, busy: true });
  expect(wakeDelay(finished, start + LOADING_DELAY_MS + 100)).toBe(LOADING_MIN_VISIBLE_MS - 100);

  const stillHeld = at(finished, false, start + LOADING_DELAY_MS + LOADING_MIN_VISIBLE_MS - 1);
  expect(stillHeld.showSkeleton).toBe(true);

  const released = at(stillHeld, false, start + LOADING_DELAY_MS + LOADING_MIN_VISIBLE_MS);
  expect(released).toMatchObject({ phase: 'idle', showSkeleton: false, busy: false });
});

test('a load that is still running at the timeout is timed out', () => {
  const waiting = at(idleMemory, true, start);
  const shown = at(waiting, true, start + LOADING_DELAY_MS);
  const before = at(shown, true, start + LOAD_TIMEOUT_MS - 1);
  expect(before).toMatchObject({ phase: 'skeleton', timedOut: false, showSkeleton: true });

  const timedOut = at(before, true, start + LOAD_TIMEOUT_MS);
  expect(timedOut).toMatchObject({ phase: 'timeout', timedOut: true, busy: true, showSkeleton: true });
  expect(wakeDelay(timedOut, start + LOAD_TIMEOUT_MS)).toBeNull();

  const cleared = at(timedOut, false, start + LOAD_TIMEOUT_MS);
  expect(cleared.phase).toBe('idle');
  expect(cleared.timedOut).toBe(false);
});
