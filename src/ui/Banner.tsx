import type { ReactNode } from 'react';
import { View } from 'react-native';

import { Row } from './layout';
import { Text } from './Text';
import { theme } from './theme';
import { useTheme } from './ThemeProvider';

/** Full-width notice. The action sits on the right and should not be a solid accent button. */
export function Banner({
  message,
  tone = 'warning',
  action,
}: {
  message: string;
  tone?: 'warning';
  action?: ReactNode;
}) {
  const { color } = useTheme();
  const background = tone === 'warning' ? color.warningSoft : color.surface;
  return (
    <View
      accessibilityRole="text"
      role="status"
      style={{
        backgroundColor: background,
        borderRadius: theme.radius.card,
        padding: theme.space.md,
      }}
    >
      <Row justify="between" align="center" gap="sm">
        <Text variant="body" tone="warning">
          {message}
        </Text>
        {action}
      </Row>
    </View>
  );
}
