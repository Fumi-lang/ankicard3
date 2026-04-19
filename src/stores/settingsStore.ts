import { create } from 'zustand';
import type { AppLanguage } from '../types';

interface SettingsState {
  appLanguage: AppLanguage;
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

/** アプリ設定のストア（Zustand）*/
export const useSettingsStore = create<SettingsState>((set) => ({
  appLanguage: 'ja',
  defaultSourceLang: 'ja',
  defaultTargetLang: 'en',
  autoPlaySpeech: false,
  speechRate: 1.0,

  setAppLanguage: (lang) => set({ appLanguage: lang }),
  setDefaultSourceLang: (lang) => set({ defaultSourceLang: lang }),
  setDefaultTargetLang: (lang) => set({ defaultTargetLang: lang }),
  setAutoPlaySpeech: (value) => set({ autoPlaySpeech: value }),
  setSpeechRate: (rate) => set({ speechRate: rate }),
}));
