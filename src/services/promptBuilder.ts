import type { CardType } from '../types';
import { getLangName } from '../utils/speechLocale';

/** Claude用プロンプトの生成（カードタイプ別）*/
export function buildPrompt(
  cardType: CardType,
  items: string[],
  sourceLang: string,
  targetLang: string
): string {
  const sourceLangName = getLangName(sourceLang, 'ja');
  const targetLangName = getLangName(targetLang, 'ja');

  const itemList = items.map((item, i) => `${i + 1}. ${item.trim()}`).join('\n');
  const conjugationNote = getConjugationNote(targetLang);

  switch (cardType) {
    case 'word':
      return buildWordPrompt(itemList, sourceLangName, targetLangName, conjugationNote);
    case 'collocation':
      return buildCollocationPrompt(itemList, sourceLangName, targetLangName);
    case 'sentence':
      return buildSentencePrompt(itemList, sourceLangName, targetLangName);
  }
}

function buildWordPrompt(
  itemList: string,
  sourceLangName: string,
  targetLangName: string,
  conjugationNote: string
): string {
  return `あなたは多言語辞書の専門家です。
以下の${sourceLangName}の単語を${targetLangName}に翻訳し、各単語について詳細な情報をJSON形式で返してください。

【単語リスト】
${itemList}

【出力形式】
以下のJSON配列のみを返してください（マークダウン装飾不要）。

[
  {
    "type": "word",
    "original": "元の単語",
    "translation": "翻訳結果",
    "partOfSpeech": "noun/verb/adjective/adverb/other",
    "pronunciation": "発音表記",
    "exampleSentence": "${targetLangName}での例文",
    "collocations": ["よく使われるコロケーション1", "コロケーション2"],
    "contextNote": "使用上のニュアンスや注意点",
    "noun": { "gender": "...", "plural": "...", "genitive": "..." },
    "verb": {
      "pastTense": "...", "pastParticiple": "...",
      "conjugation": { ${conjugationNote} },
      "irregular": true
    },
    "adjective": { "comparative": "...", "superlative": "..." }
  }
]
※該当しないフィールドはnullにしてください。`;
}

function buildCollocationPrompt(
  itemList: string,
  sourceLangName: string,
  targetLangName: string
): string {
  return `あなたは多言語コーパスの専門家です。
以下のキーワードを核として、${targetLangName}でよく使われるコロケーションを${sourceLangName}訳付きでJSON形式で返してください。

【キーワード】
${itemList}

【出力形式】
[
  {
    "type": "collocation",
    "keyword": "核となるキーワード（${targetLangName}）",
    "original": "コロケーション全体（${targetLangName}）",
    "translation": "コロケーション全体（${sourceLangName}）",
    "exampleSentence": "コロケーションを含む自然な例文（${targetLangName}）",
    "contextNote": "どんな場面で使うか・文体（formal/informal）"
  }
]
※各キーワードにつき2〜4件のコロケーションを生成してください。
以下のJSON配列のみを返してください（マークダウン装飾不要）。`;
}

function buildSentencePrompt(
  itemList: string,
  sourceLangName: string,
  targetLangName: string
): string {
  return `あなたは外国語教育の専門家です。
以下のテーマ・キーワードに基づいて実用的な${targetLangName}の例文を作成し、${sourceLangName}訳付きでJSON形式で返してください。

【テーマ/キーワード】
${itemList}

【出力形式】
[
  {
    "type": "sentence",
    "original": "例文（${sourceLangName}）",
    "translation": "例文（${targetLangName}）",
    "level": "A1/A2/B1/B2/C1/C2",
    "contextNote": "場面・文体・使用シーン"
  }
]
※各テーマにつき2〜3件の例文を生成してください。
以下のJSON配列のみを返してください（マークダウン装飾不要）。`;
}

/** 言語別の動詞活用テンプレートを返す */
function getConjugationNote(targetLang: string): string {
  const map: Record<string, string> = {
    da: '"不定形のみ（人称変化なし）": "..."',
    no: '"不定形のみ（人称変化なし）": "..."',
    sv: '"不定形のみ（人称変化なし）": "..."',
    fi: '"minä": "...", "sinä": "...", "hän": "...", "me": "...", "te": "...", "he": "..."',
    is: '"ég": "...", "þú": "...", "hann/hún": "...", "við": "...", "þið": "...", "þeir": "..."',
    de: '"ich": "...", "du": "...", "er": "...", "wir": "...", "ihr": "...", "sie": "..."',
    fr: '"je": "...", "tu": "...", "il": "...", "nous": "...", "vous": "...", "ils": "..."',
    es: '"yo": "...", "tú": "...", "él": "...", "nosotros": "...", "vosotros": "...", "ellos": "..."',
    it: '"io": "...", "tu": "...", "lui": "...", "noi": "...", "voi": "...", "loro": "..."',
    en: '"三人称単数(he/she/it)": "...(s付加規則と例外)"',
  };
  return map[targetLang] ?? '"各人称": "..."';
}

/** 入力テキストを配列に変換（カンマ・改行区切り）*/
export function parseInputItems(input: string): string[] {
  return input
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
