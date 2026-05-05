/**
 * 学習セッション状態管理フック（FSRS対応版）
 *
 * 【設計方針】
 *   - 「graduate」= FSRSが返した nextReview が SESSION_GRADUATION_THRESHOLD_HOURS(24h) 以上先
 *   - 評価ラベル（Again/Hard/Good/Easy）でなく nextReview の値のみで進捗を判定する
 *   - graduate していないカードは reLearningQueue に戻り、同セッション内で再出題される
 *   - 全カードが graduate した瞬間にセッション終了
 *
 * 【出題順序】
 *   1. unvisitedQueue（未出題）を先に消化する
 *   2. 尽きたら reLearningQueue から取り出す（直前と同一カードの連続出題を避ける）
 */

import { useState, useCallback, useRef } from 'react';
import type { Card, Deck, StudyQuality, FsrsRating } from '../types';
import { useSpacedRepetition } from './useSpacedRepetition';
import { getDueCards } from '../services/database';
import { selectTodayCards } from '../services/cardSelector';
import {
  isCardGraduatedFromSession,
  getReviewBucket,
  type ReviewBucket,
} from '../services/sessionUtils';
import { FSRS_RATING_MAP } from '../services/srs';

// ── 型定義 ─────────────────────────────────────────────────────────────────────

interface CardStatus {
  cardId: string;
  isGraduated: boolean;
  /** 同セッション内の出題回数 */
  reviewCount: number;
  lastRatingInSession?: FsrsRating;
  /** graduate 時の nextReview 値（完了サマリの分布計算用）*/
  graduatedNextReview?: string;
}

/** セッション完了サマリ */
export interface SessionSummary {
  /** 学習完了カード数（= targetCardIds.length）*/
  completedCount: number;
  /** セッション所要時間（秒）*/
  durationSeconds: number;
  /** 次回復習日の分布 */
  reviewDistribution: Record<ReviewBucket, number>;
}

interface SessionState {
  startedAt: string;
  /** セッション対象の全カードID（dailyLimit 考慮済み）*/
  targetCardIds: string[];
  /** 表示用カードスナップショット（内容は学習中に変化しない）*/
  cardMap: Record<string, Card>;
  /** 各カードのセッション内ステータス */
  cardStatuses: Record<string, CardStatus>;
  /** まだ一度も出題していないカードのキュー */
  unvisitedQueue: string[];
  /** 当日中の再出題待ちキュー（nextReview < 24h のカード）*/
  reLearningQueue: string[];
  /** 現在表示中のカードID */
  currentCardId: string | null;
  /** 直前に出題したカードID（連続出題を避けるために保持）*/
  lastCardId: string | null;
  isFlipped: boolean;
  isComplete: boolean;
  isLoading: boolean;
  /** 連続 graduate 数（モチベーションバナー用）*/
  consecutiveGraduated: number;
  /** 完了サマリ（isComplete === true のときのみ設定）*/
  summary: SessionSummary | null;
}

const INITIAL_STATE: SessionState = {
  startedAt: '',
  targetCardIds: [],
  cardMap: {},
  cardStatuses: {},
  unvisitedQueue: [],
  reLearningQueue: [],
  currentCardId: null,
  lastCardId: null,
  isFlipped: false,
  isComplete: false,
  isLoading: false,
  consecutiveGraduated: 0,
  summary: null,
};

export interface UseStudySessionReturn {
  currentCard: Card | null;
  isFlipped: boolean;
  isComplete: boolean;
  isLoading: boolean;
  /** 翌日以降に送られたカード数（進捗バーの分子）*/
  progressCompleted: number;
  /** セッション対象カード総数（進捗バーの分母）*/
  progressTotal: number;
  /** 連続 graduate 数（モチベーションバナー用）*/
  consecutiveGraduated: number;
  /** 完了サマリ（isComplete === true のとき設定される）*/
  summary: SessionSummary | null;
  /**
   * 学習セッションを初期化する
   * @param deckId 対象デッキID（undefined = 全デッキ）
   * @param deck   デッキ設定オブジェクト（dailyLimit・Mode A/B の判定に使用）
   *               undefined の場合は上限なし・全件出題
   */
  loadCards: (deckId?: string, deck?: Deck) => Promise<void>;
  flipCard: () => void;
  /** quality を評価する。weights はデッキの FSRS カスタム重み（省略時はデフォルト）*/
  answerCard: (quality: StudyQuality, weights?: number[]) => Promise<void>;
}

