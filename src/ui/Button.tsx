import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme, type AppTheme } from './ThemeProvider';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
/** `mini` is the 28-high outlined button for a ledger row's inline 记录 (§5). */
type Size = 'regular' | 'mini';
type Tone = 'ink' | 'muted' | 'inverse' | 'accent' | 'onAccent' | 'danger' | 'moss' | 'warning';

export function visibleButtonLabel(label: string, loading: boolean, loadingLabel?: string): string {
  if (loading && loadingLabel) return loadingLabel;
  return label;
}

/** Ignore layout ticks while loading so the locked width stays the resting width. */
export function nextMeasuredWidth(current: number | null, next: number, loading: boolean): number | null {
  return loading ? current : next;
}

/** `hitSlop` that grows the 28-high mini button to the 44pt target. */
export const MINI_HIT_SLOP = {
  top: (baseTheme.layout.control - baseTheme.layout.controlMini) / 2,
  bottom: (baseTheme.layout.control - baseTheme.layout.controlMini) / 2,
  left: baseTheme.space.xs,
  right: baseTheme.space.xs,
} as const;

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
  size = 'regular',
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
  /**
   * `mini` always draws the outlined `ink` look whatever the variant, and the caller must pass
   * `accessibilityLabel` (「记录体重」「记录训练」「记录学习」).
   */
  size?: Size;
  /** Ghost is `ink` unless this asks for danger. `accent` uses `accentText` on the label. */
  tone?: 'danger' | 'accent';
  disabled?: boolean;
  loading?: boolean;
  /** Shown in place of `label` while loading. Omit it to keep the resting label. */
  loadingLabel?: string;
  /** Stretch to the column so stacked buttons share one width. Ghost never stretches (§5). */
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
  const mini = size === 'mini';
  const ghost = variant === 'ghost' && !mini;
  const background = mini
    ? hot
      ? theme.color.fill
      : 'transparent'
    : variant === 'primary'
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
              : theme.color.fill
            : 'transparent';
  const labelTone: Tone = mini
    ? 'ink'
    : variant === 'primary'
      ? 'onAccent'
      : variant === 'danger'
        ? 'inverse'
        : variant === 'ghost'
          ? tone === 'danger'
            ? 'danger'
            : 'ink'
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
      hitSlop={mini ? MINI_HIT_SLOP : undefined}
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
          borderColor: variant === 'secondary' || mini ? theme.color.line : 'transparent',
          transform: pressed && !inactive ? [{ translateY: 1 }] : undefined,
        },
        mini ? styles.mini : null,
        ghost ? styles.ghost : null,
        disabled ? { opacity: 0.55 } : null,
        fill && !ghost ? styles.fill : null,
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
          <Text variant={mini ? 'label' : 'body'} tone={labelTone} style={styles.label}>
            {visible}
          </Text>
        </View>
      ) : (
        <Text variant={mini ? 'label' : 'body'} tone={labelTone} style={styles.label}>
          {visible}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: baseTheme.layout.control,
    borderRadius: baseTheme.radius.md,
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
  mini: {
    minHeight: baseTheme.layout.controlMini,
    height: baseTheme.layout.controlMini,
    borderRadius: baseTheme.radius.sm,
    paddingHorizontal: baseTheme.space.sm,
    paddingVertical: 0,
  },
  ghost: { alignSelf: 'flex-start', paddingHorizontal: baseTheme.space.sm },
  fill: { alignSelf: 'stretch', width: '100%' },
});
