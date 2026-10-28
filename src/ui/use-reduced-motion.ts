import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

function webPrefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * `true` when motion should stay still, `false` when it may run.
 * `null` on native until `AccessibilityInfo` answers, so a skeleton does not
 * breathe for a frame and then freeze.
 */
export function useReducedMotion(): boolean | null {
  const [value, setValue] = useState<boolean | null>(() => (Platform.OS === 'web' ? webPrefersReducedMotion() : null));

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const apply = () => setValue(media.matches);
      apply();
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }

    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setValue(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setValue(enabled);
    });
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return value;
}
