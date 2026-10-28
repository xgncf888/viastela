import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLoadGate } from './use-load-gate';

export const LOADING_REGION_NAMES = ['今日', '体重记录', '训练记录', '学习记录', '资产', '账户列表', '趋势图'] as const;

export type LoadingRegionName = (typeof LOADING_REGION_NAMES)[number];

export function loadingStatusLabel(name: string): string {
  return `正在加载${name}`;
}

/**
 * First-load slot. The skeleton waits out the delay, then stays for the minimum
 * hold. While that is true the container is busy and a status node is mounted;
 * both leave the tree when the content is shown. They are not hidden in place.
 */
export function LoadingRegion({
  name,
  loading,
  skeleton,
  children,
}: {
  name: LoadingRegionName;
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
}) {
  const gate = useLoadGate(loading);
  const busy = gate.busy;
  return (
    <View {...(busy ? { accessibilityState: { busy: true as const }, 'aria-busy': true as const } : {})}>
      {busy ? (
        <Text accessibilityLiveRegion="polite" role="status" style={styles.hidden}>
          {loadingStatusLabel(name)}
        </Text>
      ) : null}
      {gate.showSkeleton ? skeleton : null}
      {busy ? null : children}
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
