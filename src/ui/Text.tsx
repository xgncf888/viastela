import { Text as NativeText, Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { installWebSerifFace, webTitleFontFamily } from './serif-face';
import { plainText, serifCovers } from './serif-glyphs';
import { maxFontSizeMultiplierFor, type TextVariant } from './text-scale';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

installWebSerifFace();

type Variant = TextVariant;
type Tone = 'ink' | 'muted' | 'inverse' | 'accent' | 'onAccent' | 'danger' | 'moss' | 'warning';

const variantStyle: Record<Variant, TextStyle> = {
  display: {
    fontSize: baseTheme.font.display,
    lineHeight: baseTheme.lineHeight.display,
    fontWeight: baseTheme.fontWeight.semibold,
  },
  title: {
    fontSize: baseTheme.font.xl,
    lineHeight: baseTheme.lineHeight.xl,
    fontWeight: baseTheme.fontWeight.semibold,
    fontFamily: Platform.select({
      web: webTitleFontFamily(),
      default: undefined,
    }),
  },
  metric: {
    fontSize: baseTheme.font.metric,
    lineHeight: baseTheme.lineHeight.metric,
    fontWeight: baseTheme.fontWeight.semibold,
  },
  heading: {
    fontSize: baseTheme.font.lg,
    lineHeight: baseTheme.lineHeight.lg,
    fontWeight: baseTheme.fontWeight.semibold,
  },
  body: {
    fontSize: baseTheme.font.md,
    lineHeight: baseTheme.lineHeight.md,
    fontWeight: baseTheme.fontWeight.regular,
  },
  tab: {
    fontSize: baseTheme.font.tab,
    lineHeight: baseTheme.lineHeight.tab,
    fontWeight: baseTheme.fontWeight.regular,
  },
  label: {
    fontSize: baseTheme.font.sm,
    lineHeight: baseTheme.lineHeight.sm,
    fontWeight: baseTheme.fontWeight.medium,
  },
  caption: {
    fontSize: baseTheme.font.caption,
    lineHeight: baseTheme.lineHeight.caption,
    fontWeight: baseTheme.fontWeight.regular,
  },
  muted: {
    fontSize: baseTheme.font.sm,
    lineHeight: baseTheme.lineHeight.sm,
    fontWeight: baseTheme.fontWeight.regular,
  },
};

const mutedVariants = new Set<Variant>(['muted', 'label', 'caption']);

export function Text({
  children,
  variant = 'body',
  tone,
  style,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
  accessibilityElementsHidden,
  importantForAccessibility,
  accessibilityLiveRegion,
  accessible,
  role,
  'aria-hidden': ariaHidden,
}: {
  children: React.ReactNode;
  variant?: Variant;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: 'header' | 'text';
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean };
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  accessible?: boolean;
  role?: 'status' | 'alert';
  'aria-hidden'?: boolean;
}) {
  const theme = useTheme();
  const resolvedTone = tone ?? (mutedVariants.has(variant) ? 'muted' : 'ink');
  const titleUsesSans = variant === 'title' && Platform.OS === 'web' && !serifCovers(plainText(children));
  const toneColor: Record<Tone, string> = {
    ink: theme.color.ink,
    muted: theme.color.muted,
    inverse: theme.color.onToast,
    accent: theme.color.accentText,
    onAccent: theme.color.accentInk,
    danger: theme.color.danger,
    moss: theme.color.moss,
    warning: theme.color.warning,
  };
  return (
    <NativeText
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      accessibilityElementsHidden={accessibilityElementsHidden}
      importantForAccessibility={importantForAccessibility}
      accessibilityLiveRegion={accessibilityLiveRegion}
      accessible={accessible}
      role={role}
      aria-hidden={ariaHidden}
      maxFontSizeMultiplier={maxFontSizeMultiplierFor(variant)}
      style={[
        styles.base,
        variantStyle[variant],
        { color: toneColor[resolvedTone] },
        style,
        titleUsesSans ? { fontFamily: baseTheme.fontFamily.sans } : null,
      ]}
    >
      {children}
    </NativeText>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Platform.select({
      web: baseTheme.fontFamily.sans,
      default: undefined,
    }),
    fontVariant: ['tabular-nums', 'lining-nums'],
  },
});
