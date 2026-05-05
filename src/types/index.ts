// アプリ全体で使用する型定義

// ── タグエンティティ ────────────────────────────────────────────────────────────

/**
 * タグエンティティ
 * システム全体で一意な name を持つ独立エンティティ。
 * カードとは多対多（Card.tagIds で参照）。
 */
export interface Tag {
  id:         string;   // UUID
  name:       string;   // タグ名（システム全体で一意）
  color?:     string;   // HEX色コード（オプショナル、例: '#4F46E5'）
  createdAt:  string;   // ISO 8601
  updatedAt:  string;   // ISO 8601
}

/**
 * カードフォーム: パイプラインルーター用の内部型
 * カード生成パイプライン（promptBuilder / CardFormSelector）でのみ使用する。
 * Card エンティティには保存しない。分類は tags['単語'|'穴埋め'] で管理する。
 */
export type CardForm = 'translation' | 'cloze';

/** カードの作成元 */
export type CardSource = 'manual' | 'claude' | 'import';

/** 学習品質評価（SM-2アルゴリズム用）*/
export type StudyQuality = 'again' | 'hard' | 'good' | 'easy';

/** アプリUIの言語設定 */
export type AppLanguage = 'ja' | 'en';

// ── FSRS型定義 ──────────────────────────────────────────────────────────────

/** FSRSカード状態 */
export type FsrsState = 'new' | 'learning' | 'review' | 'relearning';

/** FSRSレーティング（Again=1 / Hard=2 / Good=3 / Easy=4）*/
export type FsrsRating = 1 | 2 | 3 | 4;

/**
 * FSRSカードパラメータ
 * ts-fsrs(FSRS-6.0)のCard型に対応するアプリ内表現
 * 浮動小数点のまま保存し、丸め処理は表示時のみ行う
 */
export interface FsrsData {
  difficulty:     number;  // 難易度 (0–10)
  stability:      number;  // 安定性 (日数)
  state:          FsrsState;
  lapses:         number;  // 累計 Again 回数
  reps:           number;  // 累計レビュー回数
  learningSteps:  number;  // 学習ステップ数（FSRS-6.0）
  lastReview?:    string;  // 最終レビュー日時 (UTC ISO)
}

// ── デッキ設定 ────────────────────────────────────────────────────────────────

/** デッキ固有の追加設定 */
export interface DeckExtraSettings {
  /**
   * FSRSカスタム重み（将来のデッキ別パラメータ最適化用）
   * FSRS-6.0は21要素の配列を期待する。省略時はライブラリデフォルトを使用
   */
  fsrsWeights?: number[];
  /**
   * @deprecated v6 マイグレーション後は使用しない。
   * フィールドを残すのはインポート互換性のためのみ（旧データ読み込み時に無視する）。
   */
  clozeAnswerSpeechLang?: 'target' | 'source';
}

/** デッキ情報 */
export interface Deck {
  id: string;
  name: string;
  description?: string;
  /** 母語（未設定可）*/
  sourceLang?: string | null;
  /** 学習言語（未設定可）*/
  targetLang?: string | null;
  /** 表面の音声読み上げ言語コード（例: 'en'）。null = 音声ボタン非表示 */
  frontSpeechLang?: string | null;
  /** 裏面の音声読み上げ言語コード（例: 'ja'）。null = 音声ボタン非表示 */
  backSpeechLang?: string | null;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
  extraSettings?: DeckExtraSettings;
  /** 1日の学習上限枚数（null = 無制限）*/
  dailyLimit?: number | null;
  /**
   * true = 上限に復習カードを含める（Mode B）
   * false = 復習カードは上限外・全件出題（Mode A, デフォルト）
   */
  includeReviewInDailyLimit?: boolean;
  /**
   * Mode B 時の復習割合（%）。0–100。デフォルト 50。
   * 例: 50 → 上限の半分を復習カード、残りを新規カードに割り当てる
   */
  reviewRatio?: number;
}

