import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

export type ToastInput = {
  text: string;
  tone?: 'ok' | 'error';
};

type ToastMessage = ToastInput & { id: number; tone: 'ok' | 'error' };

let current: ToastMessage | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function showToast(toast: ToastInput): void {
  if (timer) clearTimeout(timer);
  const tone = toast.tone ?? 'ok';
  current = { ...toast, tone, id: nextId };
  nextId += 1;
  emit();
  timer = setTimeout(() => {
    current = null;
    emit();
  }, tone === 'error' ? 4200 : 2600);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ToastMessage | null {
  return current;
}

export function ToastHost() {
  const toast = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  if (!toast) return null;
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + baseTheme.layout.tabBar }]}>
      <Pressable
        accessibilityRole="alert"
        onPress={() => {
          current = null;
          emit();
        }}
        style={[
          styles.toast,
          { backgroundColor: toast.tone === 'error' ? theme.color.dangerFill : theme.color.toast },
        ]}
      >
        <Text variant="body" tone="inverse">
          {toast.text}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: baseTheme.space.lg,
  },
  toast: {
    minHeight: baseTheme.layout.control,
    borderRadius: baseTheme.radius.pill,
    paddingHorizontal: baseTheme.space.lg,
    paddingVertical: baseTheme.space.sm,
    maxWidth: baseTheme.layout.content,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
