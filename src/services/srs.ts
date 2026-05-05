/**
 * FSRSスケジューリングサービス
 *
 * 【採用ライブラリ】ts-fsrs v5.x（MIT ライセンス）
 *   - FSRS-6.0 アルゴリズム（21 重みパラメータ）を実装
 *   - npm: ts-fsrs / https://github.com/open-spaced-repetition/ts-fsrs
 *
 * 【設計方針】
 *   - FSRSロジック（本ファイル）と永続化層（database.ts）は疎結合に保つ
 *   - 全時刻は UTC の ISO 文字列で扱い、表示時のみローカルタイムに変換する
 *   - カスタムパラメータは Deck.extraSettings.fsrsWeights で差し替え可能
 *   - 旧 SM-2 フィールド（easeFactor / interval / repetitions）は後方互換のため保持
 */

import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsLibCard,
} from 'ts-fsrs';
import { v4 as uuidv4 } from 'uuid';
import type { Card, FsrsData, FsrsState, FsrsRating, StudyLog, StudyQuality } from '../types';

// ── 定数（一箇所で管理し、将来の設定変更に対応する）──────────────────────────

/** デフォルト目標保持率（90% = 忘却率 10% でレビュー）*/
export const DEFAULT_REQUEST_RETENTION = 0.9;

/** 最大スケジュール間隔（日数）: 100 年 */
export const DEFAULT_MAXIMUM_INTERVAL = 36500;

/** StudyQuality → FSRS Rating マッピング */
export const FSRS_RATING_MAP = {
  again: Rating.Again,  // 1
  hard:  Rating.Hard,   // 2
  good:  Rating.Good,   // 3
  easy:  Rating.Easy,   // 4
} as const satisfies Record<StudyQuality, number>;

// ── FSRS インスタンスファクトリ ───────────────────────────────────────────────

/**
 * FSRS インスタンスを生成する
 *
 * weights が指定された場合はデッキ固有のカスタムパラメータで初期化する。
 * 将来のパラメータ最適化（Deck.extraSettings.fsrsWeights）に対応するための拡張ポイント。
 * 省略時は FSRS-6.0 のデフォルト重みを使用する。
 */
export function createFsrsInstance(weights?: number[]) {
  if (weights && weights.length > 0) {
    // TypeScript 上 w の型が固定長タプルのため any にキャストして渡す
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const params = generatorParameters({ w: weights as any });
    return fsrs(params);
  }
  return fsrs();
}

// ── 内部変換ヘルパー ──────────────────────────────────────────────────────────

/** FsrsState (アプリ内文字列) → State (ts-fsrs 列挙体) */
function stateToEnum(state: FsrsState): State {
  switch (state) {
    case 'new':        return State.New;
    case 'learning':   return State.Learning;
    case 'review':     return State.Review;
    case 'relearning': return State.Relearning;
  }
}

/** State (ts-fsrs 列挙体) → FsrsState (アプリ内文字列) */
function stateFromEnum(state: State): FsrsState {
  switch (state) {
    case State.New:        return 'new';
    case State.Learning:   return 'learning';
    case State.Review:     return 'review';
    case State.Relearning: return 'relearning';
    default:               return 'new';
  }
}

/**
 * アプリの Card → ts-fsrs の Card 形式に変換する
 *
 * fsrs フィールドが未設定の場合（未マイグレーションカードなど）は
 * createEmptyCard() で新規カード扱いにする。
 */
function toFsrsLibCard(appCard: Card, now: Date): FsrsLibCard {
  const f = appCard.fsrs;

  // fsrs 未設定 = FSRS でまだ一度もレビューしていない新規カード
  if (!f) {
    return createEmptyCard(now);
  }

  // 最終レビュー日時と次回予定日を Date に変換する
  const lastReview   = f.lastReview ? new Date(f.lastReview) : undefined;
  const due          = new Date(appCard.nextReview);

  // elapsed_days: FSRS が retrievability 計算に使う「最終レビューからの経過日数」
  const elapsedDays   = lastReview
    ? Math.max(0, (now.getTime() - lastReview.getTime()) / 86400000)
    : 0;

  // scheduled_days: 前回スケジュールされた間隔（日数）
  const scheduledDays = lastReview
    ? Math.max(0, (due.getTime() - lastReview.getTime()) / 86400000)
    : 0;

  return {
    due,
    stability:      f.stability,
    difficulty:     f.difficulty,
    elapsed_days:   elapsedDays,
    scheduled_days: scheduledDays,
    reps:           f.reps,
    lapses:         f.lapses,
    learning_steps: f.learningSteps,
    state:          stateToEnum(f.state),
    last_review:    lastReview,
  };
}

/** ts-fsrs の Card 結果 → アプリの FsrsData に変換する */
function fromFsrsLibCard(fc: FsrsLibCard): FsrsData {
  return {
    difficulty:    fc.difficulty,
    stability:     fc.stability,
    state:         stateFromEnum(fc.state),
    lapses:        fc.lapses,
    reps:          fc.reps,
    learningSteps: fc.learning_steps,
    lastReview:    fc.last_review?.toISOString(),
  };
}

/**
 * ts-fsrs の due → nextReview ISO 文字列に変換する
 *
 * Learning / Relearning 状態（intraday スケジュール）:
 *   分単位の精度でそのまま保存する。例: "2024-01-15T10:35:00.000Z"
 *   getDueCards では `nextReview <= now.toISOString()` で判定するため
 *   セッション再開時に自然に復習対象に入る。
 *
 * Review 状態: 日次精度に正規化して 00:00:00.000Z として保存する。
 */
