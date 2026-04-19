import { useCallback } from 'react';
import { calculateSRS, QUALITY_MAP, getNextReviewEstimates } from '../services/srs';
import { addStudyLog } from '../services/database';
import { useCardStore } from '../stores/cardStore';
import type { Card, StudyQuality } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface UseSpacedRepetitionReturn {
  reviewCard: (card: Card, quality: StudyQuality) => Promise<Card>;
  getEstimates: (card: Card, lang?: 'ja' | 'en') => Record<'again' | 'hard' | 'good' | 'easy', string>;
}

/** SM-2アルゴリズムを使ったカードレビューフック */
export function useSpacedRepetition(): UseSpacedRepetitionReturn {
  const updateCard = useCardStore((s) => s.updateCard);

  const reviewCard = useCallback(
    async (card: Card, quality: StudyQuality): Promise<Card> => {
      const numQuality = QUALITY_MAP[quality] as 0 | 1 | 2 | 3 | 4 | 5;
      const srsResult = calculateSRS({
        quality: numQuality,
        easeFactor: card.easeFactor,
        interval: card.interval,
        repetitions: card.repetitions,
      });

      const now = new Date().toISOString();
      const updatedCard: Card = {
        ...card,
        ...srsResult,
        lastReview: now,
        updatedAt: now,
      };

      await updateCard(updatedCard);

      // 学習ログを記録
      await addStudyLog({
        id: uuidv4(),
        cardId: card.id,
        quality: numQuality,
        reviewedAt: now,
      });

      return updatedCard;
    },
    [updateCard]
  );

  const getEstimates = useCallback(
    (card: Card, lang: 'ja' | 'en' = 'ja') =>
      getNextReviewEstimates(card.easeFactor, card.interval, card.repetitions, lang),
    []
  );

  return { reviewCard, getEstimates };
}
