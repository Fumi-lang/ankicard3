import type { ImportedCardData, CardType, DeckExportData } from '../types';

/** MemoryFlow独自フォーマットかどうかを判定 */
export function isMemoryFlowFormat(data: unknown): data is DeckExportData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return typeof d.version === 'string' && d.deck !== undefined && Array.isArray(d.cards);
}

/**
 * JSON文字列を解析してImportedCardData[]に変換する
 *
 * 対応フォーマット:
 * 1. Claude出力形式: [{original, translation, type, ...}]
 * 2. 配列形式: [{front, back}]
 * 3. シンプルオブジェクト: {"単語": "訳語", ...}
 * 4. MemoryFlow形式: DeckExportData（呼び出し元で別処理）
 */
export function parseJSONCards(text: string): { cards: ImportedCardData[]; isMemoryFlow: boolean; deckExport?: DeckExportData } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('JSON_PARSE_FAILED');
  }

  // MemoryFlow形式の判定
  if (isMemoryFlowFormat(parsed)) {
    return {
      cards: parsed.cards.map((c) => ({
        cardType: c.cardType,
        frontText: c.frontText,
        backText: c.backText,
        extraInfo: c.extraInfo,
        isValid: !!(c.frontText && c.backText),
      })),
      isMemoryFlow: true,
      deckExport: parsed,
    };
  }

  // 配列形式
  if (Array.isArray(parsed)) {
    return { cards: parsed.map((item, i) => mapJSONItem(item, i)), isMemoryFlow: false };
  }

  // シンプルオブジェクト {"単語": "訳語"} 形式
  if (parsed && typeof parsed === 'object') {
    const entries = Object.entries(parsed as Record<string, unknown>);
    return {
      cards: entries.map(([key, val], i) => ({
        cardType: 'word' as CardType,
        frontText: key.trim(),
        backText: String(val).trim(),
        isValid: !!(key.trim() && String(val).trim()),
        errorMessage: !key.trim() || !String(val).trim() ? `行 ${i + 1}: 空のエントリ` : undefined,
      })),
      isMemoryFlow: false,
    };
  }

  throw new Error('JSON_PARSE_FAILED');
}

function mapJSONItem(item: unknown, index: number): ImportedCardData {
  if (!item || typeof item !== 'object') {
    return { cardType: 'word', frontText: '', backText: '', isValid: false, errorMessage: `行 ${index + 1}: 無効なデータ` };
  }

  const obj = item as Record<string, unknown>;
  const typeRaw = String(obj.type ?? 'word').toLowerCase();
  const validTypes: CardType[] = ['word', 'collocation', 'sentence'];
  const cardType: CardType = validTypes.includes(typeRaw as CardType) ? (typeRaw as CardType) : 'word';

  const frontText = String(obj.original ?? obj.front ?? obj.frontText ?? obj.question ?? '').trim();
  const backText = String(obj.translation ?? obj.back ?? obj.backText ?? obj.answer ?? '').trim();

  if (!frontText || !backText) {
    return { cardType, frontText, backText, isValid: false, errorMessage: `行 ${index + 1}: 表面または裏面が空です` };
  }

  return { cardType, frontText, backText, isValid: true };
}
