import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { darkColor, lightColor, theme as baseTheme, type Palette } from './theme';

const THEME_STORAGE_KEY = 'viastela.theme_mode.v2';

export type AppTheme = Omit<typeof baseTheme, 'color'> & {
  color: Palette;
  scheme: 'light' | 'dark';
  toggleTheme: () => void;
  setThemeScheme: (next: 'light' | 'dark') => void;
};

type ThemeListener = (scheme: 'light' | 'dark') => void;
const themeListeners = new Set<ThemeListener>();

function isTestEnv(): boolean {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
}

function readStoredScheme(): 'light' | 'dark' | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || isTestEnv()) {
    return null;
  }
  try {
    const raw = window.localStorage?.getItem(THEME_STORAGE_KEY);
    if (raw === 'dark' || raw === 'light') return raw;
  } catch {
    // Ignore storage access errors
  }
  return null;
}

function writeStoredScheme(scheme: 'light' | 'dark'): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    window.localStorage?.setItem(THEME_STORAGE_KEY, scheme);
  } catch {
    // Ignore storage access errors
  }
  syncDocumentTheme(scheme);
  themeListeners.forEach((fn) => fn(scheme));
}

function syncDocumentTheme(scheme: 'light' | 'dark'): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  const bg = scheme === 'dark' ? darkColor.paper : lightColor.paper;
  document.documentElement?.setAttribute('data-theme', scheme);
  if (document.documentElement?.style) {
    document.documentElement.style.backgroundColor = bg;
    document.documentElement.style.colorScheme = scheme;
  }
  if (document.body?.style) {
    document.body.style.backgroundColor = bg;
  }
}

const ThemeContext = createContext<AppTheme>({
  ...baseTheme,
  scheme: 'light',
  toggleTheme: () => {},
  setThemeScheme: () => {},
});

export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}

function usePreferredScheme(): [
  'light' | 'dark',
  (next: 'light' | 'dark') => void,
] {
  const [override, setOverride] = useState<'light' | 'dark' | null>(readStoredScheme);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }
    const onSub: ThemeListener = (next) => setOverride(next);
    themeListeners.add(onSub);
    return () => {
      themeListeners.delete(onSub);
    };
  }, []);

  // Default to Obsidian & Molten Gold ('dark') in production/desktop, while keeping 'light' in Jest tests.
  const resolved: 'light' | 'dark' =
    override ?? (isTestEnv() ? 'light' : 'dark');

  useEffect(() => {
    if (!isTestEnv()) {
      syncDocumentTheme(resolved);
    }
  }, [resolved]);

  const setScheme = useCallback((next: 'light' | 'dark') => {
    setOverride(next);
    writeStoredScheme(next);
  }, []);

  return [resolved, setScheme];
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setThemeScheme] = usePreferredScheme();
  const toggleTheme = useCallback(() => {
    setThemeScheme(scheme === 'dark' ? 'light' : 'dark');
  }, [scheme, setThemeScheme]);

  const value = useMemo<AppTheme>(
    () => ({
      ...baseTheme,
      color: scheme === 'dark' ? darkColor : lightColor,
      scheme,
      toggleTheme,
      setThemeScheme,
    }),
    [scheme, setThemeScheme, toggleTheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
