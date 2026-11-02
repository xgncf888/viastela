/**
 * Lightweight, zero-dependency Bilingual (Chinese `zh` / English `en`) i18n store.
 * Pure TypeScript module (`src/core/i18n.ts`) with no React imports.
 * For React components, use `useI18n()` from `@/ui/use-i18n`.
 */

export type AppLocale = 'zh' | 'en';

const STORAGE_KEY = 'viastela.locale.v1';

let currentLocale: AppLocale = detectInitialLocale();
const listeners = new Set<() => void>();

function detectInitialLocale(): AppLocale {
  // Always default to 'zh' in Jest tests so existing assertions pass seamlessly
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return 'zh';
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'zh') {
        return saved;
      }
    }
  } catch {
    // Ignore storage access errors
  }
  return 'zh';
}

export function getAppLocale(): AppLocale {
  return currentLocale;
}

export function setAppLocale(next: AppLocale): void {
  if (currentLocale === next) return;
  currentLocale = next;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  } catch {
    // Ignore storage access errors
  }
  listeners.forEach((fn) => fn());
}

export function toggleAppLocale(): AppLocale {
  const next: AppLocale = currentLocale === 'zh' ? 'en' : 'zh';
  setAppLocale(next);
  return next;
}

export function subscribeAppLocale(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Pure helper for picking Chinese vs English copy.
 */
export function tr(zh: string, en: string, locale: AppLocale = currentLocale): string {
  return locale === 'en' ? en : zh;
}
