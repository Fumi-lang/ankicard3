import type { SupportedLanguage } from '../types';

/** 対応言語一覧 */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'ja',    name: '日本語',                   nameEn: 'Japanese',            speechLocale: 'ja-JP' },
  { code: 'en',    name: '英語',                     nameEn: 'English',             speechLocale: 'en-US' },
  { code: 'de',    name: 'ドイツ語',                 nameEn: 'German',              speechLocale: 'de-DE' },
  { code: 'fr',    name: 'フランス語',               nameEn: 'French',              speechLocale: 'fr-FR' },
  { code: 'es',    name: 'スペイン語',               nameEn: 'Spanish',             speechLocale: 'es-ES' },
  { code: 'it',    name: 'イタリア語',               nameEn: 'Italian',             speechLocale: 'it-IT' },
  { code: 'pt',    name: 'ポルトガル語',             nameEn: 'Portuguese',          speechLocale: 'pt-PT' },
  { code: 'zh',    name: '中国語',                   nameEn: 'Chinese',             speechLocale: 'zh-CN' },
  { code: 'ko',    name: '韓国語',                   nameEn: 'Korean',              speechLocale: 'ko-KR' },
  { code: 'ru',    name: 'ロシア語',                 nameEn: 'Russian',             speechLocale: 'ru-RU' },
  { code: 'ar',    name: 'アラビア語',               nameEn: 'Arabic',              speechLocale: 'ar-SA' },
  { code: 'nl',    name: 'オランダ語',               nameEn: 'Dutch',               speechLocale: 'nl-NL' },
  { code: 'da',    name: 'デンマーク語',             nameEn: 'Danish',              speechLocale: 'da-DK' },
  { code: 'no',    name: 'ノルウェー語',             nameEn: 'Norwegian',           speechLocale: 'nb-NO' },
  { code: 'sv',    name: 'スウェーデン語',           nameEn: 'Swedish',             speechLocale: 'sv-SE' },
  { code: 'fi',    name: 'フィンランド語',           nameEn: 'Finnish',             speechLocale: 'fi-FI' },
  { code: 'is',    name: 'アイスランド語',           nameEn: 'Icelandic',           speechLocale: 'is-IS' },
  { code: 'th',    name: 'タイ語',                   nameEn: 'Thai',                speechLocale: 'th-TH' },
  { code: 'bg',    name: 'ブルガリア語',             nameEn: 'Bulgarian',           speechLocale: 'bg-BG' },
  { code: 'pt-BR', name: 'ポルトガル語（ブラジル）', nameEn: 'Portuguese (Brazil)', speechLocale: 'pt-BR' },
];

/** 言語コードからWeb Speech APIのlocaleを返す。未対応の場合は 'en-US' にフォールバック */
export function toSpeechLocale(langCode: string): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === langCode);
  if (!lang) {
    console.warn(`[speechLocale] '${langCode}' は未対応です。en-US にフォールバックします。`);
    return 'en-US';
  }
  return lang.speechLocale;
}

/** 言語コードから表示名を返す（appLangに応じてja/enを切り替え）*/
export function getLangName(code: string, appLang: 'ja' | 'en' = 'ja'): string {
  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
  if (!lang) return code;
  return appLang === 'ja' ? lang.name : lang.nameEn;
}
