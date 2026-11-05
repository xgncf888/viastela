import './styles/app.css';

import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Redirect, router, usePathname } from 'expo-router';

import { captureOAuthFailure } from '@/data/oauth';
import { AccountDeletedScreen } from '@/features/account/AccountDeletedScreen';
import { DeleteAccountScreen } from '@/features/account/DeleteAccountScreen';
import { useAccountDeletedFlag } from '@/features/account/deletion-state';
import { PrivacyPolicyScreen } from '@/features/account/PrivacyPolicyScreen';
import { AssetsScreen } from '@/features/assets/AssetsScreen';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { BootScreen } from '@/features/auth/BootScreen';
import { LoginScreen } from '@/features/auth/LoginScreen';
import { BrowserScreen } from '@/features/browser/BrowserScreen';
import { FitnessScreen } from '@/features/fitness/FitnessScreen';
import { LedgerScreen } from '@/features/ledger/LedgerScreen';
import { MeScreen } from '@/features/me/MeScreen';
import { reminderSettingsRedirect, RemindersSettingsScreen } from '@/features/me/RemindersSettingsScreen';
import { AppShell } from '@/features/shell/AppShell';
import { AppUpdatePrompt } from '@/features/shell/AppUpdatePrompt';
import { registerServiceWorker } from '@/features/shell/register-service-worker';
import { StudyProvider } from '@/features/study/StudyProvider';
import { StudyScreen } from '@/features/study/StudyScreen';
import { TimelineScreen } from '@/features/timeline/TimelineScreen';
import { TodayScreen } from '@/features/today/TodayScreen';
import { TrainingProvider } from '@/features/training/TrainingProvider';
import { TrendScreen } from '@/features/trend/TrendScreen';
import { WeightProvider } from '@/features/weight/WeightProvider';
import { AppFrame } from '@/ui/AppFrame';
import { Button } from '@/ui/Button';
import { Content } from '@/ui/Content';
import { EmptyState } from '@/ui/EmptyState';
import { documentEdges, Screen } from '@/ui/Screen';
import { ThemeProvider } from '@/ui/ThemeProvider';

captureOAuthFailure();

function NotFoundView() {
  return (
    <Screen edges={documentEdges}>
      <Content>
        <EmptyState
          title="找不到这一页"
          description="这个地址没有对应的页面。"
          action={<Button label="回到今日" onPress={() => router.replace('/')} />}
        />
      </Content>
    </Screen>
  );
}

function AuthenticatedWorkspace({ pathname }: { pathname: string }) {
  let screen = <TodayScreen />;
  if (pathname === '/' || pathname === '/index') {
    screen = <TodayScreen />;
  } else if (pathname.startsWith('/ledger')) {
    screen = <LedgerScreen />;
  } else if (pathname.startsWith('/study')) {
    screen = <StudyScreen />;
  } else if (pathname.startsWith('/browser')) {
    screen = <BrowserScreen />;
  } else if (pathname.startsWith('/fitness')) {
    screen = <FitnessScreen />;
  } else if (pathname.startsWith('/assets')) {
    screen = <AssetsScreen />;
  } else if (pathname.startsWith('/trend')) {
    screen = <TrendScreen />;
  } else if (pathname.startsWith('/timeline')) {
    screen = <TimelineScreen />;
  } else if (pathname.startsWith('/me')) {
    screen = <MeScreen />;
  } else if (pathname.startsWith('/reminders')) {
    const back = reminderSettingsRedirect();
    screen = back ? <Redirect href={back} /> : <RemindersSettingsScreen />;
  } else {
    return <NotFoundView />;
  }

  return (
    <WeightProvider>
      <TrainingProvider>
        <StudyProvider>
          <AppShell>{screen}</AppShell>
        </StudyProvider>
      </TrainingProvider>
    </WeightProvider>
  );
}

function AppRouter() {
  const { ready, session } = useAuth();
  const deleted = useAccountDeletedFlag();
  const pathname = usePathname();

  if (!ready) return <BootScreen />;

  if (pathname === '/privacy') {
    return <PrivacyPolicyScreen />;
  }
  if (pathname === '/account/deleted') {
    return <AccountDeletedScreen />;
  }
  if (deleted) {
    return <Redirect href="/account/deleted" />;
  }
  if (!session) {
    if (pathname !== '/login') {
      return (
        <>
          <Redirect href="/login" />
          <LoginScreen />
        </>
      );
    }
    return <LoginScreen />;
  }
  if (pathname === '/login') {
    return (
      <>
        <Redirect href="/" />
        <AuthenticatedWorkspace pathname="/" />
      </>
    );
  }
  if (pathname === '/account/delete') {
    return <DeleteAccountScreen />;
  }
  return <AuthenticatedWorkspace pathname={pathname} />;
}

export function ViteRootApp() {
  useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppFrame>
            <AppUpdatePrompt>
              <AppRouter />
            </AppUpdatePrompt>
          </AppFrame>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

if (typeof document !== 'undefined') {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    createRoot(rootEl).render(<ViteRootApp />);
  }
}
