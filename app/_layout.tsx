import 'react-native-gesture-handler';

import { useEffect } from 'react';
import { Stack, router, useGlobalSearchParams, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { brand, webDocumentTitle } from '@/config/brand';
import { pwaIcons, pwaManifest, pwaSplashes, splashMedia, splashPath } from '@/config/pwa';
import {
  consentReturnPath,
  peekConsentAuthorization,
  readAuthorizationId,
} from '@/data/oauth-consent';
import { captureOAuthFailure } from '@/data/oauth';
import { useAccountDeletedFlag } from '@/features/account/deletion-state';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { BootScreen } from '@/features/auth/BootScreen';
import { registerServiceWorker } from '@/features/shell/register-service-worker';
import { AppFrame } from '@/ui/AppFrame';
import { ThemeProvider, useTheme } from '@/ui/ThemeProvider';

captureOAuthFailure();

export default function RootLayout() {
  useEffect(() => {
    registerServiceWorker();
  }, []);
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
        <title>{webDocumentTitle}</title>
        <meta name="theme-color" content={pwaManifest.theme_color} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={brand.webName} />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href={pwaIcons.appleTouch} />
        {pwaSplashes.map((splash) => (
          <link
            key={`${splash.deviceWidth}x${splash.deviceHeight}`}
            rel="apple-touch-startup-image"
            href={splashPath(splash)}
            media={splashMedia(splash)}
          />
        ))}
      </Head>
      <RootNavigator paper={color.paper} />
    </AppFrame>
  );
}

function RootNavigator({ paper }: { paper: string }) {
  const { ready, session } = useAuth();
  const deleted = useAccountDeletedFlag();
  const pathname = usePathname();
  const params = useGlobalSearchParams<{ authorization_id?: string | string[] }>();
  const authorizationId = readAuthorizationId(params.authorization_id) || peekConsentAuthorization();
  const afterLogin = authorizationId ? consentReturnPath(authorizationId) : '/';

  useEffect(() => {
    if (!ready || !session || deleted) return;
    if (pathname === '/oauth/consent') return;
    const pending = readAuthorizationId(params.authorization_id) || peekConsentAuthorization();
    if (!pending) return;
    if (pathname !== '/' && pathname !== '/login') return;
    router.replace(consentReturnPath(pending));
  }, [ready, session, deleted, pathname, params.authorization_id]);

  if (!ready) return <BootScreen />;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: paper } }}>
      <Stack.Protected guard={Boolean(session) && !deleted} redirectTo={deleted ? '/account/deleted' : '/login'}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="account/delete" />
      </Stack.Protected>
      <Stack.Protected guard={!session && !deleted} redirectTo={deleted ? '/account/deleted' : afterLogin}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Screen name="account/deleted" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="oauth/consent" />
    </Stack>
  );
}
