import type { ReactNode } from 'react';

export function StatusBar(_props: { style?: string }) {
  return null;
}

export async function setBackgroundColorAsync(color: string): Promise<void> {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.backgroundColor = color;
  }
}

export const Constants = {
  nativeBuildVersion: null as string | null,
  expoConfig: {},
};

export default Constants;

export async function openURL(url: string): Promise<void> {
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function Head({ children }: { children?: ReactNode }) {
  void children;
  return null;
}
