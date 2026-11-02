import { useEffect, useState } from 'react';

import {
  type AppLocale,
  getAppLocale,
  setAppLocale,
  subscribeAppLocale,
  toggleAppLocale,
} from '@/core/i18n';

export type { AppLocale };

/**
 * Reactive hook for components that render bilingual (`zh` / `en`) strings.
 */
export function useI18n(): {
  locale: AppLocale;
  isEn: boolean;
  setLocale: (next: AppLocale) => void;
  toggleLocale: () => AppLocale;
  t: (zh: string, en: string) => string;
} {
  const [locale, setLocaleState] = useState<AppLocale>(getAppLocale);

  useEffect(() => {
    return subscribeAppLocale(() => {
      setLocaleState(getAppLocale());
    });
  }, []);

  return {
    locale,
    isEn: locale === 'en',
    setLocale: setAppLocale,
    toggleLocale: toggleAppLocale,
    t: (zh: string, en: string) => (locale === 'en' ? en : zh),
  };
}
