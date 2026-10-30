import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';
import { Row } from './layout';
import { Text } from './Text';
import { theme } from './theme';

/** One set or study item. Title is on the left, detail in tabular numerals, and 删除 sits at the right when removable. */
export function SetRow({
  title,
  detail,
  onDelete,
  children,
}: {
  title: string;
  detail: string;
  onDelete?: () => void;
  children?: ReactNode;
}) {
  return (
    <Card>
      <Row justify="between" align="center" gap="sm">
        <View style={styles.main}>
          <Text variant="body" style={styles.title}>
            {title}
          </Text>
          <Text variant="muted" style={styles.detail}>
            {detail}
          </Text>
        </View>
        {onDelete ? <Button label="删除" variant="ghost" onPress={onDelete} /> : null}
      </Row>
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: theme.space.sm,
    minWidth: 0,
  },
  title: {
    fontWeight: theme.fontWeight.medium,
  },
  detail: {
    fontVariant: ['tabular-nums', 'lining-nums'],
  },
});
