import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { theme } from './theme';

export const REFRESHING_TEXT = '正在更新…';
export const REFRESH_FAILED_TEXT = '更新失败';
export const REFRESH_RETRY_LABEL = '重试';
export const REFRESH_CACHED_PREFIX = '行情更新于';

/** Local clock, zero-padded. Invalid timestamps return null so the retry line stays. */
export function formatRefreshClock(asOf: string): string | null {
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) return null;
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

export function refreshFailedText(cachedAt?: string | null): string {
  const clock = cachedAt ? formatRefreshClock(cachedAt) : null;
  if (clock) return `${REFRESH_FAILED_TEXT} · ${REFRESH_CACHED_PREFIX} ${clock}`;
  return `${REFRESH_FAILED_TEXT} · ${REFRESH_RETRY_LABEL}`;
}

/**
 * Background refresh line. Idle can show the caller's own "更新于" text.
 * "正在更新…" is not announced. "更新失败" is announced once.
 */
export function RefreshStatus({
  status,
  onRetry,
  idle = null,
  cachedAt = null,
}: {
  status: 'idle' | 'refreshing' | 'failed';
  onRetry: () => void;
  idle?: ReactNode;
  /** ISO time of the last cached quote. Failed status then shows the local clock instead of retry. */
  cachedAt?: string | null;
}) {
  useEffect(() => {
    if (status !== 'failed' || Platform.OS !== 'ios') return undefined;
    AccessibilityInfo.announceForAccessibility(`${REFRESH_FAILED_TEXT}`);
    return undefined;
  }, [status]);

  if (status === 'idle') return <>{idle}</>;
  if (status === 'refreshing') {
    return (
      <Text variant="muted" accessibilityLiveRegion="none">
        {REFRESHING_TEXT}
      </Text>
    );
  }
  const clock = cachedAt ? formatRefreshClock(cachedAt) : null;
  if (clock) {
    return (
      <Text
        variant="muted"
        accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}
        role={Platform.OS === 'web' ? 'status' : undefined}
      >
        {refreshFailedText(cachedAt)}
      </Text>
    );
  }
  return (
    <View
      accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}
      role={Platform.OS === 'web' ? 'status' : undefined}
      style={styles.row}
    >
      <Text variant="muted">{`${REFRESH_FAILED_TEXT} · `}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={REFRESH_RETRY_LABEL}
        hitSlop={{ top: theme.space.sm, bottom: theme.space.sm, left: theme.space.sm, right: theme.space.sm }}
        onPress={onRetry}
        style={styles.retry}
      >
        <Text variant="body" tone="accent">
          {REFRESH_RETRY_LABEL}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  retry: {
    justifyContent: 'center',
    minHeight: theme.layout.control,
  },
});
