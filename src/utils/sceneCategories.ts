/** シーンカテゴリー定義 */

export interface SceneSubcategory {
  id: string;
  label: { ja: string; en: string };
  /** LLMプロンプトに挿入するシーン説明（UIには使用しない）*/
  prompt: string;
}

export interface SceneCategory {
  id: string;
  label: { ja: string; en: string };
  /** UIのツールチップ・補足表示用（LLMプロンプトには含めない）*/
  description: { ja: string; en: string };
  subcategories: SceneSubcategory[];
}

export const SCENE_CATEGORIES: SceneCategory[] = [
  {
    id: 'personal',
    label: { ja: '個人', en: 'Personal' },
    description: {
      ja: 'プライベートな空間、親しい人との関係、または自分自身に関するシーン',
      en: 'Private spaces, close relationships, and personal life',
    },
    subcategories: [
      {
        id: 'personal_relations',
        label: { ja: '人間関係・交流', en: 'Relationships' },
        prompt: '家族、友人との会話、挨拶、自己紹介、遊びへの誘いなど、身近な人間関係のシーン',
      },
      {
        id: 'personal_daily',
        label: { ja: '日常生活・住居', en: 'Daily Life' },
        prompt: '自宅、家事、家具、修理、個人的な習慣、日記など、日常生活のシーン',
      },
      {
        id: 'personal_hobby',
        label: { ja: '趣味・娯楽', en: 'Hobbies' },
        prompt: '映画、音楽、スポーツ、旅行、趣味、SNSへの投稿など、余暇・娯楽のシーン',
      },
      {
        id: 'personal_health',
        label: { ja: '心身の状態', en: 'Health & Feelings' },
        prompt: '個人の感情、体調不良や症状など、心身の状態を表すシーン',
      },
    ],
  },
  {
    id: 'public',
    label: { ja: '公共', en: 'Public' },
    description: {
      ja: '社会のサービスを利用したり、見知らぬ人と関わったりするシーン',
      en: 'Using public services and interacting with strangers',
    },
    subcategories: [
      {
        id: 'public_admin',
        label: { ja: '行政・手続き', en: 'Administration' },
        prompt: '役所、銀行、郵便局、お金の管理など、行政・手続きのシーン',
      },
      {
        id: 'public_consumer',
        label: { ja: '消費・サービス', en: 'Shopping & Services' },
        prompt: '買い物、レストラン・外食（予約、注文、支払い）など、消費・サービス利用のシーン',
      },
      {
        id: 'public_medical',
        label: { ja: '医療機関', en: 'Medical' },
        prompt: '病院（受付や医師との会話）、薬局など、医療機関でのシーン',
      },
      {
        id: 'public_transport',
        label: { ja: '移動・交通', en: 'Transport' },
        prompt: '公共交通機関、駅、空港、街歩き、道案内など、移動・交通のシーン',
      },
      {
        id: 'public_society',
        label: { ja: '社会・環境', en: 'Society & Environment' },
        prompt: 'ニュース、時事問題、自然、天気、気候、災害、環境問題など、社会・環境のシーン',
      },
    ],
  },
  {
    id: 'educational',
    label: { ja: '教育', en: 'Educational' },
    description: {
      ja: '学校などの教育機関だけでなく、自発的な学習や知的な活動全般を含むシーン',
      en: 'School, self-study, and intellectual activities',
    },
    subcategories: [
      {
        id: 'edu_school',
        label: { ja: '学校・施設', en: 'School' },
        prompt: 'クラスでの会話、図書館の利用など、学校・教育施設でのシーン',
      },
      {
        id: 'edu_study',
        label: { ja: '学習・評価', en: 'Study & Assessment' },
        prompt: '学習計画、試験、研究活動など、学習・評価に関するシーン',
      },
      {
        id: 'edu_culture',
        label: { ja: '教養・文化', en: 'Culture' },
        prompt: '文学、小説特有の表現、歴史、芸術など、教養・文化に関するシーン',
      },
      {
        id: 'edu_logic',
        label: { ja: '論理・抽象表現', en: 'Logic & Abstract' },
        prompt: '意見の主張、論理的なつなぎ言葉、抽象的概念など、論理・抽象表現のシーン',
      },
    ],
  },
  {
    id: 'occupational',
    label: { ja: '職業', en: 'Occupational' },
    description: {
      ja: '職場での業務や、ビジネス上の公式なコミュニケーションに関わるシーン',
      en: 'Workplace tasks and professional communication',
    },
    subcategories: [
      {
        id: 'occ_communication',
        label: { ja: '社内・社外コミュニケーション', en: 'Business Communication' },
        prompt: '会議、ビジネスメール、電話応対など、職場のコミュニケーションシーン',
      },
      {
        id: 'occ_relations',
        label: { ja: '人間関係（仕事）', en: 'Workplace Relations' },
        prompt: '同僚との会話、上司・部下とのやり取りなど、職場の人間関係のシーン',
      },
      {
        id: 'occ_professional',
        label: { ja: '専門性・実務', en: 'Professional' },
        prompt: '業界用語、プレゼンテーション、契約や交渉など、専門性・実務のシーン',
      },
    ],
  },
];

export function getSceneCategoryById(id: string): SceneCategory | undefined {
  return SCENE_CATEGORIES.find((c) => c.id === id);
}

export function getSceneSubcategoryById(
  categoryId: string,
  subcategoryId: string
): SceneSubcategory | undefined {
  return getSceneCategoryById(categoryId)?.subcategories.find((s) => s.id === subcategoryId);
}

// ─── 文体（レジスター）分類 ──────────────────────────────────────────────────

export interface RegisterCategory {
  id: string;
  label: { ja: string; en: string };
  /** LLMプロンプトに挿入する文体説明 */
  prompt: string;
}

export const REGISTER_CATEGORIES: RegisterCategory[] = [
  {
    id: 'informal',
    label: { ja: 'インフォーマル', en: 'Informal' },
    prompt: '友人・家族との会話、スラング、省略形など、くだけた表現を使った例文にすること',
  },
  {
    id: 'formal',
    label: { ja: 'フォーマル', en: 'Formal' },
    prompt: '論文、ニュース、公的な文書、文学、格言など、改まった文体の例文にすること',
  },
  {
    id: 'neutral',
    label: { ja: 'ニュートラル', en: 'Neutral' },
    prompt: '誰に対しても失礼にならない、一般的な日常語を使った例文にすること',
  },
];

export function getRegisterById(id: string): RegisterCategory | undefined {
  return REGISTER_CATEGORIES.find((r) => r.id === id);
}
