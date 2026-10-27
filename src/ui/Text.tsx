import { Text as NativeText, Platform, StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { theme } from './theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'muted';
type Tone = 'ink' | 'muted' | 'inverse' | 'accent' | 'danger';

const variantStyle: Record<Variant, TextStyle> = {
  display: {
    fontSize: theme.font.display,
    lineHeight: theme.font.display + theme.space.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  title: { fontSize: theme.font.xl, lineHeight: theme.font.xl + theme.space.sm, fontWeight: '600' },
  heading: { fontSize: theme.font.lg, lineHeight: theme.font.lg + theme.space.sm, fontWeight: '600' },
  body: { fontSize: theme.font.md, lineHeight: theme.font.md + theme.space.sm, fontWeight: '400' },
  muted: { fontSize: theme.font.sm, lineHeight: theme.font.sm + theme.space.sm, fontWeight: '400' },
};

const toneColor: Record<Tone, string> = {
  ink: theme.color.ink,
  muted: theme.color.muted,
  inverse: theme.color.accentInk,
  accent: theme.color.accent,
  danger: theme.color.danger,
};

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
  const resolvedTone = tone ?? (variant === 'muted' ? 'muted' : 'ink');
  return (
    <NativeText
      accessibilityRole={accessibilityRole}
      style={[styles.base, variantStyle[variant], { color: toneColor[resolvedTone] }, style]}
    >
      {children}
    </NativeText>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Platform.select({
      web: 'ui-sans-serif, system-ui, "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif',
      default: undefined,
    }),
  },
});
