import { Modal, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { darkColor, theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

function modalSurfaceStyle(cardColor: string, lineColor: string): ViewStyle {
  const isDark = cardColor === darkColor.card;
  if (Platform.OS === 'web') {
    return {
      backgroundColor: cardColor,
      borderWidth: baseTheme.border.width,
      borderColor: lineColor,
      boxShadow: isDark
        ? '0 24px 60px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.12)'
        : '0 24px 60px rgba(24, 24, 22, 0.22), 0 4px 14px rgba(24, 24, 22, 0.08), 0 0 0 1px rgba(38, 36, 31, 0.08)',
    } as ViewStyle;
  }
  return {
    backgroundColor: cardColor,
    borderWidth: baseTheme.border.width,
    borderColor: lineColor,
  };
}

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
        <Pressable
          style={[
            styles.backdrop,
            { backgroundColor: theme.color.overlay },
            Platform.OS === 'web' ? ({ backdropFilter: 'blur(8px)' } as unknown as ViewStyle) : null,
          ]}
          onPress={onClose}
        />
        <View
          style={[
            styles.card,
            modalSurfaceStyle(theme.color.card, theme.color.line),
          ]}
        >
          <View style={[styles.topAccentBar, { backgroundColor: theme.color.accent }]} />
          <View style={styles.body}>{children}</View>
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
    maxWidth: 460,
    borderTopLeftRadius: baseTheme.radius.card,
    borderTopRightRadius: baseTheme.radius.card,
    borderBottomLeftRadius: Platform.OS === 'web' ? baseTheme.radius.card : 0,
    borderBottomRightRadius: Platform.OS === 'web' ? baseTheme.radius.card : 0,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  topAccentBar: {
    height: 2.5,
    width: '100%',
  },
  body: {
    paddingHorizontal: baseTheme.space.page,
    paddingTop: baseTheme.space.md,
    paddingBottom: baseTheme.space.page,
    gap: baseTheme.space.md,
  },
});
