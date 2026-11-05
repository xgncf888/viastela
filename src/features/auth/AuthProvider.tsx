import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { subscribeAuth, type AuthSession } from '@/data/auth';

type AuthContextValue = {
  ready: boolean;
  session: AuthSession | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fallbackTimer = setTimeout(() => {
      setReady(true);
    }, 2500);
    const unsub = subscribeAuth((next) => {
      clearTimeout(fallbackTimer);
      setSession(next);
      setReady(true);
    });
    return () => {
      clearTimeout(fallbackTimer);
      unsub();
    };
  }, []);

  const value = useMemo(() => ({ ready, session }), [ready, session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
