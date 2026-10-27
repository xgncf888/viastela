import { KeyboardAvoidingView, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from './ThemeProvider';

type Edge = 'top' | 'right' | 'bottom' | 'left';

/** Pages without a tab bar keep the home indicator clear. Tab screens leave the bottom edge to the bar. */
export const documentEdges = ['top', 'right', 'bottom', 'left'] as const;

const webInset: Record<Edge, ViewStyle> = {
  top: { paddingTop: 'env(safe-area-inset-top)' as unknown as number },
  right: { paddingRight: 'env(safe-area-inset-right)' as unknown as number },
  bottom: { paddingBottom: 'env(safe-area-inset-bottom)' as unknown as number },
  left: { paddingLeft: 'env(safe-area-inset-left)' as unknown as number },
};

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
  const frame = [styles.safe, { backgroundColor: theme.color.paper }, Platform.OS === 'web' ? edges.map((edge) => webInset[edge]) : null];
  if (Platform.OS === 'web') {
    return <View style={frame}>{body}</View>;
  }
  return (
    <SafeAreaView style={frame} edges={edges}>
      {body}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  fill: { flex: 1 },
});
