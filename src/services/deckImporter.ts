import { v4 as uuidv4 } from 'uuid';
import type { DeckExportData, Deck, Card } from '../types';
import { createDeck, createCards, getAllDecks } from './database';
import { today } from '../utils/dateUtils';

/** MemoryFlow形式のデッキインポート結果 */
export interface DeckImportResult {
  deckName: string;
  cardCount: number;
  action: 'created' | 'merged' | 'cancelled';
}

/** デッキ重複チェックの選択肢 */
export type DuplicateAction = 'add_new' | 'merge' | 'cancel';

/**
 * DeckExportDataをインポートする
 * @param exportData エクスポートデータ
 * @param duplicateAction 同名デッキが存在する場合の処理
 */
export async function importDeckFromExport(
  exportData: DeckExportData,
  duplicateAction: DuplicateAction = 'add_new'
): Promise<DeckImportResult> {
  const existingDecks = await getAllDecks();
  const duplicate = existingDecks.find((d) => d.name === exportData.deck.name);

  if (duplicate && duplicateAction === 'cancel') {
    return { deckName: exportData.deck.name, cardCount: 0, action: 'cancelled' };
  }

  if (duplicate && duplicateAction === 'merge') {
    // 既存デッキにカードをマージ（新規UUIDを発行）
    const now = new Date().toISOString();
    const newCards: Card[] = exportData.cards.map((c) => ({
      ...c,
      id: uuidv4(),
      deckId: duplicate.id,
      createdAt: now,
      updatedAt: now,
    }));
    await createCards(newCards);
    return { deckName: duplicate.name, cardCount: newCards.length, action: 'merged' };
  }

  // 新規デッキとして追加
  const now = new Date().toISOString();
  const deckName = duplicate
    ? `${exportData.deck.name}（インポート）`
    : exportData.deck.name;

  const newDeck: Deck = {
    ...exportData.deck,
    id: uuidv4(),
    name: deckName,
    cardCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await createDeck(newDeck);

  const newCards: Card[] = exportData.cards.map((c) => ({
    ...c,
    id: uuidv4(),
    deckId: newDeck.id,
    createdAt: now,
    updatedAt: now,
  }));
  await createCards(newCards);

  return { deckName, cardCount: newCards.length, action: 'created' };
}

/** JSONファイルをFileオブジェクトから読み込んでDeckExportDataを返す */
export async function readDeckExportFile(file: File): Promise<DeckExportData | null> {
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (data.version && data.deck && Array.isArray(data.cards)) {
      return data as DeckExportData;
    }
    return null;
  } catch {
    return null;
  }
}
