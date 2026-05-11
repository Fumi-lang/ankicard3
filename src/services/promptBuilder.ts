import type { CardForm } from '../types';
import { getLangName } from '../utils/speechLocale';

// ─── 難易度 ───────────────────────────────────────────────────────────────────

/**
 * 穴埋めカード生成の難易度モード。
 * 現在のUIでは 'auto' | 'academic_article' | 'informal_slang' の3値を表示。
 * 将来的に 'easy' | 'normal' | 'hard' を追加予定のため型を先行定義。
 */
export type DifficultyMode = 'auto' | 'academic_article' | 'informal_slang' | 'easy' | 'normal' | 'hard';

/** 難易度パラメータ */
export interface DifficultyParam {
  mode: DifficultyMode;
}

// ─── メインエントリ ───────────────────────────────────────────────────────────

/** Claude用プロンプトの生成（カードフォーム別）*/
export function buildPrompt(
  cardForm: CardForm,
  items: string[],
  sourceLang: string,
  targetLang: string,
  cardCount: number = 5,
  difficulty?: DifficultyParam
): string {
  const sourceLangName = getLangName(sourceLang, 'ja');
  const targetLangName = getLangName(targetLang, 'ja');
  const itemList = items.map((item, i) => `${i + 1}. ${item.trim()}`).join('\n');

  if (cardForm === 'translation') {
    return buildTranslationPrompt(itemList, sourceLangName, targetLangName, cardCount);
  } else {
    return buildClozePrompt(itemList, sourceLangName, targetLangName, cardCount, difficulty);
  }
}

// ─── 翻訳カード プロンプト ────────────────────────────────────────────────────

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

// ─── 穴埋めカード プロンプト ──────────────────────────────────────────────────

