import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, Text, View } from 'react-native';

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

/**
 * The error card is opt-in. A timed-out load keeps the skeleton unless the
 * caller passed `onRetry` or a truthy `error`, so existing call sites stay put.
 */
export function showLoadError(timedOut: boolean, error: boolean | undefined, onRetry: (() => void) | undefined): boolean {
  if (error) return true;
  return timedOut && onRetry !== undefined;
}

/**
 * First-load slot. The skeleton waits out the delay, then stays for the minimum
 * hold. While that is true the container is busy and a status node is mounted;
 * both leave the tree when the content or the error card is shown.
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
  onRetry?: () => void;
}) {
  const gate = useLoadGate(loading);
  const failed = showLoadError(gate.timedOut, error, onRetry);
  const busy = gate.busy && !failed;

  useEffect(() => {
    if (!failed || Platform.OS !== 'ios') return undefined;
    AccessibilityInfo.announceForAccessibility(LOAD_ERROR_TEXT);
    return undefined;
  }, [failed]);

  return (
    <View {...(busy ? { accessibilityState: { busy: true as const }, 'aria-busy': true as const } : {})}>
      {busy ? (
        <Text accessibilityLiveRegion="polite" role="status" style={styles.hidden}>
          {loadingStatusLabel(name)}
        </Text>
      ) : null}
      {failed ? (
        <View accessibilityRole="alert">
          <Callout
            message={LOAD_ERROR_TEXT}
            action={<Button label={LOAD_RETRY_LABEL} variant="secondary" onPress={() => onRetry?.()} />}
          />
        </View>
      ) : gate.showSkeleton ? (
        skeleton
      ) : null}
      {busy || failed ? null : children}
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