// ── 内部ヘルパー ───────────────────────────────────────────────────────────────

/**
 * 次に出題するカードIDを選ぶ
 *
 * - unvisitedQueue を先に消化する
 * - 尽きたら reLearningQueue から取り出す
 * - reLearningQueue 取り出し時は lastCardId と同じカードが直接連続しないよう考慮する
 *   （キューが1枚のみの場合は同一カードを出すことを許容）
 */
function pickNextCard(
  unvisited: string[],
  relearning: string[],
  lastCardId: string | null,
): { nextId: string | null; newUnvisited: string[]; newRelearning: string[] } {
  // 未出題カードを優先
  if (unvisited.length > 0) {
    return {
      nextId: unvisited[0],
      newUnvisited: unvisited.slice(1),
      newRelearning: relearning,
    };
  }

  if (relearning.length === 0) {
    return { nextId: null, newUnvisited: [], newRelearning: [] };
  }

  // 1枚だけなら連続を避けられないのでそのまま出す
  if (relearning.length === 1) {
    return { nextId: relearning[0], newUnvisited: [], newRelearning: [] };
  }

  // lastCardId と異なる最初のカードを先頭として取り出す
  const avoidIdx = relearning.findIndex((id) => id !== lastCardId);
  if (avoidIdx === -1) {
    // 全て同一ID（理論上発生しないが安全策）
    return {
      nextId: relearning[0],
      newUnvisited: [],
      newRelearning: relearning.slice(1),
    };
  }
  const nextId = relearning[avoidIdx];
  const newRelearning = [
    ...relearning.slice(0, avoidIdx),
    ...relearning.slice(avoidIdx + 1),
  ];
  return { nextId, newUnvisited: [], newRelearning };
}

/** セッション完了サマリを計算する */
function computeSummary(
  startedAt: string,
  endedAt: Date,
  targetCardIds: string[],
  cardStatuses: Record<string, CardStatus>,
): SessionSummary {
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 1000),
  );

  const reviewDistribution: Record<ReviewBucket, number> = {
    tomorrow: 0,
    soon: 0,
    week: 0,
    later: 0,
  };

  for (const id of targetCardIds) {
    const status = cardStatuses[id];
    if (status?.graduatedNextReview) {
      const bucket = getReviewBucket(status.graduatedNextReview, endedAt);
      reviewDistribution[bucket]++;
    }
  }

  return {
    completedCount: targetCardIds.length,
    durationSeconds,
    reviewDistribution,
  };
}

// ── メインフック ──────────────────────────────────────────────────────────────

