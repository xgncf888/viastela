import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Run `load` when the screen comes back after a real blur.
 * The first focus is skipped, so a screen that already loads on mount does not load again.
 * `useFocusEffect` also re-invokes its callback when the navigation object changes, with no blur.
 * That re-entry is not a return visit and does not load.
 * A return that arrives while a refresh is running is remembered once and started when it finishes.
 */
export function useRefreshOnFocus(load: () => void | Promise<unknown>): void {
  const loadRef = useRef(load);
  const left = useRef(false);
  const inFlight = useRef(false);
  const pending = useRef(false);
  /** `leaving` until a newer focus callback replaces it. A microtask then confirms the blur. */
  const phase = useRef<'idle' | 'focused' | 'leaving'>('idle');

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const runRef = useRef<() => void>(() => undefined);
  const run = useCallback(() => {
    if (inFlight.current) {
      pending.current = true;
      return;
    }
    inFlight.current = true;
    void Promise.resolve()
      .then(() => loadRef.current())
      .finally(() => {
        inFlight.current = false;
        if (!pending.current) return;
        pending.current = false;
        runRef.current();
      });
  }, []);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const onFocus = useCallback(() => {
    phase.current = 'focused';
    if (left.current) {
      left.current = false;
      run();
    }
    return () => {
      phase.current = 'leaving';
      queueMicrotask(() => {
        if (phase.current === 'leaving') left.current = true;
      });
    };
  }, [run]);

  useFocusEffect(onFocus);
}
