import type { CardForm } from '../types';
import { getLangName } from '../utils/speechLocale';

/** Claude用プロンプトの生成（カードフォーム別）*/
export function buildPrompt(
  cardForm: CardForm,
  items: string[],
  sourceLang: string,
  targetLang: string,
  cardCount: number = 5
): string {
  const sourceLangName = getLangName(sourceLang, 'ja');
  const targetLangName = getLangName(targetLang, 'ja');
  const itemList = items.map((item, i) => `${i + 1}. ${item.trim()}`).join('\n');

  if (cardForm === 'translation') {
    return buildTranslationPrompt(itemList, sourceLangName, targetLangName, cardCount);
  } else {
    return buildClozePrompt(itemList, sourceLangName, targetLangName, cardCount);
  }
}

function buildTranslationPrompt(
  itemList: string,
  sourceLangName: string,
  targetLangName: string,
  cardCount: number
): string {
  return `あなたは外国語教育の専門家です。
以下の${sourceLangName}の単語・フレーズを${targetLangName}に翻訳し、${cardCount}枚の翻訳カードをJSON形式で返してください。

【入力リスト】
${itemList}

【出力形式】
以下のJSON配列のみを返してください（マークダウン装飾不要）。

[
  {
    "form": "translation",
    "front": "${sourceLangName}のテキスト",
    "back": "${targetLangName}のテキスト",
    "wordLevel": "A1/A2/B1/B2/C1/C2のいずれか"
  }
]
※各入力につき1件生成してください。wordLevelはCEFR基準で推定してください。`;
}

function buildClozePrompt(
  itemList: string,
  sourceLangName: string,
  targetLangName: string,
  cardCount: number
): string {
  return `あなたは多言語教育の専門家です。
以下の単語・フレーズを使った穴埋めカードを${cardCount}枚分生成してください。

【入力】
${itemList}

【手順】
まず暗記対象の単語のCEFRレベルを判定してください。
次に、そのレベルに応じた難易度ルールに従って例文を生成してください。

【難易度ルール】

■ 暗記対象がA1レベルの場合:
  難易度の制限を適用しない
  （使用できる語彙が少なすぎて例文が不自然になるため）

■ 暗記対象がA2・B1・B2レベルの場合:
  例文全体の難易度をA2〜B2の範囲に収めること

■ 暗記対象がC1以上のレベルの場合:
  例文中の暗記対象以外の単語は、暗記対象の一つ下のレベルまでに抑えること
  例）暗記対象がC1 → 例文内の他の単語はB2以下
  例）暗記対象がC2 → 例文内の他の単語はC1以下
  ※ 暗記対象の単語自体は ___ で隠すため、
     例文中で学習者が知らない単語が複数出現するリスクを最小化する

【重要】
- 暗記対象の単語は必ず ___ （アンダースコア3つ）で置き換えること
- 例文は自然な${targetLangName}の文章にすること
- 複数枚の場合は異なる文脈・用法の例文を生成すること
- 単語単体のカードは生成せず、必ず例文形式にすること

【出力形式】
以下のJSON配列のみを返してください（マークダウン装飾不要）。
※ frontには必ず「単語（${sourceLangName}での訳）」の形式で訳語を付けること
※ 例: appropriate（適切な）/ grasp（把握する）/ foundation（基礎）

[
  {
    "form": "cloze",
    "front": "穴埋めの答えとなる単語（訳語付き）例: appropriate（適切な）",
    "back": "___ を含む穴埋め例文（${targetLangName}）",
    "wordLevel": "暗記対象単語のCEFRレベル（A1/A2/B1/B2/C1/C2）",
    "sentenceLevel": "例文全体のCEFRレベル（A1/A2/B1/B2/C1/C2）",
    "contextNote": "この例文が使われる場面・文脈の説明"
  }
]

【出力例】
入力: appropriate（wordLevel判定: B2）
[
  {
    "form": "cloze",
    "front": "appropriate（適切な）",
    "back": "Please wear ___ clothes to the ceremony.",
    "wordLevel": "B2",
    "sentenceLevel": "B1",
    "contextNote": "服装・マナーの文脈での使用例"
  }
]`;
}

/** 入力テキストを配列に変換（カンマ・改行区切り）*/
export function parseInputItems(input: string): string[] {
  return input
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
