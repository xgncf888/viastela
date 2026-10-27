import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

export type ToastAction = {
  label: string;
  onPress: () => void;
};

export type ToastInput = {
  text: string;
  tone?: 'ok' | 'error';
  duration?: number;
  action?: ToastAction;
};

type ToastMessage = {
  id: number;
  text: string;
  tone: 'ok' | 'error';
  action?: ToastAction;
};

let current: ToastMessage | null = null;
let nextId = 1;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function dismissToast(id?: number) {
  if (id != null && current?.id !== id) return;
  if (timer) clearTimeout(timer);
  timer = null;
  current = null;
  emit();
}

export function dismissShownToast(): void {
  dismissToast();
}

export function showToast(toast: ToastInput): void {
  if (timer) clearTimeout(timer);
  const tone = toast.tone ?? 'ok';
  const duration = toast.duration ?? (tone === 'error' ? 4200 : 2600);
  current = { text: toast.text, tone, action: toast.action, id: nextId };
  nextId += 1;
  emit();
  timer = setTimeout(() => {
    timer = null;
    current = null;
    emit();
  }, duration);
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
  const backgroundColor = toast.tone === 'error' ? theme.color.dangerFill : theme.color.toast;
  const hostStyle = [styles.host, { bottom: insets.bottom + baseTheme.layout.tabBar }];
  if (!toast.action) {
    return (
      <View pointerEvents="box-none" style={hostStyle}>
        <Pressable
          accessibilityRole="alert"
          onPress={() => dismissToast(toast.id)}
          style={[styles.toast, { backgroundColor }]}
        >
          <Text variant="body" tone="inverse">
            {toast.text}
          </Text>
        </Pressable>
      </View>
    );
  }
  const action = toast.action;
  return (
    <View pointerEvents="box-none" style={hostStyle}>
      <View accessibilityRole="alert" style={[styles.toast, styles.withAction, { backgroundColor }]}>
        <Text variant="body" tone="inverse">
          {toast.text}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={() => {
            action.onPress();
            dismissToast(toast.id);
          }}
          style={styles.action}
        >
          <Text variant="body" tone="inverse">
            {` · ${action.label}`}
          </Text>
        </Pressable>
      </View>
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
  withAction: {
    flexDirection: 'row',
    paddingVertical: 0,
    paddingRight: baseTheme.space.xs,
  },
  action: {
    minHeight: baseTheme.layout.control,
    minWidth: baseTheme.layout.control,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: baseTheme.space.sm,
  },
});
