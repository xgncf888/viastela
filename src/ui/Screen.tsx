import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from './ThemeProvider';

type Edge = 'top' | 'right' | 'bottom' | 'left';

export function Screen({
  children,
  keyboard = false,
  edges = ['top', 'left', 'right'],
}: {
  children: React.ReactNode;
  keyboard?: boolean;
  edges?: readonly Edge[];
}) {
  const theme = useTheme();
  const body = keyboard ? (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.fill}>
      {children}
    </KeyboardAvoidingView>
  ) : (
    <View style={styles.fill}>{children}</View>
  );
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.color.paper }]} edges={edges}>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
});
