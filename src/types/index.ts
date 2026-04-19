// アプリ全体で使用する型定義

/** カードタイプ: 単語・コロケーション・例文 */
export type CardType = 'word' | 'collocation' | 'sentence';

/** カードの作成元 */
export type CardSource = 'manual' | 'claude' | 'import';

/** 学習品質評価（SM-2アルゴリズム用）*/
export type StudyQuality = 'again' | 'hard' | 'good' | 'easy';

/** アプリUIの言語設定 */
export type AppLanguage = 'ja' | 'en';

/** デッキ情報 */
export interface Deck {
  id: string;
  name: string;
  description?: string;
  sourceLang: string;
  targetLang: string;
  cardCount: number;
  createdAt: string;
  updatedAt: string;
}

/** カードの補足情報 */
export interface CardExtraInfo {
  partOfSpeech?: string;
  pronunciation?: string;
  exampleSentence?: string;
  /** コロケーション例（cardType='word'の場合）*/
  collocations?: string[];
  /** 使用文脈・ニュアンス補足 */
  contextNote?: string;
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
  cardType: CardType;
  frontText: string;
  backText: string;
  extraInfo?: CardExtraInfo;
  source: CardSource;
  // SM-2フィールド
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string;
  lastReview?: string;
  createdAt: string;
  updatedAt: string;
}

/** デッキエクスポート用の完全データ型 */
export interface DeckExportData {
  /** エクスポートフォーマットのバージョン */
  version: string;
  /** エクスポート日時（ISO 8601）*/
  exportedAt: string;
  deck: Deck;
  cards: Card[];
}

/** インポート時のカードデータ（バリデーション結果含む）*/
export interface ImportedCardData {
  cardType: CardType;
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
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  reviewedAt: string;
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
