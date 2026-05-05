import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useDeckStore } from '../stores/deckStore';
import type { Deck } from '../types';

interface CreateDeckInput {
  name: string;
  description?: string;
  /** 母語（未設定の場合は null）*/
  sourceLang?: string | null;
  /** 学習言語（未設定の場合は null）*/
  targetLang?: string | null;
  dailyLimit?: number | null;
}

interface UseDeckReturn {
  decks: Deck[];
  isLoading: boolean;
  fetchDecks: () => Promise<void>;
  createDeck: (input: CreateDeckInput) => Promise<Deck>;
  updateDeck: (deck: Deck) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
}

/** デッキのCRUD操作フック */
export function useDeck(): UseDeckReturn {
  const store = useDeckStore();

  const createDeck = useCallback(
    async (input: CreateDeckInput): Promise<Deck> => {
      const now = new Date().toISOString();
      const deck: Deck = {
        id:              uuidv4(),
        name:            input.name,
        description:     input.description,
        sourceLang:      input.sourceLang ?? null,
        targetLang:      input.targetLang ?? null,
        // 音声言語は作成時に null: デッキ設定画面で後から設定する
        frontSpeechLang: null,
        backSpeechLang:  null,
        cardCount:       0,
        dailyLimit:      input.dailyLimit ?? null,
        createdAt:       now,
        updatedAt:       now,
      };
      await store.createDeck(deck);
      return deck;
    },
    [store]
  );

  return {
    decks: store.decks,
    isLoading: store.isLoading,
    fetchDecks: store.fetchDecks,
    createDeck,
    updateDeck: store.updateDeck,
    deleteDeck: store.deleteDeck,
  };
}
