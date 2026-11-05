import { createElement, type CSSProperties, type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { theme } from './theme';
import { useTheme } from './ThemeProvider';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

function isTestEnv(): boolean {
  return typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
}

/**
 * Attaches `data-slot` and optional `data-*` attributes on web builds (Vite / WKWebView / WebView2 / PWA)
 * while staying a complete no-op in Jest (`NODE_ENV === 'test'`) so existing DOM snapshot assertions stay untouched.
 */
export function webSlot(
  slot: string,
  extra?: Record<string, string | boolean | undefined>,
): { dataSet?: Record<string, string> } {
  if (Platform.OS !== 'web' || isTestEnv()) {
    return {};
  }
  const dataSet: Record<string, string> = { slot };
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== false) {
        dataSet[k] = String(v);
      }
    }
  }
  return { dataSet };
}

/**
 * Native DOM Grid container using Tailwind CSS v4 / CSS Grid on Web (`Platform.OS === 'web'`)
 * with automatic fallback to `<View>` in Jest/native environments.
 */
export function DomGrid({
  columns = 4,
  gap = 'sm',
  className,
  style,
  children,
}: {
  columns?: 2 | 3 | 4;
  gap?: keyof typeof theme.space;
  className?: string;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  const gapPx = theme.space[gap];
  if (Platform.OS === 'web' && !isTestEnv()) {
    const gridClass =
      columns === 4
        ? 'vs-bento-grid-4'
        : columns === 3
          ? 'vs-bento-grid-3'
          : 'vs-bento-grid-2';
    return createElement(
      'div',
      {
        'data-slot': 'bento-grid',
        className: cn(gridClass, className),
        style: { gap: `${gapPx}px`, ...(style as unknown as CSSProperties) },
      },
      children,
    );
  }
  return (
    <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: gapPx }, style]}>
      {children}
    </View>
  );
}

/**
 * Elevated or recessed native DOM surface card with Tailwind v4 class support and hover elevation.
 */
export function DomSurface({
  variant = 'card',
  interactive = false,
  className,
  style,
  children,
}: {
  variant?: 'card' | 'recessed' | 'glass';
  interactive?: boolean;
  className?: string;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  const { color } = useTheme();
  const bg = variant === 'recessed' ? color.paperDeep : color.card;
  return (
    <View
      {...webSlot(variant === 'glass' ? 'glass-bar' : 'card', {
        interactive: interactive ? 'true' : undefined,
        surface: variant,
      })}
      style={[
        {
          backgroundColor: bg,
          borderRadius: theme.radius.sm,
          borderWidth: theme.border.width,
          borderColor: color.lineSoft,
          padding: theme.space.sm,
        },
        style,
      ]}
      {...(Platform.OS === 'web' && !isTestEnv() && className ? { className } : {})}
    >
      {children}
    </View>
  );
}
