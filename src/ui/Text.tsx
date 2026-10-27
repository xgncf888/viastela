import { Text as NativeText, Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'muted';
type Tone = 'ink' | 'muted' | 'inverse' | 'accent' | 'onAccent' | 'danger' | 'moss';

const variantStyle: Record<Variant, TextStyle> = {
  display: {
    fontSize: baseTheme.font.display,
    lineHeight: baseTheme.font.display + baseTheme.space.sm,
    fontWeight: '500',
  },
  title: {
    fontSize: baseTheme.font.xl,
    lineHeight: baseTheme.font.xl + baseTheme.space.sm,
    fontWeight: '500',
  },
  heading: {
    fontSize: baseTheme.font.lg,
    lineHeight: baseTheme.font.lg + baseTheme.space.sm,
    fontWeight: '500',
  },
  body: {
    fontSize: baseTheme.font.md,
    lineHeight: baseTheme.font.md + baseTheme.space.sm,
    fontWeight: '400',
  },
  muted: {
    fontSize: baseTheme.font.sm,
    lineHeight: baseTheme.font.sm + baseTheme.space.sm,
    fontWeight: '400',
  },
};

const editorial = new Set<Variant>(['display', 'title', 'heading']);

export function Text({
  children,
  variant = 'body',
  tone,
  style,
  accessibilityRole,
}: {
  children: React.ReactNode;
  variant?: Variant;
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  accessibilityRole?: 'header' | 'text';
}) {
  const theme = useTheme();
  const resolvedTone = tone ?? (variant === 'muted' ? 'muted' : 'ink');
  const accentColor = variant === 'display' ? theme.color.accent : theme.color.accentText;
  const toneColor: Record<Tone, string> = {
    ink: theme.color.ink,
    muted: theme.color.muted,
    inverse: theme.color.onToast,
    accent: accentColor,
    onAccent: theme.color.accentInk,
    danger: theme.color.danger,
    moss: theme.color.moss,
  };
  return (
    <NativeText
      accessibilityRole={accessibilityRole}
      style={[
        styles.base,
        variantStyle[variant],
        editorial.has(variant) ? styles.editorial : null,
        { color: toneColor[resolvedTone] },
        style,
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
    fontVariant: ['tabular-nums'],
  },
  editorial: {
    fontFamily: Platform.select({
      web: baseTheme.fontFamily.serif,
      default: undefined,
    }),
    fontWeight: '500',
  },
});
