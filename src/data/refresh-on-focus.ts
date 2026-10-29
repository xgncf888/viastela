import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';

/** Ignore a second focus that arrives before the person has really left and come back. */
export const REFRESH_MIN_INTERVAL_MS = 400;

/**
 * Run `load` when the screen comes back after a real blur.
 * The first focus is skipped, so a screen that already loads on mount does not load again.
 * `useFocusEffect` also re-invokes its callback when the navigation object changes, with no blur.
 * That re-entry is not a return visit and does not load.
 */
export function useRefreshOnFocus(load: () => void | Promise<unknown>): void {
  const loadRef = useRef(load);
  const left = useRef(false);
  const inFlight = useRef(false);
  const lastAt = useRef(0);
  /** `leaving` until a newer focus callback replaces it. A microtask then confirms the blur. */
  const phase = useRef<'idle' | 'focused' | 'leaving'>('idle');

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  const onFocus = useCallback(() => {
    phase.current = 'focused';
    if (left.current) {
      left.current = false;
      const now = Date.now();
      if (!inFlight.current && now - lastAt.current >= REFRESH_MIN_INTERVAL_MS) {
        lastAt.current = now;
        inFlight.current = true;
        void Promise.resolve()
          .then(() => loadRef.current())
          .finally(() => {
            inFlight.current = false;
          });
      }
    }
    return () => {
      phase.current = 'leaving';
      queueMicrotask(() => {
        if (phase.current === 'leaving') left.current = true;
      });
    };
  }, []);

  useFocusEffect(onFocus);
}
