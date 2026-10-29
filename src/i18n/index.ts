import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import common from './en/common.json';

export const defaultNS = 'common';
export const resources = { en: { common } } as const;

// English first; Arabic joins when the translations are supplied (PROMPT §2.15).
void i18n.use(initReactI18next).init({
  lng: 'en',
  fallbackLng: 'en',
  defaultNS,
  resources,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