/** FSRSに基づく学習セッション状態管理フック */
export function useStudySession(): UseStudySessionReturn {
  const { reviewCard } = useSpacedRepetition();
  const [state, setState] = useState<SessionState>(INITIAL_STATE);

  // stale closure 回避: 常に最新の state を参照できるようにする
  const stateRef = useRef(state);
  stateRef.current = state;

  const loadCards = useCallback(async (deckId?: string, deck?: Deck) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const dueCards = await getDueCards(deckId);

      // デッキ設定が渡されていれば selectTodayCards で Mode A/B + 二次関数順序付けを適用。
      // 渡されていない場合（全デッキモードなど）はシャッフルのみ行い上限なし全件出題。
      let selected: Card[];
      if (deck) {
        const result = selectTodayCards(deck, dueCards);
        selected = result.ordered;
      } else {
        selected = [...dueCards].sort(() => Math.random() - 0.5);
      }

      if (selected.length === 0) {
        setState({ ...INITIAL_STATE, isLoading: false });
        return;
      }

      const targetCardIds = selected.map((c) => c.id);
      const cardMap: Record<string, Card> = {};
      for (const c of selected) {
        cardMap[c.id] = c;
      }

      // 先頭カードを currentCardId に設定し、残りを unvisitedQueue に積む
      const [firstId, ...restIds] = targetCardIds;

      setState({
        startedAt: new Date().toISOString(),
        targetCardIds,
        cardMap,
        cardStatuses: {},
        unvisitedQueue: restIds,
        reLearningQueue: [],
        currentCardId: firstId,
        lastCardId: null,
        isFlipped: false,
        isComplete: false,
        isLoading: false,
        consecutiveGraduated: 0,
        summary: null,
      });
    } catch {
      setState((s) => ({ ...s, isLoading: false }));
    }
  }, []);

  const flipCard = useCallback(() => {
    setState((s) => ({ ...s, isFlipped: true }));
  }, []);

  const answerCard = useCallback(
    async (quality: StudyQuality, weights?: number[]) => {
      const s = stateRef.current;
      if (!s.currentCardId || s.isComplete) return;

      const card = s.cardMap[s.currentCardId];
      if (!card) return;

      // FSRS でカードを評価（DB書き込み・StudyLog 記録も内部で実施）
      const updatedCard = await reviewCard(card, quality, weights);

      // ── 修正ポイント ──────────────────────────────────────────────────────────
      // updatedCard を cardMap に書き戻す。
      // これがないと、カードが reLearningQueue から再出題されたとき
      // cardMap[cardId] が常に「初期状態（state:new, reps:0）」のままになり、
      // ① getEstimates(currentCard) が常に同じ値を返す（ボタン表示固定）
      // ② fsrsReviewCard(card, ...) が毎回「新規カード」扱いで計算するため
      //    nextReview が 24h を超えず、isGraduated が永遠に false になる
      // の両方が引き起こされる。
      const newCardMap = { ...s.cardMap, [s.currentCardId]: updatedCard };

      const now = new Date();
      const graduated = isCardGraduatedFromSession(updatedCard.nextReview, now);

      const prevStatus = s.cardStatuses[s.currentCardId];
      const newStatus: CardStatus = {
        cardId: s.currentCardId,
        isGraduated: graduated,
        reviewCount: (prevStatus?.reviewCount ?? 0) + 1,
        lastRatingInSession: FSRS_RATING_MAP[quality] as FsrsRating,
        // graduate 時の nextReview を記録する（分布計算用）
        graduatedNextReview: graduated
          ? updatedCard.nextReview
          : prevStatus?.graduatedNextReview,
      };

      const newCardStatuses = { ...s.cardStatuses, [s.currentCardId]: newStatus };

      // graduate していなければ reLearningQueue の末尾に追加する
      const updatedReLearningQueue = graduated
        ? s.reLearningQueue
        : [...s.reLearningQueue, s.currentCardId];

      const newConsecutive = graduated ? s.consecutiveGraduated + 1 : 0;

      // 全カードが graduate したらセッション終了
      const allGraduated = s.targetCardIds.every(
        (id) => newCardStatuses[id]?.isGraduated,
      );

      if (allGraduated) {
        const summary = computeSummary(
          s.startedAt,
          now,
          s.targetCardIds,
          newCardStatuses,
        );
        setState((prev) => ({
          ...prev,
          cardMap: newCardMap,
          cardStatuses: newCardStatuses,
          reLearningQueue: updatedReLearningQueue,
          currentCardId: null,
          lastCardId: s.currentCardId,
          isFlipped: false,
          isComplete: true,
          consecutiveGraduated: newConsecutive,
          summary,
        }));
        return;
      }

      // 次のカードを選ぶ
      const { nextId, newUnvisited, newRelearning } = pickNextCard(
        s.unvisitedQueue,
        updatedReLearningQueue,
        s.currentCardId,
      );

      setState((prev) => ({
        ...prev,
        cardMap: newCardMap,
        cardStatuses: newCardStatuses,
        unvisitedQueue: newUnvisited,
        reLearningQueue: newRelearning,
        currentCardId: nextId,
        lastCardId: s.currentCardId,
        isFlipped: false,
        consecutiveGraduated: newConsecutive,
      }));
    },
    [reviewCard],
  );

  const currentCard = state.currentCardId
    ? (state.cardMap[state.currentCardId] ?? null)
    : null;

  const progressCompleted = state.targetCardIds.filter(
    (id) => state.cardStatuses[id]?.isGraduated,
  ).length;

  return {
    currentCard,
    isFlipped: state.isFlipped,
    isComplete: state.isComplete,
    isLoading: state.isLoading,
    progressCompleted,
    progressTotal: state.targetCardIds.length,
    consecutiveGraduated: state.consecutiveGraduated,
    summary: state.summary,
    loadCards,
    flipCard,
    answerCard,
  };
}
