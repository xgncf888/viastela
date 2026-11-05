import { createElement, useEffect, useSyncExternalStore, type ReactNode } from 'react';

type Listener = () => void;
const listeners = new Set<Listener>();

function normalizePath(raw: string): string {
  if (!raw) return '/';
  const clean = raw.split('?')[0]?.split('#')[0] ?? '/';
  if (clean === '/index.html' || clean.endsWith('/index.html')) return '/';
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1);
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function readCurrentPathname(): string {
  if (typeof window === 'undefined' || !window.location) return '/';
  const hash = window.location.hash;
  if (hash && hash.startsWith('#/')) {
    return normalizePath(hash.slice(1));
  }
  return normalizePath(window.location.pathname || '/');
}

let currentPathname = readCurrentPathname();

function notifyListeners(next: string) {
  currentPathname = next;
  listeners.forEach((fn) => fn());
}

function subscribePathname(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getPathnameSnapshot(): string {
  return currentPathname;
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    notifyListeners(readCurrentPathname());
  });
  window.addEventListener('hashchange', () => {
    notifyListeners(readCurrentPathname());
  });
}

function navigateInternal(href: string, replace: boolean) {
  const next = normalizePath(href);
  if (typeof window !== 'undefined' && window.history) {
    try {
      const search = href.includes('?') ? `?${href.split('?')[1]}` : '';
      const url = `${next}${search}`;
      if (replace) {
        window.history.replaceState(null, '', url);
      } else {
        window.history.pushState(null, '', url);
      }
    } catch {
      // Fallback for custom scheme handlers where pushState path may be restricted
    }
  }
  notifyListeners(next);
}

export const router = {
  push(href: string) {
    navigateInternal(href, false);
  },
  replace(href: string) {
    navigateInternal(href, true);
  },
  back() {
    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
      window.history.back();
    } else {
      navigateInternal('/', true);
    }
  },
};

export function usePathname(): string {
  return useSyncExternalStore(subscribePathname, getPathnameSnapshot, () => '/');
}

export function useFocusEffect(effect: () => void | (() => void)): void {
  const pathname = usePathname();
  useEffect(() => {
    const cleanup = effect();
    const onFocus = () => {
      effect();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
      if (typeof cleanup === 'function') cleanup();
    };
  }, [effect, pathname]);
}

export function usePreventRemove(prevent: boolean, callback?: () => void): void {
  useEffect(() => {
    if (!prevent || typeof window === 'undefined') return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      callback?.();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [callback, prevent]);
}

export function Redirect({ href }: { href: string }) {
  useEffect(() => {
    router.replace(href);
  }, [href]);
  return null;
}

export function Stack({
  children,
}: {
  screenOptions?: unknown;
  children?: ReactNode;
}) {
  return createElement('div', { style: { display: 'flex', flex: 1, width: '100%', height: '100%' } }, children);
}

Stack.Screen = function StackScreen(_props: { name: string; options?: unknown }) {
  return null;
};

Stack.Protected = function StackProtected({
  guard,
  children,
}: {
  guard: boolean;
  redirectTo?: string;
  children?: ReactNode;
}) {
  if (!guard) return null;
  return createElement(StackFragment, null, children);
};

function StackFragment({ children }: { children?: ReactNode }) {
  return createElement('div', { style: { display: 'contents' } }, children);
}

export function Tabs({
  children,
}: {
  detachInactiveScreens?: boolean;
  tabBar?: () => ReactNode;
  screenOptions?: unknown;
  children?: ReactNode;
}) {
  return createElement('div', { style: { display: 'flex', flex: 1, width: '100%', height: '100%' } }, children);
}

Tabs.Screen = function TabsScreen(_props: { name: string; options?: unknown }) {
  return null;
};
