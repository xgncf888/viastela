import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View, type TextStyle } from 'react-native';

import { Button } from './Button';
import { Callout } from './layout';
import { useLoadGate } from './use-load-gate';

export const LOADING_REGION_NAMES = ['今日', '体重记录', '训练记录', '学习记录', '资产', '账户列表', '趋势图'] as const;

export type LoadingRegionName = (typeof LOADING_REGION_NAMES)[number];

export const LOAD_ERROR_TEXT = '没加载出来，检查网络后再试';
export const LOAD_RETRY_LABEL = '重试';

export function loadingStatusLabel(name: string): string {
  return `正在加载${name}`;
}

/** Timeout and a caller-supplied error both replace the skeleton with the callout. */
export function showLoadError(timedOut: boolean, error: boolean | undefined): boolean {
  return error === true || timedOut;
}

/**
 * First-load slot. The skeleton waits out the delay, then stays for the minimum
 * hold. The status node and `aria-busy` attach only once the skeleton is on
 * screen, so a response inside the delay is not announced. Both leave the tree
 * when the content or the error card is shown. Retry bumps `attempt`, which
 * restarts the delay and the timeout.
 */
export function LoadingRegion({
  name,
  loading,
  skeleton,
  children,
  error,
  onRetry,
}: {
  name: LoadingRegionName;
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  error?: boolean;
  onRetry: () => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const gate = useLoadGate(loading, attempt);
  const failed = showLoadError(gate.timedOut, error);
  const pending = gate.busy && !failed;
  // §17.1: the live region waits until the skeleton is actually painted.
  const announced = gate.showSkeleton && !failed;

  function retry() {
    setAttempt((current) => current + 1);
    onRetry();
  }

  useEffect(() => {
    if (!failed || Platform.OS !== 'ios') return undefined;
    AccessibilityInfo.announceForAccessibility(LOAD_ERROR_TEXT);
    return undefined;
  }, [failed]);

  return (
    <View {...(announced ? { accessibilityState: { busy: true as const }, 'aria-busy': true as const } : {})}>
      {announced ? (
        <Text accessibilityLiveRegion="polite" role="status" style={hiddenStatusStyle}>
          {loadingStatusLabel(name)}
        </Text>
      ) : null}
      {failed ? (
        <View accessibilityRole="alert">
          <Callout
            message={LOAD_ERROR_TEXT}
            action={<Button label={LOAD_RETRY_LABEL} variant="secondary" tone="accent" onPress={retry} />}
          />
        </View>
      ) : gate.showSkeleton ? (
        skeleton
      ) : null}
      {pending || failed ? null : children}
    </View>
  );
}

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});

/**
 * Visually hidden, but still read. Clip keeps the 1px box from painting a
 * glyph on the web; the node stays in the tree for the status role.
 */
const webStatusClip = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
} as unknown as TextStyle;

const hiddenStatusStyle = Platform.OS === 'web' ? webStatusClip : styles.hidden;
