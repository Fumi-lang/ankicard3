import type { ImportedCardData, CardType, CardExtraInfo } from '../types';

/**
 * ClaudeのレスポンステキストからJSONを抽出してImportedCardData[]に変換する
 *
 * 抽出順序: ```json...``` → [...] → {...}
 */
export function parseClaudeResponse(text: string): ImportedCardData[] {
  const json = extractJSON(text);
  if (!json) {
    throw new Error('JSON_PARSE_FAILED');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('JSON_PARSE_FAILED');
  }

  if (!Array.isArray(parsed)) {
    throw new Error('JSON_PARSE_FAILED');
  }

  return parsed.map((item, index) => {
    try {
      return mapToCardData(item as Record<string, unknown>);
    } catch {
      return {
        cardType: 'word' as CardType,
        frontText: '',
        backText: '',
        isValid: false,
        errorMessage: `行 ${index + 1}: データの解析に失敗しました`,
      };
    }
  });
}

/** テキストからJSONブロックを抽出 */
function extractJSON(text: string): string | null {
  // ```json ... ``` ブロックを探す
  const codeBlockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // ``` ... ``` ブロックを探す
  const codeMatch = text.match(/```\s*([\s\S]*?)```/);
  if (codeMatch) {
    const inner = codeMatch[1].trim();
    if (inner.startsWith('[') || inner.startsWith('{')) return inner;
  }

  // 配列 [...] を探す
  const arrayMatch = text.match(/(\[[\s\S]*\])/);
  if (arrayMatch) return arrayMatch[1];

  // オブジェクト {...} を探す
  const objMatch = text.match(/(\{[\s\S]*\})/);
  if (objMatch) return `[${objMatch[1]}]`;

  return null;
}

/** JSONオブジェクトをImportedCardDataにマッピング */
function mapToCardData(item: Record<string, unknown>): ImportedCardData {
  const type = String(item.type ?? 'word');
  const cardType: CardType = (['word', 'collocation', 'sentence'] as CardType[]).includes(type as CardType)
    ? (type as CardType)
    : 'word';

  const frontText = String(item.original ?? item.front ?? item.frontText ?? '').trim();
  const backText = String(item.translation ?? item.back ?? item.backText ?? '').trim();

  if (!frontText || !backText) {
    return {
      cardType,
      frontText,
      backText,
      isValid: false,
      errorMessage: '表面または裏面のテキストが空です',
    };
  }

  const extraInfo: Partial<CardExtraInfo> = {};

  if (item.partOfSpeech) extraInfo.partOfSpeech = String(item.partOfSpeech);
  if (item.pronunciation) extraInfo.pronunciation = String(item.pronunciation);
  if (item.exampleSentence) extraInfo.exampleSentence = String(item.exampleSentence);
  if (item.contextNote) extraInfo.contextNote = String(item.contextNote);
  if (Array.isArray(item.collocations)) {
    extraInfo.collocations = item.collocations.map(String).filter(Boolean);
  }
  if (item.noun && typeof item.noun === 'object') {
    const n = item.noun as Record<string, unknown>;
    extraInfo.noun = {
      gender: n.gender ? String(n.gender) : undefined,
      plural: n.plural ? String(n.plural) : undefined,
      genitive: n.genitive ? String(n.genitive) : undefined,
    };
  }
  if (item.verb && typeof item.verb === 'object') {
    const v = item.verb as Record<string, unknown>;
    extraInfo.verb = {
      pastTense: v.pastTense ? String(v.pastTense) : undefined,
      pastParticiple: v.pastParticiple ? String(v.pastParticiple) : undefined,
      irregular: Boolean(v.irregular),
      conjugation: v.conjugation && typeof v.conjugation === 'object'
        ? Object.fromEntries(
            Object.entries(v.conjugation as Record<string, unknown>).map(([k, val]) => [k, String(val)])
          )
        : undefined,
    };
  }
  if (item.adjective && typeof item.adjective === 'object') {
    const a = item.adjective as Record<string, unknown>;
    extraInfo.adjective = {
      comparative: a.comparative ? String(a.comparative) : undefined,
      superlative: a.superlative ? String(a.superlative) : undefined,
    };
  }

  return {
    cardType,
    frontText,
    backText,
    extraInfo: Object.keys(extraInfo).length > 0 ? extraInfo : undefined,
    isValid: true,
  };
}
