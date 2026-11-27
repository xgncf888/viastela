import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router } from 'expo-router';

import { beginExplicitLeave, isLocalOnlySession, readSawCloudSession, rememberCloudSession, subscribeAuth, subscribeSessionExpired, takeExplicitLeave, writeHoldApp, type AuthSession } from '@/data/auth';
import { showToast } from '@/ui/toast';

type AuthContextValue = {
  ready: boolean;
  session: AuthSession | null;
  /** Stay on the app after the cloud session disappears so unsaved rows remain. */
  holdApp: boolean;
  needsReauth: boolean;
  requestLogin: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);
  const [holdApp, setHoldApp] = useState(false);
  const [needsReauth, setNeedsReauth] = useState(false);

  useEffect(() => subscribeSessionExpired(() => setNeedsReauth(true)), []);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setReady(true);
    }, 2500);
    const unsub = subscribeAuth((next) => {
      clearTimeout(fallbackTimer);
      setReady(true);
      if (next && !isLocalOnlySession(next)) {
        rememberCloudSession();
        writeHoldApp(false);
        setNeedsReauth(false);
        setSession(next);
        setHoldApp(false);
        return;
      }
      const explicit = takeExplicitLeave();
      const nextHold = !explicit && readSawCloudSession();
      writeHoldApp(nextHold);
      setSession(next);
      setHoldApp(nextHold);
      if (nextHold) {
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.location.pathname.startsWith('/login')) {
            router.replace('/');
          }
        }, 50);
      }
    });
    return () => {
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  const requestLogin = useMemo(() => {
    return () => {
      beginExplicitLeave();
      writeHoldApp(false);
      setHoldApp(false);
      router.push('/login');
    };
  }, []);

  const value = useMemo(
    () => ({ ready, session, holdApp, needsReauth, requestLogin }),
    [ready, session, holdApp, needsReauth, requestLogin],
  );
  return (
    <AuthContext.Provider value={value}>
      <LocalModeToast session={session} />
      {children}
    </AuthContext.Provider>
  );
}

function LocalModeToast({ session }: { session: AuthSession | null }) {
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!session || !isLocalOnlySession(session) || announced.current === session.userId) return;
    announced.current = session.userId;
    showToast({ text: '数据只存在这台设备上' });
  }, [session]);
  return null;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
