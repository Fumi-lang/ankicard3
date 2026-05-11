import type { AppLanguage, Tag } from '../types';

/**
 * デフォルトタグの表示名エイリアス。
 * キー = DB保存値（常に日本語）、値 = 言語別の表示名。
 * 将来のシステム提供タグ追加時にここへ追記する。
 */
const TAG_DISPLAY_ALIAS: Record<string, Record<AppLanguage, string>> = {
  '単語':   { ja: '単語',   en: 'Word'  },
  '穴埋め': { ja: '穴埋め', en: 'Cloze' },
};

/**
 * タグの内部名（DB保存値）を UI 言語に応じた表示名に変換する。
 * エイリアスが定義されていないタグはそのまま返す。
 *
 * @param tagName    DB に保存されているタグ名（常に日本語）
 * @param lang       現在の UI 言語
 */
export function getTagDisplayName(tagName: string, lang: AppLanguage): string {
  return TAG_DISPLAY_ALIAS[tagName]?.[lang] ?? tagName;
}

/**
 * Tag エンティティを受け取り、UI 言語に応じた表示名を返す。
 *
 * @param tag  Tag エンティティ
 * @param lang 現在の UI 言語
 */
export function getTagDisplayNameFromEntity(tag: Tag, lang: AppLanguage): string {
  return getTagDisplayName(tag.name, lang);
}
