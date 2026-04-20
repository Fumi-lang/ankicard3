import { useState, useCallback } from 'react';
import type { Card, StudyQuality } from '../types';
import { useSpacedRepetition } from './useSpacedRepetition';
import { getDueCards } from '../services/database';

interface StudySessionState {
  cards: Card[];
  currentIndex: number;
  isFlipped: boolean;
  isComplete: boolean;
  correctCount: number;
  incorrectCount: number;
  consecutiveCorrect: number;
}

interface UseStudySessionReturn extends StudySessionState {
  currentCard: Card | null;
  loadCards: (deckId?: string) => Promise<void>;
  flipCard: () => void;
  resetFlip: () => void;
  answerCard: (quality: StudyQuality) => Promise<void>;
  isLoading: boolean;
}

/** 学習セッションの状態管理フック */
export function useStudySession(): UseStudySessionReturn {
  const { reviewCard } = useSpacedRepetition();
  const [isLoading, setIsLoading] = useState(false);
  const [state, setState] = useState<StudySessionState>({
    cards: [],
    currentIndex: 0,
    isFlipped: false,
    isComplete: false,
    correctCount: 0,
    incorrectCount: 0,
    consecutiveCorrect: 0,
  });

  const loadCards = useCallback(async (deckId?: string) => {
    setIsLoading(true);
    try {
      const cards = await getDueCards(deckId);
      // カードをシャッフル
      const shuffled = [...cards].sort(() => Math.random() - 0.5);
      setState({
        cards: shuffled,
        currentIndex: 0,
        isFlipped: false,
        isComplete: shuffled.length === 0,
        correctCount: 0,
        incorrectCount: 0,
        consecutiveCorrect: 0,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const flipCard = useCallback(() => {
    setState((s) => ({ ...s, isFlipped: true }));
  }, []);

  /** isFlipped だけを false にリセット（カード切り替えは行わない）*/
  const resetFlip = useCallback(() => {
    setState((s) => ({ ...s, isFlipped: false }));
  }, []);

  const answerCard = useCallback(
    async (quality: StudyQuality) => {
      const card = state.cards[state.currentIndex];
      if (!card) return;

      await reviewCard(card, quality);

      const isCorrect = quality !== 'again';
      const nextIndex = state.currentIndex + 1;
      const isComplete = nextIndex >= state.cards.length;

      setState((s) => ({
        ...s,
        currentIndex: nextIndex,
        isFlipped: false,
        isComplete,
        correctCount: s.correctCount + (isCorrect ? 1 : 0),
        incorrectCount: s.incorrectCount + (isCorrect ? 0 : 1),
        consecutiveCorrect: isCorrect ? s.consecutiveCorrect + 1 : 0,
      }));
    },
    [state.cards, state.currentIndex, reviewCard]
  );

  const currentCard = state.cards[state.currentIndex] ?? null;

  return { ...state, currentCard, loadCards, flipCard, resetFlip, answerCard, isLoading };
}
