import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { darkColor, lightColor, theme as baseTheme, type Palette } from './theme';

export type AppTheme = Omit<typeof baseTheme, 'color'> & {
  color: Palette;
  scheme: 'light' | 'dark';
};

const ThemeContext = createContext<AppTheme>({
  ...baseTheme,
  scheme: 'light',
});

export function useTheme(): AppTheme {
  return useContext(ThemeContext);
}

function readWebScheme(): 'light' | 'dark' | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function usePreferredScheme(): 'light' | 'dark' {
  const system = useColorScheme();
  const [webScheme, setWebScheme] = useState<'light' | 'dark' | null>(readWebScheme);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => setWebScheme(media.matches ? 'dark' : 'light');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  if (webScheme) return webScheme;
  return system === 'dark' ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const scheme = usePreferredScheme();
  const value = useMemo<AppTheme>(
    () => ({
      ...baseTheme,
      color: scheme === 'dark' ? darkColor : lightColor,
      scheme,
    }),
    [scheme],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
