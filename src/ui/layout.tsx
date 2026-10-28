import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from './Card';
import { Text } from './Text';
import { theme, type SpaceName } from './theme';
import { useTheme } from './ThemeProvider';

export function Stack({ gap = 'md', children }: { gap?: SpaceName; children: ReactNode }) {
  return <View style={{ gap: theme.space[gap] }}>{children}</View>;
}

export function Row({
  gap = 'sm',
  align = 'center',
  justify = 'start',
  wrap = false,
  children,
}: {
  gap?: SpaceName;
  align?: 'center' | 'start';
  justify?: 'start' | 'center' | 'between' | 'end';
  wrap?: boolean;
  children: ReactNode;
}) {
  const justifyContent =
    justify === 'between' ? 'space-between' : justify === 'end' ? 'flex-end' : justify === 'center' ? 'center' : 'flex-start';
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: wrap ? 'wrap' : 'nowrap',
        alignItems: align === 'start' ? 'flex-start' : 'center',
        justifyContent,
        gap: theme.space[gap],
      }}
    >
      {children}
    </View>
  );
}

export function Center({ gap = 'sm', children }: { gap?: SpaceName; children: ReactNode }) {
  return <View style={[styles.center, { gap: theme.space[gap] }]}>{children}</View>;
}

export function ScreenHeader({
  kicker,
  title,
  detail,
  note,
}: {
  kicker?: string;
  title: string;
  detail?: string;
  note?: string;
}) {
  return (
    <Stack gap="xs">
      {kicker ? <Text variant="muted">{kicker}</Text> : null}
      <Text variant="title" accessibilityRole="header">
        {title}
      </Text>
      {detail ? <Text variant="body">{detail}</Text> : null}
      {note ? <Text variant="muted">{note}</Text> : null}
    </Stack>
  );
}

export function Field({
  label,
  value,
  hint,
  locked = false,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Read-only. Used when a code or account cannot be edited. */
  locked?: boolean;
}) {
  return (
    <Stack gap="xs">
      <Text variant="muted">{label}</Text>
      <Text variant="body" tone={locked ? 'muted' : 'ink'} accessibilityState={locked ? { disabled: true } : undefined}>
        {value}
      </Text>
      {hint ? <Text variant="muted">{hint}</Text> : null}
    </Stack>
  );
}

export function Callout({
  message,
  action,
  tone,
}: {
  message: string;
  action?: ReactNode;
  tone?: 'danger' | 'warning';
}) {
  const theme = useTheme();
  if (tone === 'danger') {
    return (
      <View accessibilityRole="alert" style={[styles.tone, { backgroundColor: theme.color.dangerSoft }]}>
        <Text variant="body" tone="danger">
          {message}
        </Text>
        {action}
      </View>
    );
  }
  if (tone === 'warning') {
    return (
      <View accessibilityRole="text" role="status" style={[styles.tone, { backgroundColor: theme.color.warningSoft }]}>
        <Text variant="body" tone="warning">
          {message}
        </Text>
        {action}
      </View>
    );
  }
  return (
    <Card>
      <Text variant="body">{message}</Text>
      {action}
    </Card>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tone: {
    borderRadius: theme.radius.lg,
    padding: theme.space.md,
    gap: theme.space.sm,
  },
});
