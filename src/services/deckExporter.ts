import type { DeckExportData, ExportCard } from '../types';
import { getInitialCardValues } from './srs';
import { getDeckById, getCardsByDeck, getAllDecks, getAllTags } from './database';
import { formatDateCompact } from '../utils/dateUtils';

// ── エクスポートフォーマット ────────────────────────────────────────────────────

/** v2.0 マルチデッキエクスポートフォーマット */
export interface MultiDeckExportData {
  version: '2.0';
  exportedAt: string;
  decks: Array<{
    deck:  NonNullable<Awaited<ReturnType<typeof getDeckById>>>;
    /** タグは tagIds ではなく文字列配列として出力（可搬性優先）*/
    cards: ExportCard[];
  }>;
}

// ── 内部ヘルパー ────────────────────────────────────────────────────────────────

/**
 * カード配列から進捗をリセットした配列を返す
 * SM-2・FSRS 両方のフィールドを getInitialCardValues() で初期化する
 */
function resetProgress(
  cards: Awaited<ReturnType<typeof getCardsByDeck>>
): Awaited<ReturnType<typeof getCardsByDeck>> {
  const init = getInitialCardValues();
  return cards.map((c) => ({
    ...c,
    // SM-2 互換フィールド
    easeFactor:  init.easeFactor,
    interval:    init.interval,
    repetitions: init.repetitions,
    nextReview:  init.nextReview,
    lastReview:  undefined,
    // FSRS フィールド（init.fsrs に lastReview は含まれない）
    fsrs: init.fsrs,
  }));
}

/**
 * Card[] を ExportCard[]（tagIds → tags 文字列配列）に変換する。
 * エクスポート JSON の可搬性を確保するため tagIds は出力しない。
 *
 * @param cards  DB から取得した Card 配列
 * @param tagMap タグ ID → タグ名 の Map（getAllTags で事前構築）
 */
function toExportCards(
  cards:  Awaited<ReturnType<typeof getCardsByDeck>>,
  tagMap: Map<string, string>
): ExportCard[] {
  return cards.map(({ tagIds, ...rest }) => {
    const tagNames = (tagIds ?? [])
      .map((id) => tagMap.get(id))
      .filter((n): n is string => n !== undefined);
    return {
      ...rest,
      tags: tagNames.length > 0 ? tagNames : undefined,
    };
  });
}

/** Blob + ダウンロードリンクでファイルを保存 */
function downloadJSON(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 公開 API ────────────────────────────────────────────────────────────────────

/**
 * 単一デッキを v1.0 JSON 形式でエクスポートしてブラウザダウンロードとして保存する
 * @param deckId          エクスポートするデッキID
 * @param includeProgress 学習進捗を含めるか
 */
export async function exportDeck(deckId: string, includeProgress: boolean): Promise<void> {
  const deck = await getDeckById(deckId);
  if (!deck) throw new Error(`デッキが見つかりません: ${deckId}`);

  let cards = await getCardsByDeck(deckId);
  if (!includeProgress) {
    cards = resetProgress(cards);
  }

  // tagIds → タグ名文字列に展開（エクスポート JSON の可搬性確保）
  const allTags = await getAllTags();
  const tagMap  = new Map(allTags.map((t) => [t.id, t.name]));

  // cardCount を cards.length で動的に補正（DBキャッシュのズレを解消）
  const exportData: DeckExportData = {
    version:    '1.0',
    exportedAt: new Date().toISOString(),
    deck:       { ...deck, cardCount: cards.length },
    cards:      toExportCards(cards, tagMap),
  };

  const fileName = `${deck.name}_${formatDateCompact(new Date())}.memoryflow.json`;
  downloadJSON(JSON.stringify(exportData, null, 2), fileName);
}

/**
 * 指定された複数デッキを v2.0 JSON 形式でエクスポートする
 * @param deckIds         エクスポートするデッキIDの配列
 * @param includeProgress 学習進捗を含めるか
 */
export async function exportSelectedDecks(
  deckIds:         string[],
  includeProgress: boolean
): Promise<void> {
  // タグ名マップを一括取得（全デッキ共通）
  const allTagsList = await getAllTags();
  const tagMap      = new Map(allTagsList.map((t) => [t.id, t.name]));

  const allData = await Promise.all(
    deckIds.map(async (deckId) => {
      const deck = await getDeckById(deckId);
      if (!deck) throw new Error(`デッキが見つかりません: ${deckId}`);

      let cards = await getCardsByDeck(deckId);
      if (!includeProgress) {
        cards = resetProgress(cards);
      }

      return {
        deck:  { ...deck, cardCount: cards.length },
        cards: toExportCards(cards, tagMap),
      };
    })
  );

  const exportData: MultiDeckExportData = {
    version:    '2.0',
    exportedAt: new Date().toISOString(),
    decks:      allData,
  };

  const label = deckIds.length === 1
    ? allData[0].deck.name
    : `memory-flow-${deckIds.length}decks`;

  const fileName = `${label}_${formatDateCompact(new Date())}.memoryflow.json`;
  downloadJSON(JSON.stringify(exportData, null, 2), fileName);
}

/** 全デッキをまとめて v2.0 形式でエクスポート */
export async function exportAllDecks(includeProgress: boolean): Promise<void> {
  const decks  = await getAllDecks();
  const deckIds = decks.map((d) => d.id);
  await exportSelectedDecks(deckIds, includeProgress);
}
