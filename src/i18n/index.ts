import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from './ja';
import en from './en';

/** ブラウザのロケールからデフォルト言語を検出（ja以外はenにフォールバック）*/
function detectLanguage(): 'ja' | 'en' {
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language?.toLowerCase();
    if (lang?.startsWith('ja')) return 'ja';
  }
  return 'en';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: ja },
      en: { translation: en },
    },
    lng: detectLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
