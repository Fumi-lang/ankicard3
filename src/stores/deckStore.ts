import { create } from 'zustand';
import type { Deck } from '../types';
import * as db from '../services/database';

interface DeckState {
  decks: Deck[];
  isLoading: boolean;

  fetchDecks: () => Promise<void>;
  createDeck: (deck: Deck) => Promise<void>;
  updateDeck: (deck: Deck) => Promise<void>;
  deleteDeck: (id: string) => Promise<void>;
}

/** デッキ状態管理ストア（Zustand）*/
export const useDeckStore = create<DeckState>((set, get) => ({
  decks: [],
  isLoading: false,

  fetchDecks: async () => {
    set({ isLoading: true });
    try {
      const decks = await db.getAllDecks();
      set({ decks });
    } finally {
      set({ isLoading: false });
    }
  },

  createDeck: async (deck) => {
    await db.createDeck(deck);
    await get().fetchDecks();
  },

  updateDeck: async (deck) => {
    await db.updateDeck(deck);
    await get().fetchDecks();
  },

  deleteDeck: async (id) => {
    await db.deleteDeck(id);
    set((state) => ({ decks: state.decks.filter((d) => d.id !== id) }));
  },
}));
