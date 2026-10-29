import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';

import { formatQuoteClock } from '@/core/quote-label';

import { Text } from './Text';
import { theme } from './theme';

export const REFRESHING_TEXT = '正在更新…';
export const REFRESH_FAILED_TEXT = '更新失败';
export const REFRESH_RETRY_LABEL = '重试';
export const REFRESH_CACHED_PREFIX = '行情更新于';

/** User-timezone clock. Invalid timestamps return null so the plain retry line stays. */
export function cachedQuoteClock(asOf: string | null | undefined, timeZone: string): string | null {
  if (!asOf || Number.isNaN(new Date(asOf).getTime())) return null;
  return formatQuoteClock(asOf, timeZone);
}

export function refreshFailedText(cachedAt: string | null | undefined, timeZone: string): string {
  const clock = cachedQuoteClock(cachedAt, timeZone);
  if (clock) return `${REFRESH_FAILED_TEXT} · ${REFRESH_CACHED_PREFIX} ${clock} · ${REFRESH_RETRY_LABEL}`;
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
  timeZone,
}: {
  status: 'idle' | 'refreshing' | 'failed';
  onRetry: () => void;
  idle?: ReactNode;
  /** ISO time of the last cached quote. */
  cachedAt?: string | null;
  /** Profile timezone. The cached clock is formatted with this, not the device zone. */
  timeZone: string;
}) {
  useEffect(() => {
    if (status !== 'failed' || Platform.OS !== 'ios') return undefined;
    AccessibilityInfo.announceForAccessibility(`${REFRESH_FAILED_TEXT}`);
    return undefined;
  }, [status]);

  const clock = cachedQuoteClock(cachedAt, timeZone);
  const lead = clock ? `${REFRESH_FAILED_TEXT} · ${REFRESH_CACHED_PREFIX} ${clock} · ` : `${REFRESH_FAILED_TEXT} · `;
  return (
    <View style={styles.slot}>
      {status === 'idle' ? (
        idle
      ) : status === 'refreshing' ? (
        <Text variant="muted" accessibilityLiveRegion="none">
          {REFRESHING_TEXT}
        </Text>
      ) : (
        <View
          accessibilityLiveRegion={Platform.OS === 'android' ? 'polite' : undefined}
          role={Platform.OS === 'web' ? 'status' : undefined}
          style={styles.row}
        >
          <Text variant="muted" tone={clock ? 'warning' : undefined}>
            {lead}
          </Text>
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
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  /** Always the status-line height, so the message does not push the page. */
  slot: {
    height: theme.lineHeight.sm,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  retry: {
    justifyContent: 'center',
  },
});
