import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { theme } from './theme';

export function Sheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.card}>{children}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: theme.color.overlay,
  },
  card: {
    width: '100%',
    maxWidth: theme.layout.content,
    backgroundColor: theme.color.card,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    borderBottomLeftRadius: Platform.OS === 'web' ? theme.radius.lg : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? theme.radius.lg : 0,
    padding: theme.space.lg,
    gap: theme.space.lg,
  },
});
