import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppLanguage } from '../types';
import i18n from '../i18n';

interface SettingsState {
  appLanguage: AppLanguage;
  /** デッキ作成モーダル・カード作成画面の初期値として参照（設定UIは持たない）*/
  defaultSourceLang: string;
  defaultTargetLang: string;
  autoPlaySpeech: boolean;
  speechRate: number;

  setAppLanguage: (lang: AppLanguage) => void;
  setDefaultSourceLang: (lang: string) => void;
  setDefaultTargetLang: (lang: string) => void;
  setAutoPlaySpeech: (value: boolean) => void;
  setSpeechRate: (rate: number) => void;
}

/** アプリ設定のストア（Zustand + persist）— localStorage に自動永続化 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      appLanguage: 'ja',
      defaultSourceLang: 'ja',
      defaultTargetLang: 'en',
      autoPlaySpeech: false,
      speechRate: 1.0,

      setAppLanguage: (lang) => {
        // i18next にも通知して UI テキストを即時切り替える
        i18n.changeLanguage(lang);
        set({ appLanguage: lang });
      },
      setDefaultSourceLang: (lang) => set({ defaultSourceLang: lang }),
      setDefaultTargetLang: (lang) => set({ defaultTargetLang: lang }),
      setAutoPlaySpeech: (value) => set({ autoPlaySpeech: value }),
      setSpeechRate: (rate) => set({ speechRate: rate }),
    }),
    {
      name: 'memoryflow-settings',
      storage: createJSONStorage(() => {
        // SSR / localStorage 未対応環境ではメモリ上のダミーを返す
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return localStorage;
      }),
      // 関数（setter）をシリアライズ対象から除外する
      partialize: (state) => ({
        appLanguage: state.appLanguage,
        defaultSourceLang: state.defaultSourceLang,
        defaultTargetLang: state.defaultTargetLang,
        autoPlaySpeech: state.autoPlaySpeech,
        speechRate: state.speechRate,
      }),
    }
  )
);
