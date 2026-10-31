import { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dismissQueuedToast, emptyToastQueue, enqueueToast } from '@/core/toast-queue';

import { layoutClassForWidth } from './layout-class';
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
  /** Stays up until it is dismissed. Normal toasts wait behind it. Error toasts stack above it. */
  pinned?: boolean;
};

type ToastMessage = {
  id: number;
  text: string;
  tone: 'ok' | 'error';
  action?: ToastAction;
  pinned?: boolean;
  duration: number;
};

type Snapshot = {
  errors: readonly ToastMessage[];
  current: ToastMessage | null;
  pinned: ToastMessage | null;
};

let state = emptyToastQueue<ToastMessage>();
let nextId = 1;
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const listeners = new Set<() => void>();
let snapshot: Snapshot = { errors: [], current: null, pinned: null };

function clearTimer(id: number) {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
}

function publish() {
  snapshot = {
    errors: state.errors,
    current: state.current,
    pinned: state.pinned,
  };
  const visible = new Set<number>();
  for (const toast of state.errors) visible.add(toast.id);
  if (state.current) visible.add(state.current.id);
  if (state.pinned) visible.add(state.pinned.id);
  for (const id of [...timers.keys()]) {
    if (!visible.has(id)) clearTimer(id);
  }
  const arm = (toast: ToastMessage | null) => {
    if (!toast || timers.has(toast.id)) return;
    timers.set(
      toast.id,
      setTimeout(() => {
        timers.delete(toast.id);
        state = dismissQueuedToast(state, toast.id);
        publish();
      }, toast.duration),
    );
  };
  for (const toast of state.errors) arm(toast);
  arm(state.current);
  arm(state.pinned);
  listeners.forEach((listener) => listener());
}

function dismissToast(id?: number) {
  const target = id ?? state.pinned?.id ?? state.current?.id;
  if (target == null) return;
  state = dismissQueuedToast(state, target);
  publish();
}

export function dismissShownToast(): void {
  dismissToast();
}

export function showToast(toast: ToastInput): void {
  const tone = toast.tone ?? 'ok';
  const duration = toast.duration ?? (tone === 'error' ? 4200 : 2600);
  const message: ToastMessage = {
    text: toast.text,
    tone,
    action: toast.action,
    pinned: toast.pinned,
    duration,
    id: nextId,
  };
  nextId += 1;
  state = enqueueToast(state, message);
  publish();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Snapshot {
  return snapshot;
}

function ToastView({ toast }: { toast: ToastMessage }) {
  const theme = useTheme();
  const backgroundColor = toast.tone === 'error' ? theme.color.dangerFill : theme.color.toast;
  if (!toast.action) {
    return (
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={toast.text}
        onPress={() => dismissToast(toast.id)}
        style={[styles.toast, { backgroundColor }]}
      >
        <Text variant="body" tone="inverse">
          {toast.text}
        </Text>
      </Pressable>
    );
  }
  const action = toast.action;
  return (
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
  );
}

export function ToastHost() {
  const toast = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const layout = layoutClassForWidth(width);
  if (toast.errors.length === 0 && !toast.current && !toast.pinned) return null;
  const bottomOffset = layout === 'compact' ? baseTheme.layout.tabBar : baseTheme.space.lg;
  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom: insets.bottom + bottomOffset }]}>
      <View pointerEvents="box-none" style={styles.stack}>
        {toast.errors.map((item) => (
          <ToastView key={item.id} toast={item} />
        ))}
        {toast.current ? <ToastView key={toast.current.id} toast={toast.current} /> : null}
        {toast.pinned ? <ToastView key={toast.pinned.id} toast={toast.pinned} /> : null}
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
  stack: {
    alignItems: 'center',
    gap: baseTheme.space.sm,
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
