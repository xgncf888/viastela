import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { cardSurfaceStyle } from './Card';
import { Stack } from './layout';
import { Text } from './Text';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

export function Dialog({
  visible,
  title,
  body,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  body: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          accessibilityLabel="关闭"
          style={[styles.backdrop, { backgroundColor: theme.color.overlay }]}
          onPress={onClose}
        />
        <View
          accessibilityLabel={title}
          role="dialog"
          style={[styles.card, cardSurfaceStyle(theme.color.card, theme.color.line)]}
        >
          <Stack gap="sm">
            <Text variant="heading" accessibilityRole="header">
              {title}
            </Text>
            <Text variant="body">{body}</Text>
          </Stack>
          <Stack gap="sm">{children}</Stack>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: baseTheme.space.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    maxWidth: baseTheme.layout.auth,
    borderRadius: baseTheme.radius.card,
    padding: baseTheme.space.lg,
    gap: baseTheme.space.lg,
  },
});
