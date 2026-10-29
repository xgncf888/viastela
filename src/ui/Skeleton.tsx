import { useEffect } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import { PULSE_DURATION_MS } from '@/lib/timing';

import { theme } from './theme';
import { useTheme } from './ThemeProvider';
import type { TextVariant } from './text-scale';
import { useReducedMotion } from './use-reduced-motion';

/** Opacity while `prefers-reduced-motion` / Reduce Motion is on. The block does not breathe. */
export const SKELETON_REDUCED_OPACITY = 0.7;
/** Low point of one breath. The high point is fully opaque. */
export const SKELETON_PULSE_LOW = 0.55;
const SKELETON_PULSE_HIGH = 1;
/** Bar height is three quarters of the type size, centered in that variant's line box. */
const TEXT_BAR_RATIO = 0.75;
const LAST_LINE_WIDTH = '60%';

/** §17.2 figure blocks. These sizes are specified there and are not theme tokens. */
export const SKELETON_DISPLAY_WIDTH = 160;
export const SKELETON_DISPLAY_HEIGHT = 24;
export const SKELETON_METRIC_WIDTH = 96;
export const SKELETON_METRIC_HEIGHT = 16;
export const SKELETON_LEDGER_LABEL_WIDTH = 56;
export const SKELETON_LEDGER_VALUE_WIDTH = 72;

export const skeletonHiddenProps = {
  accessible: false as const,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants' as const,
  'aria-hidden': true as const,
};

const pulse = new Animated.Value(SKELETON_PULSE_HIGH);
let holders = 0;
let running: { stop: () => void } | null = null;

function retainPulse(): () => void {
  holders += 1;
  if (holders === 1) {
    const half = PULSE_DURATION_MS / 2;
    const useNativeDriver = Platform.OS !== 'web';
    const fade = (toValue: number) =>
      Animated.timing(pulse, {
        toValue,
        duration: half,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver,
      });
    const animation = Animated.loop(Animated.sequence([fade(SKELETON_PULSE_LOW), fade(SKELETON_PULSE_HIGH)]));
    running = animation;
    animation.start();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holders = Math.max(0, holders - 1);
    if (holders === 0) {
      running?.stop();
      running = null;
      pulse.setValue(SKELETON_PULSE_HIGH);
    }
  };
}

/** Test isolation. Production screens share one clock so every block on the page breathes together. */
export function resetSkeletonPulseForTests(): void {
  running?.stop();
  running = null;
  holders = 0;
  pulse.setValue(SKELETON_PULSE_HIGH);
}

const textBox: Record<TextVariant, { fontSize: number; lineHeight: number }> = {
  display: { fontSize: theme.font.display, lineHeight: theme.lineHeight.display },
  title: { fontSize: theme.font.xl, lineHeight: theme.lineHeight.xl },
  metric: { fontSize: theme.font.metric, lineHeight: theme.lineHeight.metric },
  heading: { fontSize: theme.font.lg, lineHeight: theme.lineHeight.lg },
  body: { fontSize: theme.font.md, lineHeight: theme.lineHeight.md },
  tab: { fontSize: theme.font.tab, lineHeight: theme.lineHeight.tab },
  label: { fontSize: theme.font.sm, lineHeight: theme.lineHeight.sm },
  caption: { fontSize: theme.font.caption, lineHeight: theme.lineHeight.caption },
  muted: { fontSize: theme.font.sm, lineHeight: theme.lineHeight.sm },
};

export function Skeleton({
  width,
  height,
  radius = 'bar',
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: keyof typeof theme.radius;
}) {
  const appTheme = useTheme();
  const reduced = useReducedMotion();
  const animate = reduced === false;

  useEffect(() => {
    if (!animate) return undefined;
    return retainPulse();
  }, [animate]);

  const shape = {
    width: width ?? '100%',
    height,
    borderRadius: appTheme.radius[radius],
    backgroundColor: appTheme.color.skeleton,
  };
  if (!animate) {
    return (
      <View
        {...skeletonHiddenProps}
        style={[styles.block, shape, { opacity: reduced === true ? SKELETON_REDUCED_OPACITY : SKELETON_PULSE_HIGH }]}
      />
    );
  }
  return <Animated.View {...skeletonHiddenProps} style={[styles.block, shape, { opacity: pulse }]} />;
}

export function SkeletonText({ lines, variant = 'body' }: { lines: number; variant?: TextVariant }) {
  if (lines < 1) return null;
  const box = textBox[variant];
  const barHeight = box.fontSize * TEXT_BAR_RATIO;
  return (
    <View {...skeletonHiddenProps}>
      {Array.from({ length: lines }, (_, index) => (
        <View key={index} style={[styles.line, { height: box.lineHeight }]}>
          <Skeleton height={barHeight} radius="bar" width={index === lines - 1 ? LAST_LINE_WIDTH : '100%'} />
        </View>
      ))}
    </View>
  );
}

/** Large figure placeholder. Width 160, height 24 (§17.2). */
export function SkeletonDisplay() {
  return <Skeleton width={SKELETON_DISPLAY_WIDTH} height={SKELETON_DISPLAY_HEIGHT} radius="bar" />;
}

/** Display figure centered in the display line box, so a loaded number does not shift the block. */
export function SkeletonDisplayLine() {
  return (
    <View style={[styles.line, { height: textBox.display.lineHeight }]}>
      <SkeletonDisplay />
    </View>
  );
}

/** Small-card amount placeholder. Width 96, height 16 (§17.2). */
export function SkeletonMetric() {
  return <Skeleton width={SKELETON_METRIC_WIDTH} height={SKELETON_METRIC_HEIGHT} radius="bar" />;
}

/**
 * Ledger rows inside a real card. Each row is `layout.row` tall, with a 56-wide
 * label and a 72-wide value and empty space between them (§17.2).
 */
export function SkeletonLedger({ lines }: { lines: number }) {
  if (lines < 1) return null;
  const barHeight = textBox.body.fontSize * TEXT_BAR_RATIO;
  return (
    <View {...skeletonHiddenProps}>
      {Array.from({ length: lines }, (_, index) => (
        <View key={index} style={[styles.ledger, { height: theme.layout.row }]}>
          <Skeleton height={barHeight} radius="bar" width={SKELETON_LEDGER_LABEL_WIDTH} />
          <Skeleton height={barHeight} radius="bar" width={SKELETON_LEDGER_VALUE_WIDTH} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { overflow: 'hidden' },
  line: { justifyContent: 'center' },
  ledger: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
