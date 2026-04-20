import Dexie, { type Table } from 'dexie';
import type { Deck, Card, StudyLog, Goal } from '../types';

/** MemoryFlowのIndexedDBデータベース定義 */
export class MemoryFlowDB extends Dexie {
  decks!: Table<Deck>;
  cards!: Table<Card>;
  studyLogs!: Table<StudyLog>;
  goals!: Table<Goal>;

  constructor() {
    super('MemoryFlowDB');
    this.version(1).stores({
      decks:     'id, name, sourceLang, targetLang, createdAt',
      cards:     'id, deckId, cardType, nextReview, source, createdAt',
      studyLogs: 'id, cardId, reviewedAt',
      goals:     'id, deckId, startDate',
    });
    // v2: cardType → cardForm ('translation' | 'cloze')
    this.version(2).stores({
      decks:     'id, name, sourceLang, targetLang, createdAt',
      cards:     'id, deckId, cardForm, nextReview, source, createdAt',
      studyLogs: 'id, cardId, reviewedAt',
      goals:     'id, deckId, startDate',
    }).upgrade((trans) => {
      return trans.table('cards').toCollection().modify((card: Record<string, unknown>) => {
        if (!card.cardForm) {
          card.cardForm = 'translation';
        }
        delete card.cardType;
      });
    });
  }
}

export const db = new MemoryFlowDB();

// ─── デッキ操作 ────────────────────────────────────────────────────────────────

export async function getAllDecks(): Promise<Deck[]> {
  return db.decks.orderBy('createdAt').reverse().toArray();
}

export async function getDeckById(id: string): Promise<Deck | undefined> {
  return db.decks.get(id);
}

export async function createDeck(deck: Deck): Promise<void> {
  await db.decks.add(deck);
}

export async function updateDeck(deck: Deck): Promise<void> {
  await db.decks.put(deck);
}

export async function deleteDeck(id: string): Promise<void> {
  await db.transaction('rw', db.decks, db.cards, db.studyLogs, async () => {
    // 削除前にカードIDを収集して関連する学習ログも削除する
    const cards = await db.cards.where('deckId').equals(id).toArray();
    const cardIds = cards.map((c) => c.id);
    if (cardIds.length > 0) {
      await db.studyLogs.where('cardId').anyOf(cardIds).delete();
    }
    await db.cards.where('deckId').equals(id).delete();
    await db.decks.delete(id);
  });
}

// ─── カード操作 ────────────────────────────────────────────────────────────────

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  return db.cards.where('deckId').equals(deckId).sortBy('createdAt');
}

export async function getCardById(id: string): Promise<Card | undefined> {
  return db.cards.get(id);
}

export async function getDueCards(deckId?: string): Promise<Card[]> {
  const todayStr = new Date().toISOString().split('T')[0];
  let collection = db.cards.where('nextReview').belowOrEqual(todayStr);
  if (deckId) {
    const cards = await collection.toArray();
    return cards.filter((c) => c.deckId === deckId);
  }
  return collection.toArray();
}

export async function createCard(card: Card): Promise<void> {
  await db.transaction('rw', db.cards, db.decks, async () => {
    await db.cards.add(card);
    // デッキのcardCountをインクリメント
    const deck = await db.decks.get(card.deckId);
    if (deck) {
      await db.decks.put({ ...deck, cardCount: deck.cardCount + 1, updatedAt: new Date().toISOString() });
    }
  });
}

export async function createCards(cards: Card[]): Promise<void> {
  if (cards.length === 0) return;
  const deckId = cards[0].deckId;
  await db.transaction('rw', db.cards, db.decks, async () => {
    await db.cards.bulkAdd(cards);
    const deck = await db.decks.get(deckId);
    if (deck) {
      await db.decks.put({ ...deck, cardCount: deck.cardCount + cards.length, updatedAt: new Date().toISOString() });
    }
  });
}

export async function updateCard(card: Card): Promise<void> {
  await db.cards.put(card);
}

export async function deleteCard(id: string): Promise<void> {
  const card = await db.cards.get(id);
  if (!card) return;
  await db.transaction('rw', db.cards, db.decks, async () => {
    await db.cards.delete(id);
    const deck = await db.decks.get(card.deckId);
    if (deck && deck.cardCount > 0) {
      await db.decks.put({ ...deck, cardCount: deck.cardCount - 1, updatedAt: new Date().toISOString() });
    }
  });
}

// ─── 学習ログ操作 ─────────────────────────────────────────────────────────────

export async function addStudyLog(log: StudyLog): Promise<void> {
  await db.studyLogs.add(log);
}

export async function getStudyLogsByCard(cardId: string): Promise<StudyLog[]> {
  return db.studyLogs.where('cardId').equals(cardId).sortBy('reviewedAt');
}

/** 指定日の全学習ログを返す（YYYY-MM-DD形式）*/
export async function getStudyLogsByDate(dateStr: string): Promise<StudyLog[]> {
  const start = `${dateStr}T00:00:00.000Z`;
  const end = `${dateStr}T23:59:59.999Z`;
  return db.studyLogs.where('reviewedAt').between(start, end, true, true).toArray();
}

/** 日付範囲の学習数を返す */
export async function getStudyCountByDateRange(
  startDate: string,
  endDate: string
): Promise<Record<string, number>> {
  const start = `${startDate}T00:00:00.000Z`;
  const end = `${endDate}T23:59:59.999Z`;
  const logs = await db.studyLogs.where('reviewedAt').between(start, end, true, true).toArray();
  const counts: Record<string, number> = {};
  for (const log of logs) {
    const date = log.reviewedAt.split('T')[0];
    counts[date] = (counts[date] ?? 0) + 1;
  }
  return counts;
}

// ─── 目標操作 ─────────────────────────────────────────────────────────────────

export async function getAllGoals(): Promise<Goal[]> {
  return db.goals.orderBy('createdAt').reverse().toArray();
}

export async function createGoal(goal: Goal): Promise<void> {
  await db.goals.add(goal);
}

export async function updateGoal(goal: Goal): Promise<void> {
  await db.goals.put(goal);
}

export async function deleteGoal(id: string): Promise<void> {
  await db.goals.delete(id);
}
