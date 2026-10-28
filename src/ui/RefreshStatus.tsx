import { useEffect, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Text } from './Text';
import { theme } from './theme';

export const REFRESHING_TEXT = '正在更新…';
export const REFRESH_FAILED_TEXT = '更新失败';
export const REFRESH_RETRY_LABEL = '重试';

/**
 * Background refresh line. Idle can show the caller's own "更新于" text.
 * "正在更新…" is not announced. "更新失败" is announced once.
 */
export function RefreshStatus({
  status,
  onRetry,
  idle = null,
}: {
  status: 'idle' | 'refreshing' | 'failed';
  onRetry: () => void;
  idle?: ReactNode;
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
        <Text variant="muted">{REFRESH_RETRY_LABEL}</Text>
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
