import { create } from 'zustand';
import type { Card } from '../types';
import * as db from '../services/database';

interface CardState {
  cards: Card[];
  isLoading: boolean;
  currentDeckId: string | null;

  fetchCards: (deckId: string) => Promise<void>;
  createCard: (card: Card) => Promise<void>;
  createCards: (cards: Card[]) => Promise<void>;
  updateCard: (card: Card) => Promise<void>;
  deleteCard: (id: string) => Promise<void>;
  /** 複数カードを一括 put（内容更新用）*/
  bulkUpdateCards: (cards: Card[]) => Promise<void>;
  /** 複数カードを一括削除（cardCount も更新）*/
  bulkDeleteCards: (ids: string[]) => Promise<void>;
}

/** カード状態管理ストア（Zustand）*/
export const useCardStore = create<CardState>((set, get) => ({
  cards: [],
  isLoading: false,
  currentDeckId: null,

  fetchCards: async (deckId) => {
    set({ isLoading: true, currentDeckId: deckId });
    try {
      const cards = await db.getCardsByDeck(deckId);
      set({ cards });
    } finally {
      set({ isLoading: false });
    }
  },

  createCard: async (card) => {
    await db.createCard(card);
    if (get().currentDeckId === card.deckId) {
      set((state) => ({ cards: [...state.cards, card] }));
    }
  },

  createCards: async (cards) => {
    await db.createCards(cards);
    if (cards.length > 0 && get().currentDeckId === cards[0].deckId) {
      set((state) => ({ cards: [...state.cards, ...cards] }));
    }
  },

  updateCard: async (card) => {
    await db.updateCard(card);
    set((state) => ({
      cards: state.cards.map((c) => (c.id === card.id ? card : c)),
    }));
  },

  deleteCard: async (id) => {
    await db.deleteCard(id);
    set((state) => ({ cards: state.cards.filter((c) => c.id !== id) }));
  },

  bulkUpdateCards: async (cards) => {
    await db.bulkUpdateCards(cards);
    set((state) => {
      const cardMap = new Map(cards.map((c) => [c.id, c]));
      return { cards: state.cards.map((c) => cardMap.get(c.id) ?? c) };
    });
  },

  bulkDeleteCards: async (ids) => {
    await db.bulkDeleteCards(ids);
    const idSet = new Set(ids);
    set((state) => ({ cards: state.cards.filter((c) => !idSet.has(c.id)) }));
  },
}));