function buildClozePrompt(
  itemList: string,
  sourceLangName: string,
  targetLangName: string,
  cardCount: number,
  difficulty?: DifficultyParam
): string {
  const mode = difficulty?.mode ?? 'auto';

  // 「学術/記事」モードは専用プロンプトを返す
  if (mode === 'academic_article') {
    return buildAcademicClozePrompt(itemList, sourceLangName, targetLangName, cardCount);
  }

  // インフォーマル/スラングモードの追加指示
  const informalSection =
    mode === 'informal_slang'
      ? `
【文体: インフォーマル/スラング】
口語・カジュアルな文体を使用してください:
- 省略形（gonna, wanna, ain't, kinda, y'all など）を積極的に使用
- SNS・友人会話・テキストメッセージのトーン
- 文法的な「正しさ」を一部緩和（口語特有の崩し表現を許可）
- ただし過度に下品・差別的な表現は避けること
`
      : '';

  return `あなたは多言語教育の専門家です。
以下の単語・フレーズを使った穴埋めカードを、
1つの単語・フレーズにつき${cardCount}枚ずつ生成してください。

【学習目的】
このカードは語彙学習目的の暗記カードです。学習者が対象単語を覚えることが最優先。
例文の文学的美しさや凝った表現よりも、明快で覚えやすいことを優先してください。

【入力】
${itemList}

【多義語の意味指定について】
入力に「(意味の指定)」がある場合（例: bank (financial institution)）、その意味のみで例文を作成し、他の意味は使わないこと。
CEFRレベルの判定は単語本体のみで行うこと（例: bank (financial institution) → "bank" のレベルで判定）。

【手順 ─ 各単語について以下のステップを実行してください】

ステップA: 対象単語のCEFRレベルを判定（A1/A2/B1/B2/C1/C2）

ステップB: 周辺語彙のレベル制限
  例文中の対象単語以外の語彙を以下のレベルに制限すること:
  C2 → B2以下
  C1 → B2以下
  B2 → B1以下
  B1 → A2以下
  A2 → A1〜A2
  A1 → A1〜A2

ステップC: 許容する文法レンジ
  A1〜A2 → 現在形、過去形、現在進行形、現在完了形、基本助動詞
  B1     → 上記に加え受動態、関係代名詞、to不定詞・動名詞、第一・二条件文
  B2     → 上記に加え第三条件文、仮定法過去・過去完了、分詞構文、関係副詞
  C1〜C2 → 上記に加え倒置、強調構文、無生物主語、抽象名詞構文、多重従属節

ステップD: 例文の長さ目安（最大12語を全レベルで厳守）
  A1〜A2 → 6〜9語
  B1〜B2 → 8〜11語
  C1〜C2 → 9〜12語

ステップE: 場面・情景の決定
  対象単語が最もよく使われる自然な場面・情景を判断してください。
  例: epistemological → 哲学・学術討論
  例: house → 家庭、住宅市場
  例: run → スポーツ、経営、選挙、機械の動作
  複数枚の場合は場面の多様性を意識すること。
${informalSection}
ステップF: コロケーションの決定と多様性の確保
  対象単語の自然なコロケーション（前置詞、接続詞、頻出パートナー語）を使った例文を作成すること。
  【重要】${cardCount}枚生成する場合、各カードには必ず異なるコロケーションパターンを使用すること。
  同じパターンを2回以上使ってはならない。
  例: "subsequent" を5枚生成する場合:
    1枚目: subsequent to（前置詞句）
    2枚目: subsequent events（名詞修飾）
    3枚目: in subsequent years（副詞句）
    4枚目: subsequent decisions（別名詞パートナー）
    5枚目: subsequent to + 動名詞（構文パターン）

ステップG: 例文と答えの生成

【制約 ─ 必ず守ること】
1. 例文中の他の語彙は、対象単語よりも明らかに簡単であること（対象単語がカード上で最も目立つ存在になること）
2. 例文の最大長は12語。指定された目安範囲内に収めること
3. 対象単語の活用形（過去形、過去分詞、現在分詞、三人称単数形、複数形など）を例文中で使用してよい
   例: "run" → "ran", "running", "runs" として使用可
   例: "house" → "houses" として使用可
   活用された形を ___ で置き換える。答え（frontフィールド）は原形で記載すること
4. 対象単語（の活用形）は必ず ___ （アンダースコア3つ）で置き換えること

【出力形式】
以下のJSON配列のみを返してください（マークダウン装飾不要）。
※ frontには必ず「単語の原形（${sourceLangName}での訳）」の形式で訳語を付けること
※ 例: appropriate（適切な）/ grasp（把握する）/ run（走る）

[
  {
    "form": "cloze",
    "front": "穴埋めの答えとなる単語・原形（訳語付き）例: appropriate（適切な）",
    "back": "___ を含む穴埋め例文（${targetLangName}）",
    "wordLevel": "対象単語のCEFRレベル（A1/A2/B1/B2/C1/C2）",
    "sentenceLevel": "例文全体のCEFRレベル（A1/A2/B1/B2/C1/C2）",
    "contextNote": "穴埋めの答えとなる単語の意味・定義を${sourceLangName}で説明する（1〜2文程度）"
  }
]

【出力例】
入力: appropriate（ステップA判定: B2）
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

// ─── 学術/記事モード 穴埋めカード プロンプト ──────────────────────────────────

function buildAcademicClozePrompt(
  itemList: string,
  sourceLangName: string,
  targetLangName: string,
  cardCount: number
): string {
  return `あなたは多言語教育の専門家です。
以下の単語・フレーズを使った穴埋めカードを「学術/記事」モードで、
1つの単語・フレーズにつき${cardCount}枚ずつ生成してください。

【学習目的】
このカードは語彙学習目的の暗記カードです。学習者が対象単語を覚えることが最優先。

【入力】
${itemList}

【多義語の意味指定について】
入力に「(意味の指定)」がある場合（例: bank (financial institution)）、その意味のみで例文を作成し、他の意味は使わないこと。
CEFRレベルの判定は単語本体のみで行うこと（例: bank (financial institution) → "bank" のレベルで判定）。

【対象学習者】
このモードを選ぶ学習者は、対象単語のレベルに関わらずB2レベル以上の英語読解力を持っていると想定してください。
学習者は高度な文法と語彙を理解できますが、対象単語自体は新しく学ぶ語として扱います。

【手順 ─ 各単語について以下のステップを実行してください】

ステップA: 対象単語のCEFRレベルを判定（A1/A2/B1/B2/C1/C2）

ステップB: 周辺語彙のレベル
  対象単語がC2の場合: 周辺語彙はC1以下を使用可能
  それ以外の場合（C1以下）: 周辺語彙はB2以下を使用可能

ステップC: 文法レンジ（全解放）
  すべての文法構造を使用可能。A1〜C2のいずれの文法構造も制限なし。
  倒置、強調構文、無生物主語、抽象名詞構文、多重従属節、複雑な関係詞節、
  分詞構文、仮定法、虚辞構文、二重否定など、すべて許可。

ステップD: 例文の長さ（最大12語厳守）
  すべての単語レベルで 8〜12語。12語を厳守すること。

ステップE: 場面・情景と文体タイプの選択
  対象単語が最もよく使われる場面を判断し、以下の3タイプのうち最も自然なものを選んでください:

  タイプ1 — 生活系記事
    対象単語例: kitchen, recipe, travel, fashion, hobby
    文脈: ライフスタイル雑誌、料理コラム、旅行記事、Wikipedia風解説、家電レビュー
    文体: 一般読者向けの解説調、親しみやすい

  タイプ2 — ブレイキングニュース・時事記事
    対象単語例: policy, election, crisis, subsequent, unprecedented
    文脈: BBC・Reuters・New York Timesなどの政治・経済・社会面記事
    文体: ニュース調、客観的、情報密度が高い

  タイプ3 — 学術論文・科学記事・お堅い政治経済記事
    対象単語例: epistemological, paradigm, empirical, tantamount, hegemony
    文脈: 査読付き論文、Foreign Affairs、The Economist、哲学書、文学批評
    文体: 学術調、抽象的、論理的、専門用語を厭わない

  複数枚生成する場合は場面の多様性を意識すること。

ステップF: コロケーションの決定と多様性の確保
  対象単語の自然なコロケーション（前置詞、接続詞、頻出パートナー語）を使った例文を作成。
  【重要】${cardCount}枚生成する場合、各カードには必ず異なるコロケーションパターンを使用すること。
  同じパターンを2回以上使ってはならない。
  例: "subsequent" を5枚生成する場合:
    1枚目: subsequent to（前置詞句）
    2枚目: subsequent events（名詞修飾）
    3枚目: in subsequent years（副詞句）
    4枚目: subsequent decisions（別名詞パートナー）
    5枚目: subsequent to + 動名詞（構文パターン）

ステップG: 例文と答えの生成

【制約 ─ 必ず守ること】
1. 周辺語彙は上記ステップBのレベル制限内に収めること
2. 例文の最大長は12語（厳守）。8〜12語の範囲で、自然な記事文体を優先して長さを決定すること。
   記事調の文体は冗長になりがちだが、対象単語を学習することが第一義的目的のため12語を厳守すること
3. 対象単語の活用形（過去形、過去分詞、現在分詞、三人称単数形、複数形など）を例文中で使用してよい
   例: "run" → "ran", "running", "runs" として使用可
   活用された形を ___ で置き換える。答え（frontフィールド）は原形で記載すること
4. 対象単語（の活用形）は必ず ___ （アンダースコア3つ）で置き換えること
5. 【引用の厳守事項】実在する論文、記事、書籍、人物発言からの引用は絶対に行わないこと。
   捏造の引用（「The Economist (2023) によると…」「Smith (2019) は…と述べた」など）も禁止。
   ただし、以下のような学術論文・ニュース記事で使われる表現スタイルは使用可:
     - "The findings indicate that..."
     - "It has been argued that..."
     - "The committee approved the proposal after lengthy deliberation."
     - "A growing body of research suggests..."

【出力形式】
以下のJSON配列のみを返してください（マークダウン装飾不要）。
※ frontには必ず「単語の原形（${sourceLangName}での訳）」の形式で訳語を付けること
※ 例: subsequent（その後の）/ epistemological（認識論的な）/ run（走る）

[
  {
    "form": "cloze",
    "front": "穴埋めの答えとなる単語・原形（訳語付き）例: subsequent（その後の）",
    "back": "___ を含む穴埋め例文（${targetLangName}）",
    "wordLevel": "対象単語のCEFRレベル（A1/A2/B1/B2/C1/C2）",
    "sentenceLevel": "例文全体のCEFRレベル（A1/A2/B1/B2/C1/C2）",
    "contextNote": "穴埋めの答えとなる単語の意味・定義を${sourceLangName}で説明する（1〜2文程度）"
  }
]

【出力例】
入力: subsequent（ステップA判定: B2 → タイプ2: 時事記事）
[
  {
    "form": "cloze",
    "front": "subsequent（その後の）",
    "back": "Subsequent investigations revealed the policy's far-reaching impact on rural communities.",
    "wordLevel": "B2",
    "sentenceLevel": "C1",
    "contextNote": "ある出来事・行動の後に続いて起こる、という意味の形容詞。学術・ニュース文体で頻出。"
  }
]`;
}

// ─── ユーティリティ ───────────────────────────────────────────────────────────

/** 入力テキストを配列に変換（カンマ・改行区切り）*/
export function parseInputItems(input: string): string[] {
  return input
    .split(/[,，\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * 単語の意味注釈を解析する。
 * 入力例: "bank (financial institution)" → { word: "bank", annotation: "financial institution" }
 * 注釈なし: "house" → { word: "house", annotation: null }
 */
export function parseAnnotatedItem(item: string): { word: string; annotation: string | null } {
  const match = item.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (match) {
    return { word: match[1].trim(), annotation: match[2].trim() };
  }
  return { word: item.trim(), annotation: null };
}
