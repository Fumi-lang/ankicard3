import type { CardForm } from '../types';
import { getLangName } from '../utils/speechLocale';
import {
  getSceneCategoryById,
  getSceneSubcategoryById,
  getRegisterById,
} from '../utils/sceneCategories';

/** シーン指定パラメータ */
export interface SceneParam {
  categoryId: string | null;
  subcategoryId: string | null;
  registerId?: string | null;
}

/** Claude用プロンプトの生成（カードフォーム別）*/
export function buildPrompt(
  cardForm: CardForm,
  items: string[],
  sourceLang: string,
  targetLang: string,
  cardCount: number = 5,
  scene?: SceneParam
): string {
  const sourceLangName = getLangName(sourceLang, 'ja');
  const targetLangName = getLangName(targetLang, 'ja');
  const itemList = items.map((item, i) => `${i + 1}. ${item.trim()}`).join('\n');

  if (cardForm === 'translation') {
    return buildTranslationPrompt(itemList, sourceLangName, targetLangName, cardCount);
  } else {
    return buildClozePrompt(itemList, sourceLangName, targetLangName, cardCount, scene);
  }
}

function buildTranslationPrompt(
  itemList: string,
  sourceLangName: string,
  targetLangName: string,
  cardCount: number
): string {
  return `あなたは外国語教育の専門家です。
以下の${sourceLangName}の単語・フレーズについて、
1つの単語・フレーズにつき${cardCount}枚ずつ翻訳カードを生成してください。

【入力リスト】
${itemList}

【ルール】
- wordLevelはCEFR基準で推定してください
- 1枚目: 最も基本的な意味・用法のカードを生成すること
- 2枚目以降（${cardCount} >= 2 の場合）:
  異なる意味・コロケーション・慣用表現を使ったカードを生成すること
  例）determine の2枚目: be determined to do（〜しようと決意している）
  例）determine の3枚目: determine the cause（原因を特定する）

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
※ 各入力につき${cardCount}枚ずつ生成してください。
   入力が5単語でcardCount=3の場合、合計15枚を出力してください。`;
}

function buildClozePrompt(
  itemList: string,
  sourceLangName: string,
  targetLangName: string,
  cardCount: number,
  scene?: SceneParam
): string {
  // シーン指定行を生成（指定なし＝自動の場合は空文字）
  let sceneInstruction = '';
  if (scene?.subcategoryId && scene.categoryId) {
    // サブカテゴリーが明示指定されている場合
    const sub = getSceneSubcategoryById(scene.categoryId, scene.subcategoryId);
    if (sub) {
      sceneInstruction = `\n- 例文は「${sub.prompt}」のシーンに合ったものにすること`;
    }
  } else if (scene?.categoryId) {
    // カテゴリーのみ選択（サブカテゴリーは自動）→ 全サブカテゴリーの prompt を列挙
    const cat = getSceneCategoryById(scene.categoryId);
    if (cat && cat.subcategories.length > 0) {
      const subList = cat.subcategories
        .map((s) => `    ・${s.prompt}`)
        .join('\n');
      sceneInstruction = `\n- 例文は以下のいずれかの場面に合ったものにすること:\n${subList}`;
    }
  }

  // 文体（レジスター）指定行を生成
  let registerInstruction = '';
  if (scene?.registerId) {
    const reg = getRegisterById(scene.registerId);
    if (reg) {
      registerInstruction = `\n- ${reg.prompt}`;
    }
  }

  return `あなたは多言語教育の専門家です。
以下の単語・フレーズを使った穴埋めカードを、
1つの単語・フレーズにつき${cardCount}枚ずつ生成してください。

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
- 単語単体のカードは生成せず、必ず例文形式にすること${sceneInstruction}${registerInstruction}

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
    "contextNote": "穴埋めの答えとなる単語の意味・定義を${sourceLangName}で説明する（1〜2文程度）"
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
    "contextNote": "適切な・ふさわしい、という意味の形容詞。ある状況や目的に対して正しくマッチしていることを表す。"
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
