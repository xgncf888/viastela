import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { BootScreen } from '@/features/auth/BootScreen';
import { AppFrame } from '@/ui/AppFrame';
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedRoot />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedRoot() {
  const { color } = useTheme();
  return (
    <AppFrame>
      <Head>
        <title>{brand.displayName}</title>
      </Head>
      <RootNavigator paper={color.paper} />
    </AppFrame>
  );
}

function RootNavigator({ paper }: { paper: string }) {
  const { ready, session } = useAuth();
  if (!ready) return <BootScreen />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: paper } }}>
      <Stack.Protected guard={Boolean(session)}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
