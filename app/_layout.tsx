import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { router, Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { readHoldApp } from '@/data/auth';
import { captureOAuthFailure } from '@/data/oauth';
import { useAccountDeletedFlag } from '@/features/account/deletion-state';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { BootScreen } from '@/features/auth/BootScreen';
import { StudyProvider } from '@/features/study/StudyProvider';
import { AppUpdatePrompt } from '@/features/shell/AppUpdatePrompt';
import { registerServiceWorker } from '@/features/shell/register-service-worker';
import { TrainingProvider } from '@/features/training/TrainingProvider';
import { WeightProvider } from '@/features/weight/WeightProvider';
import { AppFrame } from '@/ui/AppFrame';
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider';
import { ToastHost } from '@/ui/toast';

captureOAuthFailure();

export default function RootLayout() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <WeightProvider>
            <TrainingProvider>
              <StudyProvider>
                <ThemedRoot />
              </StudyProvider>
            </TrainingProvider>
          </WeightProvider>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function ThemedRoot() {
  const { color } = useTheme();
  return (
    <AppFrame>
      <AppUpdatePrompt>
        <RootNavigator paper={color.paper} />
      </AppUpdatePrompt>
      <ToastHost />
    </AppFrame>
  );
}

function RootNavigator({ paper }: { paper: string }) {
  const { ready, session, holdApp } = useAuth();
  const deleted = useAccountDeletedFlag();
  useEffect(() => {
    if (!holdApp || typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/login')) router.replace('/');
  }, [holdApp]);
  if (!ready) return <BootScreen />;
  const inApp = (Boolean(session) || holdApp || readHoldApp()) && !deleted;
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none', contentStyle: { backgroundColor: paper } }}>
      <Stack.Protected guard={inApp} redirectTo={deleted ? '/account/deleted' : '/login'}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="account/delete" />
      </Stack.Protected>
      <Stack.Protected guard={!inApp && !deleted} redirectTo={deleted ? '/account/deleted' : '/'}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Screen name="account/deleted" />
      <Stack.Screen name="privacy" />
    </Stack>
  );
}
