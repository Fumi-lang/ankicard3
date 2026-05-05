/**
 * 今日の学習カード選択ロジック
 *
 * 【設計方針】
 *   - Mode A (includeReviewInDailyLimit = false):
 *       復習カードは dailyLimit の対象外 → 全復習 + 新規を上限まで
 *   - Mode B (includeReviewInDailyLimit = true):
 *       復習 + 新規の合計を dailyLimit に収める
 *       reviewRatio (%) で復習枠を決定し、余り枠は新規に振り替える
 *
 * 【出題順序: 二次関数ミックス】
 *   セッション前半は復習カードを優先し、後半になるほど新規カードが
 *   混ざりやすくなる。確率は progress² に比例して増加する。
 *
 * 【注意: 純粋関数】
 *   DB アクセスなし。呼び出し元が getDueCards(deckId) の結果を渡す。
 */

import type { Card, Deck } from '../types';

// ── 型定義 ──────────────────────────────────────────────────────────────────────

/** selectTodayCards の戻り値 */
export interface TodayCards {
  /** useStudySession に渡す出題順序付き配列 */
  ordered:     Card[];
  /** 選ばれた復習カード数（UI表示用）*/
  reviewCount: number;
  /** 選ばれた新規カード数（UI表示用）*/
  newCount:    number;
}

// ── 内部ヘルパー ─────────────────────────────────────────────────────────────────

/** Fisher-Yates シャッフル（元の配列を変更しない） */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 二次関数ミックス順序付け
 *
 * reviewCards を優先しつつ、progress が進むにつれて
 * newCards が確率的に混入する順序列を生成する。
 *
 * 確率式: P(新規) = progress² × (newCards.length / total) × 2
 *   - progress = 0 → P = 0（最初は復習のみ）
 *   - progress = 0.5 → P ≈ 0.5 × newRatio × 2
 *   - progress = 1 → P ≈ newRatio × 2（上限は newRatio に依存）
 */
function orderWithQuadraticMix(reviewCards: Card[], newCards: Card[]): Card[] {
  const result: Card[] = [];
  let rIdx = 0;
  let nIdx = 0;
  const total = reviewCards.length + newCards.length;

  if (total === 0) return result;

  while (rIdx < reviewCards.length || nIdx < newCards.length) {
    const progress    = result.length / total;
    const newProb     = Math.pow(progress, 2) * (newCards.length / total) * 2;

    const reviewDone  = rIdx >= reviewCards.length;
    const newDone     = nIdx >= newCards.length;

    if (reviewDone || (!newDone && Math.random() < newProb)) {
      result.push(newCards[nIdx++]);
    } else {
      result.push(reviewCards[rIdx++]);
    }
  }

  return result;
}

// ── メイン関数 ───────────────────────────────────────────────────────────────────

/**
 * getDueCards の結果から「今日出題するカード」を選択・順序付けして返す
 *
 * @param deck      デッキ設定（dailyLimit / includeReviewInDailyLimit / reviewRatio）
 * @param dueCards  getDueCards(deckId) の戻り値（nextReview <= now のカード全件）
 * @returns         出題順序付き TodayCards
 */
export function selectTodayCards(deck: Deck, dueCards: Card[]): TodayCards {
  // FSRS state でカードを分類
  // state === 'new' または fsrs 未設定 → 新規カード
  // state === 'learning' / 'review' / 'relearning' → 復習カード
  const reviewCards = dueCards.filter(
    (c) => c.fsrs && c.fsrs.state !== 'new',
  );
  const newCards = dueCards.filter(
    (c) => !c.fsrs || c.fsrs.state === 'new',
  );

  const limit               = deck.dailyLimit ?? Infinity;
  const includeReview       = deck.includeReviewInDailyLimit ?? false;

  let selectedReview: Card[];
  let selectedNew:    Card[];

  if (!includeReview) {
    // ── Mode A: 復習は上限外・全件。新規だけを上限適用 ──────────────────────
    selectedReview = shuffle(reviewCards);
    selectedNew    = shuffle(newCards).slice(0, isFinite(limit) ? limit : undefined);
  } else {
    // ── Mode B: 復習 + 新規の合計を dailyLimit に収める ─────────────────────
    const ratio        = deck.reviewRatio ?? 50;
    const reviewSlots  = isFinite(limit) ? Math.floor(limit * ratio / 100) : Infinity;
    const newSlots     = isFinite(limit) ? limit - Math.floor(limit * ratio / 100) : Infinity;

    const shuffledReview = shuffle(reviewCards);
    const shuffledNew    = shuffle(newCards);

    selectedReview = isFinite(reviewSlots)
      ? shuffledReview.slice(0, reviewSlots)
      : shuffledReview;

    const spillover  = isFinite(reviewSlots)
      ? reviewSlots - selectedReview.length   // 復習が足りない分を新規に振り替え
      : 0;
    const effectiveNewSlots = isFinite(newSlots) ? newSlots + spillover : Infinity;

    selectedNew = isFinite(effectiveNewSlots)
      ? shuffledNew.slice(0, effectiveNewSlots)
      : shuffledNew;
  }

  const ordered = orderWithQuadraticMix(selectedReview, selectedNew);

  return {
    ordered,
    reviewCount: selectedReview.length,
    newCount:    selectedNew.length,
  };
}
