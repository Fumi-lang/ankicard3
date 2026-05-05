import { useCallback } from 'react';
import { reviewCard as fsrsReviewCard, previewRatings } from '../services/srs';
import { addStudyLog } from '../services/database';
import { useCardStore } from '../stores/cardStore';
import type { Card, StudyQuality } from '../types';

interface UseSpacedRepetitionReturn {
  reviewCard: (card: Card, quality: StudyQuality, weights?: number[]) => Promise<Card>;
  getEstimates: (card: Card, lang?: 'ja' | 'en', weights?: number[]) => Record<StudyQuality, string>;
}

/** FSRSアルゴリズムを使ったカードレビューフック */
export function useSpacedRepetition(): UseSpacedRepetitionReturn {
  const updateCard = useCardStore((s) => s.updateCard);

  const reviewCard = useCallback(
    async (card: Card, quality: StudyQuality, weights?: number[]): Promise<Card> => {
      const now = new Date();
      const { updatedCard, log } = fsrsReviewCard(card, quality, now, weights);

      await updateCard(updatedCard);
      await addStudyLog(log);

      return updatedCard;
    },
    [updateCard]
  );

  const getEstimates = useCallback(
    (card: Card, lang: 'ja' | 'en' = 'ja', weights?: number[]) =>
      previewRatings(card, new Date(), lang, weights),
    []
  );

  return { reviewCard, getEstimates };
}
