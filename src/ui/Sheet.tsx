import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { cardSurfaceStyle } from './Card';
import { theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.color.overlay }]} onPress={onClose} />
        <View
          style={[
            styles.card,
            cardSurfaceStyle(theme.color.card, theme.color.line),
          ]}
        >
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
    padding: Platform.OS === 'web' ? baseTheme.space.lg : 0,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  card: {
    width: '100%',
    maxWidth: baseTheme.layout.content,
    borderTopLeftRadius: baseTheme.radius.sheet,
    borderTopRightRadius: baseTheme.radius.sheet,
    borderBottomLeftRadius: Platform.OS === 'web' ? baseTheme.radius.sheet : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? baseTheme.radius.sheet : 0,
    padding: baseTheme.space.lg,
    gap: baseTheme.space.md,
    maxHeight: '90%',
    overflow: 'scroll',
  },
});
