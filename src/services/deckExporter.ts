import type { DeckExportData } from '../types';
import { getInitialSRS } from './srs';
import { getDeckById, getCardsByDeck } from './database';
import { formatDateCompact } from '../utils/dateUtils';

/**
 * デッキをJSON形式でエクスポートしてブラウザダウンロードとして保存する
 * @param deckId エクスポートするデッキID
 * @param includeProgress SM-2学習進捗を含めるか
 */
export async function exportDeck(deckId: string, includeProgress: boolean): Promise<void> {
  const deck = await getDeckById(deckId);
  if (!deck) throw new Error(`デッキが見つかりません: ${deckId}`);

  let cards = await getCardsByDeck(deckId);

  if (!includeProgress) {
    // SM-2データを初期値にリセット
    const initSRS = getInitialSRS();
    cards = cards.map((c) => ({
      ...c,
      easeFactor: initSRS.easeFactor,
      interval: initSRS.interval,
      repetitions: initSRS.repetitions,
      nextReview: initSRS.nextReview,
      lastReview: undefined,
    }));
  }

  const exportData: DeckExportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    deck,
    cards,
  };

  const fileName = `${deck.name}_${formatDateCompact(new Date())}.memoryflow.json`;
  downloadJSON(JSON.stringify(exportData, null, 2), fileName);
}

/** 全デッキをまとめてエクスポート */
export async function exportAllDecks(includeProgress: boolean): Promise<void> {
  const { getAllDecks, getCardsByDeck } = await import('./database');
  const decks = await getAllDecks();

  const allData = await Promise.all(
    decks.map(async (deck) => {
      let cards = await getCardsByDeck(deck.id);
      if (!includeProgress) {
        const initSRS = getInitialSRS();
        cards = cards.map((c) => ({
          ...c,
          easeFactor: initSRS.easeFactor,
          interval: initSRS.interval,
          repetitions: initSRS.repetitions,
          nextReview: initSRS.nextReview,
          lastReview: undefined,
        }));
      }
      return { deck, cards } as { deck: typeof deck; cards: typeof cards };
    })
  );

  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    decks: allData,
  };

  const fileName = `memory-flow-all_${formatDateCompact(new Date())}.json`;
  downloadJSON(JSON.stringify(exportData, null, 2), fileName);
}

/** Blob + ダウンロードリンクでJSONファイルを保存 */
function downloadJSON(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
