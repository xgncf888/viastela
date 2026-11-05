import { createElement, type ReactNode } from 'react';
import { createContext, useContext } from 'react';

export type EdgeInsets = { top: number; right: number; bottom: number; left: number };

const defaultInsets: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };

export const SafeAreaInsetsContext = createContext<EdgeInsets | null>(defaultInsets);

export function SafeAreaProvider({ children }: { children?: ReactNode }) {
  return createElement(
    SafeAreaInsetsContext.Provider,
    { value: defaultInsets },
    createElement('div', { style: { display: 'flex', flex: 1, width: '100%', height: '100%' } }, children),
  );
}

export function SafeAreaView({
  children,
  style,
}: {
  children?: ReactNode;
  style?: unknown;
  edges?: readonly string[];
}) {
  return createElement('div', { style: { display: 'flex', flex: 1, ...(typeof style === 'object' && style ? style : {}) } }, children);
}

export function useSafeAreaInsets(): EdgeInsets {
  return useContext(SafeAreaInsetsContext) ?? defaultInsets;
}
