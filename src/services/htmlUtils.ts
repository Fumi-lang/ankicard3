/**
 * Anki フィールド HTML クリーンアップユーティリティ
 *
 * Anki のフィールドは HTML マークアップ・エンティティ・サウンドタグ・画像タグを
 * 含む場合がある。MemoryFlow ではプレーンテキストのみを扱うため、
 * インポート時にここで正規化する。
 */

/** HTML タグをすべて除去してプレーンテキストを返す */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** 基本的な HTML エンティティをデコードする */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Anki フィールド文字列をプレーンテキストに変換する
 *
 * 変換手順:
 * 1. [sound:...] タグを削除
 * 2. <img ...> タグを削除
 * 3. HTML タグを除去
 * 4. HTML エンティティをデコード
 * 5. 連続する空白・改行を正規化
 */
export function cleanHtml(raw: string): string {
  let text = raw;
  // [sound:...] を削除
  text = text.replace(/\[sound:[^\]]*\]/gi, '');
  // <img ...> を削除
  text = text.replace(/<img[^>]*>/gi, '');
  // <br>, <br/>, <br /> を改行に変換
  text = text.replace(/<br\s*\/?>/gi, '\n');
  // HTML タグを除去
  text = stripTags(text);
  // エンティティをデコード
  text = decodeHtmlEntities(text);
  // 行頭・行末の空白を除去し、空行を畳む
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line, i, arr) => line !== '' || (i > 0 && arr[i - 1] !== ''))
    .join('\n');
  return text.trim();
}
