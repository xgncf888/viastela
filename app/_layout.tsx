import 'react-native-gesture-handler';

import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { brand } from '@/config/brand';
import { captureOAuthFailure } from '@/data/oauth';
import { useAccountDeletedFlag } from '@/features/account/deletion-state';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { BootScreen } from '@/features/auth/BootScreen';
import { AppFrame } from '@/ui/AppFrame';
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider';

captureOAuthFailure();

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
  const deleted = useAccountDeletedFlag();
  if (!ready) return <BootScreen />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: paper } }}>
      <Stack.Protected guard={Boolean(session) && !deleted} redirectTo={deleted ? '/account/deleted' : '/login'}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="account/delete" />
      </Stack.Protected>
      <Stack.Protected guard={!session && !deleted} redirectTo={deleted ? '/account/deleted' : '/'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Screen name="account/deleted" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}
