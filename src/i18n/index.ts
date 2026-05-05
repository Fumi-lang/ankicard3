import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ja from './ja';
import en from './en';

/**
 * アプリ起動時の初期言語を決定する
 *
 * Zustand の persist ミドルウェアの hydration より前に呼ばれるため、
 * localStorage を直接読む（store を介すと初回描画が英語で一瞬フラッシュする）。
 *
 * 読み取り順:
 *   1. 新形式: Zustand persist キー 'memoryflow-settings' → state.appLanguage
 *   2. 旧形式: 直キー 'memoryflow_appLanguage'（旧バージョンとの後方互換）
 *   3. ブラウザロケール
 *   4. デフォルト 'ja'
 */
function detectLanguage(): 'ja' | 'en' {
  if (typeof window === 'undefined') return 'ja';
  try {
    // 1. 新形式（Zustand persist）
    const stored = localStorage.getItem('memoryflow-settings');
    if (stored) {
      const parsed = JSON.parse(stored);
      const lang = parsed?.state?.appLanguage;
      if (lang === 'ja' || lang === 'en') return lang;
    }
    // 2. 旧形式（後方互換）
    const legacy = localStorage.getItem('memoryflow_appLanguage');
    if (legacy === 'ja' || legacy === 'en') return legacy;
  } catch {
    // JSON パース失敗などは無視してフォールバックへ
  }
  // 3. ブラウザロケール
  if (typeof navigator !== 'undefined') {
    const lang = navigator.language?.toLowerCase();
    if (lang?.startsWith('ja')) return 'ja';
  }
  return 'ja';
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      ja: { translation: ja },
      en: { translation: en },
    },
    lng: detectLanguage(),
    fallbackLng: 'ja',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
