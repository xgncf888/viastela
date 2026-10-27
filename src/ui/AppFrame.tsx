import { useEffect, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { Platform, StyleSheet, View } from 'react-native';

import { useTheme } from './ThemeProvider';

export function AppFrame({ children }: { children: ReactNode }) {
  const { color, scheme } = useTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(color.paper);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.backgroundColor = color.paper;
      document.documentElement.style.colorScheme = scheme;
      document.body.style.backgroundColor = color.paper;
    }
  }, [color.paper, scheme]);

  return (
    <View style={[styles.frame, { backgroundColor: color.paper }]}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1 },
});
