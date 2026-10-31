import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

import { darkColor, theme as baseTheme } from './theme';
import { useTheme } from './ThemeProvider';

export function cardSurfaceStyle(cardColor: string, lineColor: string): ViewStyle {
  const isDark = cardColor === darkColor.card;
  if (isDark) {
    return {
      backgroundColor: cardColor,
      borderWidth: baseTheme.border.width,
      borderColor: lineColor,
    };
  }
  if (Platform.OS === 'web') {
    return {
      backgroundColor: cardColor,
      borderWidth: 0,
      boxShadow: baseTheme.shadow.card.web,
    } as ViewStyle;
  }
  if (Platform.OS === 'android') {
    return {
      backgroundColor: cardColor,
      borderWidth: 0,
      elevation: baseTheme.shadow.card.android.elevation,
    };
  }
  return {
    backgroundColor: cardColor,
    borderWidth: 0,
    ...baseTheme.shadow.card.ios,
  };
}

export function Card({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, cardSurfaceStyle(theme.color.card, theme.color.line)]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: baseTheme.radius.card,
    padding: baseTheme.space.md,
    gap: baseTheme.space.sm,
  },
});
