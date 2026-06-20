import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './locales/en.json';
import uk from './locales/uk.json';

const LANGUAGE_STORAGE_KEY = 'project-goods.lang';

function getInitialLanguage(): string {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'en' || saved === 'uk') {
      return saved;
    }
  } catch {
    // ignore
  }

  // Browser detection fallback
  const navLang =
    (typeof navigator !== 'undefined' &&
      (navigator.language || (navigator as unknown as { userLanguage?: string }).userLanguage)) ||
    '';
  return String(navLang).toLowerCase().startsWith('uk') ? 'uk' : 'en';
}

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    uk: { translation: uk },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'uk',
  supportedLngs: ['en', 'uk'],
  nonExplicitSupportedLngs: true,
  interpolation: {
    escapeValue: false,
  },
  debug: (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV ?? false,
  react: {
    useSuspense: false,
    bindI18n: 'languageChanged',
    bindI18nStore: 'added removed',
  },
});

i18n.on('languageChanged', (lng: string) => {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
  } catch {
    // ignore storage errors
  }
});

export default i18n;