/** カードの補足情報 */
export interface CardExtraInfo {
  partOfSpeech?: string;
  pronunciation?: string;
  exampleSentence?: string;
  /** コロケーション例 */
  collocations?: string[];
  /** 穴埋め答えの意味・定義（母語で記述） */
  contextNote?: string;
  /** 単語レベル (CEFR: A1/A2/B1/B2/C1/C2) */
  wordLevel?: string;
  /** 文レベル (CEFR: A1/A2/B1/B2/C1/C2) */
  sentenceLevel?: string;
  /** シーンカテゴリーID */
  sceneCategoryId?: string;
  /** シーンサブカテゴリーID */
  sceneSubcategoryId?: string;
  noun?: {
    gender?: string;
    plural?: string;
    genitive?: string;
  };
  verb?: {
    pastTense?: string;
    pastParticiple?: string;
    presentParticiple?: string;
    conjugation?: Record<string, string>;
    irregular?: boolean;
  };
  adjective?: {
    comparative?: string;
    superlative?: string;
  };
}

/** カード情報 */
export interface Card {
  id: string;
  deckId: string;
  frontText: string;
  backText: string;
  extraInfo?: CardExtraInfo;
  /** ユーザーメモ（任意）*/
  memo?: string;
  /**
   * タグID配列（任意）。
   * Tag エンティティの id を参照する（tags テーブル）。
   * 表示・フィルタ時は tagStore でタグ名へ解決する。
   */
  tagIds?: string[];
  source: CardSource;

  // ── 旧 SM-2 フィールド（後方互換のため保持・ロールバック余地）──────────────
  easeFactor:  number;
  interval:    number;
  repetitions: number;

  // ── FSRS フィールド（FSRS-6.0 パラメータ）────────────────────────────────
  /**
   * FSRS パラメータ。新規カードは undefined（DB v5 マイグレーションで初期化済み）。
   * 最初の FSRS レビュー後に設定される。
   */
  fsrs?: FsrsData;

  // ── 共有フィールド ─────────────────────────────────────────────────────────
  /** 次回レビュー日時（UTC ISO文字列）
   *  - Learning/Relearning 状態: 分単位の精度（例: "2024-01-15T10:35:00.000Z"）
   *  - Review 状態: 日次精度、00:00:00.000Z に正規化（例: "2024-01-20T00:00:00.000Z"）
   *  - getDueCards は `nextReview <= now.toISOString()` で判定する
   */
  nextReview:   string;
  lastReview?:  string;  // 最終レビュー日時 (UTC ISO)
  createdAt:    string;
  updatedAt:    string;
}

/**
 * エクスポートJSON内のカード形式。
 * tagIds の代わりに可搬性のある tags 文字列配列を持つ。
 * エクスポート時に Card → ExportCard へ変換し、インポート時に逆変換する。
 */
export type ExportCard = Omit<Card, 'tagIds'> & { tags?: string[] };

/** デッキエクスポート用の完全データ型 */
export interface DeckExportData {
  /** エクスポートフォーマットのバージョン */
  version: string;
  /** エクスポート日時（ISO 8601）*/
  exportedAt: string;
  deck: Deck;
  /** エクスポートJSON内のカード（tags は文字列配列、tagIds は含まない）*/
  cards: ExportCard[];
}

/** インポート時のカードデータ（バリデーション結果含む）*/
export interface ImportedCardData {
  cardForm: CardForm;
  frontText: string;
  backText: string;
  extraInfo?: Partial<CardExtraInfo>;
  isValid: boolean;
  errorMessage?: string;
}

/** ファイルインポート結果 */
export interface ImportResult {
  cards: ImportedCardData[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  fileType: 'csv' | 'json' | 'pdf' | 'docx' | 'memoryflow';
  detectedFormat?: string;
}

/** 学習ログ */
export interface StudyLog {
  id: string;
  cardId: string;
  /** SM-2 互換 quality 値（後方互換のため保持）。FSRSログでは rating と同値になる */
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  /** FSRS レーティング (Again=1 / Hard=2 / Good=3 / Easy=4) */
  rating?: FsrsRating;
  /** 評価日時（UTC ISO文字列）*/
  reviewedAt: string;
  /** デバイス識別子（将来のクラウド同期・競合解決用。今回は未設定）*/
  deviceId?: string;
}

/** 学習目標 */
export interface Goal {
  id: string;
  deckId?: string;
  targetWords: number;
  targetDays: number;
  wordsLearned: number;
  startDate: string;
  isCompleted: boolean;
  createdAt: string;
}

/** 対応言語の定義 */
export type SupportedLanguage = {
  code: string;
  /** 日本語での表示名 */
  name: string;
  /** 英語での表示名 */
  nameEn: string;
  /** Web Speech APIのlang属性に使用するロケールコード */
  speechLocale: string;
};
