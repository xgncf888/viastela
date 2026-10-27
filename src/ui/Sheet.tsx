import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

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
            {
              backgroundColor: theme.color.card,
              borderColor: theme.color.line,
            },
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
    borderTopLeftRadius: baseTheme.radius.lg,
    borderTopRightRadius: baseTheme.radius.lg,
    borderBottomLeftRadius: Platform.OS === 'web' ? baseTheme.radius.lg : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? baseTheme.radius.lg : 0,
    borderWidth: baseTheme.border.width,
    padding: baseTheme.space.lg,
    gap: baseTheme.space.lg,
  },
});
