import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme, type AppTheme } from './ThemeProvider';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Tone = 'ink' | 'muted' | 'inverse' | 'accent' | 'onAccent' | 'danger' | 'moss' | 'warning';

export function visibleButtonLabel(label: string, loading: boolean, loadingLabel?: string): string {
  if (loading && loadingLabel) return loadingLabel;
  return label;
}

/** Ignore layout ticks while loading so the locked width stays the resting width. */
export function nextMeasuredWidth(current: number | null, next: number, loading: boolean): number | null {
  return loading ? current : next;
}

/** `minWidth` while loading, taken from the width measured before the spinner appeared. */
export function lockedButtonMinWidth(measured: number | null, loading: boolean): number | null {
  if (!loading || measured == null) return null;
  return measured;
}

function colorForTone(theme: AppTheme, tone: Tone): string {
  if (tone === 'onAccent') return theme.color.accentInk;
  if (tone === 'inverse') return theme.color.onToast;
  if (tone === 'danger') return theme.color.danger;
  if (tone === 'accent') return theme.color.accentText;
  if (tone === 'moss') return theme.color.moss;
  if (tone === 'warning') return theme.color.warning;
  if (tone === 'muted') return theme.color.muted;
  return theme.color.ink;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  tone,
  disabled = false,
  loading = false,
  loadingLabel,
  fill = false,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Ghost stays accent unless this asks for danger. `accent` uses `accentText` on the label. */
  tone?: 'danger' | 'accent';
  disabled?: boolean;
  loading?: boolean;
  /** Shown in place of `label` while loading. Omit it to keep the resting label. */
  loadingLabel?: string;
  /** Stretch to the column so stacked buttons share one width. */
  fill?: boolean;
  /** Overrides the accessible name. The visible label stays `label`. */
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(false);
  const [measured, setMeasured] = useState<number | null>(null);
  const [seenLoading, setSeenLoading] = useState(loading);
  const [locked, setLocked] = useState<number | null>(null);
  if (seenLoading !== loading) {
    setSeenLoading(loading);
    setLocked(lockedButtonMinWidth(measured, loading));
  }
  const inactive = disabled || loading;
  const visible = visibleButtonLabel(label, loading, loadingLabel);
  const hot = hovered && !inactive;
  const background =
    variant === 'primary'
      ? hot
        ? theme.color.accentHover
        : theme.color.accent
      : variant === 'danger'
        ? theme.color.dangerFill
        : variant === 'secondary'
          ? hot
            ? theme.color.fill
            : 'transparent'
          : hot
            ? tone === 'danger'
              ? theme.color.dangerSoft
              : theme.color.accentSoft
            : 'transparent';
  const labelTone: Tone =
    variant === 'primary'
      ? 'onAccent'
      : variant === 'danger'
        ? 'inverse'
        : variant === 'ghost'
          ? tone === 'danger'
            ? 'danger'
            : 'accent'
          : tone === 'accent'
            ? 'accent'
            : 'ink';
  const spinner = colorForTone(theme, labelTone);

  function onLayout(event: LayoutChangeEvent) {
    const next = nextMeasuredWidth(measured, event.nativeEvent.layout.width, loading);
    if (next !== measured) setMeasured(next);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? visible}
      accessibilityState={{ disabled: inactive, busy: loading }}
      aria-busy={loading ? true : undefined}
      disabled={inactive}
      onLayout={onLayout}
      onPress={() => {
        if (inactive) return;
        onPress();
      }}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: background,
          borderColor: variant === 'secondary' ? theme.color.line : 'transparent',
          transform: pressed && !inactive ? [{ translateY: 1 }] : undefined,
        },
        variant === 'primary' && !inactive
          ? {
              shadowColor: theme.color.accent,
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.25,
              shadowRadius: 2,
              elevation: 1,
            }
          : null,
        disabled ? { opacity: 0.55 } : null,
        fill ? styles.fill : null,
        locked != null ? { minWidth: locked } : null,
      ]}
    >
      {loading ? (
        <View style={styles.content}>
          <ActivityIndicator
            accessibilityElementsHidden
            importantForAccessibility="no"
            aria-hidden
            color={spinner}
            size={theme.space.md}
          />
          <Text variant="body" tone={labelTone} style={styles.label}>
            {visible}
          </Text>
        </View>
      ) : (
        <Text variant="body" tone={labelTone} style={styles.label}>
          {visible}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: baseTheme.layout.control,
    borderRadius: baseTheme.radius.sm,
    borderWidth: baseTheme.border.width,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: baseTheme.space.md,
    paddingVertical: baseTheme.space.sm,
    minWidth: baseTheme.layout.control,
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: baseTheme.space.sm,
  },
  label: { fontWeight: '500' },
  fill: { alignSelf: 'stretch', width: '100%' },
});
