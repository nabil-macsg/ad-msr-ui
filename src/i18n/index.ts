import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ar from './ar/common.json';
import common from './en/common.json';

export const defaultNS = 'common';
export const resources = { en: { common }, ar: { common: ar } } as const;

export type Language = 'en' | 'ar';
const STORAGE_KEY = 'masar.language';

function savedLanguage(): Language {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'ar' ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

/** Arabic turns the whole page right-to-left; English sets it back. */
function applyDirection(lng: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
}

// English and Arabic (PROMPT §2.15); the choice is kept in this browser.
void i18n.use(initReactI18next).init({
  lng: savedLanguage(),
  fallbackLng: 'en',
  defaultNS,
  resources,
  interpolation: { escapeValue: false },
  returnNull: false,
});
applyDirection(i18n.language);
i18n.on('languageChanged', (lng) => {
  applyDirection(lng);
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // Private windows may refuse storage; the switch still works for this visit.
  }
});

export default i18n;