function toNextReview(due: Date, state: State): string {
  if (state === State.Learning || state === State.Relearning) {
    return due.toISOString();
  }
  const dateStr = due.toISOString().split('T')[0];
  return `${dateStr}T00:00:00.000Z`;
}

/**
 * dueまでの残り時間を人間が読みやすい文字列に変換する（表示用）
 * 全ての計算は UTC で行い、表示単位のみ lang で切り替える
 */
function formatInterval(due: Date, now: Date, lang: 'ja' | 'en'): string {
  const diffMs  = due.getTime() - now.getTime();
  const diffMin  = Math.round(diffMs / 60000);
  const diffHour = Math.round(diffMs / 3600000);
  const diffDay  = Math.round(diffMs / 86400000);

  if (lang === 'ja') {
    if (diffMin  <  1)  return '<1分';
    if (diffMin  < 60)  return `${diffMin}分`;
    if (diffHour < 24)  return `${diffHour}時間`;
    return `${diffDay}日`;
  } else {
    if (diffMin  <  1)  return '<1m';
    if (diffMin  < 60)  return `${diffMin}m`;
    if (diffHour < 24)  return `${diffHour}h`;
    return `${diffDay}d`;
  }
}

// ── 公開 API ──────────────────────────────────────────────────────────────────

/**
 * 新規カード作成時のデフォルト値を返す
 *
 * SM-2 互換フィールドと FSRS-6.0 初期値の両方を含む。
 * `...getInitialSRS()` として Card の初期値に使える。
 */
export function getInitialCardValues(): Pick<
  Card,
  'easeFactor' | 'interval' | 'repetitions' | 'nextReview' | 'fsrs'
> {
  const now = new Date();
  // 今日の 00:00:00.000Z から復習開始（UTC 基準）
  const todayISO = `${now.toISOString().split('T')[0]}T00:00:00.000Z`;

  return {
    // SM-2 互換フィールド（後方互換のため保持）
    easeFactor:  2.5,
    interval:    0,
    repetitions: 0,
    nextReview:  todayISO,
    // FSRS-6.0 初期値（createEmptyCard() 相当のハードコード値）
    fsrs: {
      difficulty:    0,
      stability:     0,
      state:         'new',
      lapses:        0,
      reps:          0,
      learningSteps: 0,
    },
  };
}

/** 後方互換エクスポート（既存の card/create.tsx, card/import.tsx が使用）*/
export const getInitialSRS = getInitialCardValues;

/**
 * カードを FSRS で評価し、更新済みカードと学習ログを返す
 * 永続化（DB 書き込み）は呼び出し側（useSpacedRepetition）が行う。
 *
 * @param appCard   評価対象のカード
 * @param quality   難易度評価 ('again' | 'hard' | 'good' | 'easy')
 * @param now       評価時刻（省略時は現在時刻 UTC）
 * @param weights   FSRS カスタム重み（省略時は FSRS-6.0 デフォルト使用）
 * @returns         { updatedCard, log } - 更新済みカードと保存用ログ
 */
export function reviewCard(
  appCard: Card,
  quality: StudyQuality,
  now: Date = new Date(),
  weights?: number[]
): { updatedCard: Card; log: StudyLog } {
  const f      = createFsrsInstance(weights);
  const fsrsCard = toFsrsLibCard(appCard, now);
  const rating   = FSRS_RATING_MAP[quality] as FsrsRating;

  // repeat() は 4 択分の結果を一括計算する。該当評価の結果のみ使用する。
  const results       = f.repeat(fsrsCard, now);
  const { card: newCard } = results[rating];

  const nowISO    = now.toISOString();
  const nextReview = toNextReview(newCard.due, newCard.state);

  const updatedCard: Card = {
    ...appCard,
    // FSRS パラメータを更新（浮動小数点のまま保存）
    fsrs: fromFsrsLibCard(newCard),
    // SM-2 互換フィールドも更新（後方互換）
    interval:    newCard.scheduled_days,
    repetitions: newCard.reps,
    // 共有フィールド（全て UTC ISO 文字列）
    nextReview,
    lastReview: nowISO,
    updatedAt:  nowISO,
  };

  const log: StudyLog = {
    id:         uuidv4(),
    cardId:     appCard.id,
    // FSRS Rating(1-4) を quality にも記録する（後方互換）
    quality:    rating,
    rating,
    reviewedAt: nowISO,
    // deviceId は将来のクラウド同期実装時に設定する
  };

  return { updatedCard, log };
}

/**
 * 各難易度ボタンの「次回復習までの目安」を FSRS プレビューで計算して返す
 *
 * f.repeat() で 4 択分を一括計算するためオーバーヘッドが小さい。
 * DifficultyButtons の estimates プロップに渡す用途。
 *
 * @param appCard   対象カード
 * @param now       現在時刻（省略時は現在時刻）
 * @param lang      表示言語（'ja' | 'en'）
 * @param weights   FSRS カスタム重み
 */
export function previewRatings(
  appCard: Card,
  now: Date = new Date(),
  lang: 'ja' | 'en' = 'ja',
  weights?: number[]
): Record<StudyQuality, string> {
  const f      = createFsrsInstance(weights);
  const fsrsCard = toFsrsLibCard(appCard, now);

  // 4 択分の結果を一括取得する
  const results = f.repeat(fsrsCard, now);

  return {
    again: formatInterval(results[Rating.Again].card.due, now, lang),
    hard:  formatInterval(results[Rating.Hard].card.due,  now, lang),
    good:  formatInterval(results[Rating.Good].card.due,  now, lang),
    easy:  formatInterval(results[Rating.Easy].card.due,  now, lang),
  };
}
