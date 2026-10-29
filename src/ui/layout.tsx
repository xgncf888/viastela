import { Children, useState, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { Card } from './Card';
import { layoutClassForWidth } from './layout-class';
import { Text } from './Text';
import { theme, type SpaceName } from './theme';
import { useTheme } from './ThemeProvider';

export function Stack({
  gap = 'md',
  children,
  accessibilityLabel,
}: {
  gap?: SpaceName;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  return (
    <View accessibilityLabel={accessibilityLabel} style={{ gap: theme.space[gap] }}>
      {children}
    </View>
  );
}

export function Row({
  gap = 'sm',
  align = 'center',
  justify = 'start',
  wrap = false,
  children,
  accessibilityLabel,
}: {
  gap?: SpaceName;
  align?: 'center' | 'start';
  justify?: 'start' | 'center' | 'between' | 'end';
  wrap?: boolean;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  const justifyContent =
    justify === 'between' ? 'space-between' : justify === 'end' ? 'flex-end' : justify === 'center' ? 'center' : 'flex-start';
  return (
    <View
      accessibilityLabel={accessibilityLabel}
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

/**
 * Desktop columns. Below the desktop breakpoint, `main` stacks above `aside`.
 * `columns={3}` is an equal grid of `children` on desktop and a stack below it.
 * The gap is `space.lg` (24). DESIGN.md does not set a column ratio, so `main` and `aside` share the row.
 */
export function Columns({
  main,
  aside,
  columns,
  children,
  accessibilityLabel,
}: {
  main?: ReactNode;
  aside?: ReactNode;
  columns?: 3;
  children?: ReactNode;
  accessibilityLabel?: string;
}) {
  const { width } = useWindowDimensions();
  const desktop = layoutClassForWidth(width) === 'expanded';
  const gap = theme.space.lg;
  if (columns === 3) {
    return (
      <ColumnGrid desktop={desktop} gap={gap} accessibilityLabel={accessibilityLabel}>
        {children}
      </ColumnGrid>
    );
  }
  if (!desktop) {
    return (
      <View accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'column', gap }}>
        {main}
        {aside}
      </View>
    );
  }
  return (
    <View accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'row', gap }}>
      <View style={columnStyle}>{main}</View>
      <View style={columnStyle}>{aside}</View>
    </View>
  );
}

function ColumnGrid({
  desktop,
  gap,
  children,
  accessibilityLabel,
}: {
  desktop: boolean;
  gap: number;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  const items = Children.toArray(children);
  const [width, setWidth] = useState(0);
  if (!desktop) {
    return (
      <View accessibilityLabel={accessibilityLabel} style={{ flexDirection: 'column', gap }}>
        {items}
      </View>
    );
  }
  const columnCount = 3;
  const colWidth = width > 0 ? (width - gap * (columnCount - 1)) / columnCount : undefined;
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        setWidth((current) => (current === next ? current : next));
      }}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}
    >
      {items.map((child, index) => (
        <View key={index} style={colWidth === undefined ? columnStyle : { width: colWidth }}>
          {child}
        </View>
      ))}
    </View>
  );
}

export function ScreenHeader({
  title,
  detail,
  note,
  trailing,
}: {
  /**
   * @deprecated DESIGN.md §5 and §7: a page header does not repeat the nav name.
   * Still accepted so existing screens compile. The value is not rendered.
   */
  kicker?: string;
  title: string;
  detail?: string;
  note?: string;
  /** Right side of the title row. Omit it and the title stays a single line. */
  trailing?: ReactNode;
}) {
  const heading = (
    <Text variant="title" accessibilityRole="header">
      {title}
    </Text>
  );
  return (
    <Stack gap="xs">
      {trailing ? (
        <Row justify="between" align="center">
          {heading}
          {trailing}
        </Row>
      ) : (
        heading
      )}
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

/** 1px `line`. */
export function Divider() {
  const { color } = useTheme();
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={{ alignSelf: 'stretch', height: theme.border.width, backgroundColor: color.line }}
    />
  );
}

/** Hairline with a short label in the middle, for example 或. */
export function LabeledDivider({ label }: { label: string }) {
  const theme = useTheme();
  return (
    <Row gap="sm">
      <View accessible={false} style={[styles.rule, { backgroundColor: theme.color.line }]} />
      <Text variant="muted">{label}</Text>
      <View accessible={false} style={[styles.rule, { backgroundColor: theme.color.line }]} />
    </Row>
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
  rule: {
    flex: 1,
    height: theme.border.width,
  },
});

const columnStyle = { flex: 1 } as const;
