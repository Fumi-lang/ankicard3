import { useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useDeckStore } from '../stores/deckStore';
import type { Deck } from '../types';
import { useSettingsStore } from '../stores/settingsStore';

interface CreateDeckInput {
  name: string;
  description?: string;
  sourceLang?: string;
  targetLang?: string;
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
  const { defaultSourceLang, defaultTargetLang } = useSettingsStore();

  const createDeck = useCallback(
    async (input: CreateDeckInput): Promise<Deck> => {
      const now = new Date().toISOString();
      const deck: Deck = {
        id: uuidv4(),
        name: input.name,
        description: input.description,
        sourceLang: input.sourceLang ?? defaultSourceLang,
        targetLang: input.targetLang ?? defaultTargetLang,
        cardCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      await store.createDeck(deck);
      return deck;
    },
    [store, defaultSourceLang, defaultTargetLang]
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
