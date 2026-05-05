import { v4 as uuidv4 } from 'uuid';
import type { DeckExportData, ExportCard, Deck, Card } from '../types';
import type { MultiDeckExportData } from './deckExporter';
import type { AnkiImportResult } from './ankiImporter';
import { createDeck, createCards, getAllDecks, ensureTagIds } from './database';

// ── 型定義 ─────────────────────────────────────────────────────────────────────

/** MemoryFlow 形式のデッキインポート結果（1デッキ分）*/
export interface DeckImportResult {
  deckName:  string;
  cardCount: number;
  action:    'created' | 'merged' | 'cancelled';
}

/** デッキ重複時の処理方針 */
export type DuplicateAction = 'add_new' | 'merge' | 'cancel';

// ── ユーティリティ ──────────────────────────────────────────────────────────────

/**
 * エクスポートJSON（ExportCard 形式）または旧 Card 形式のカードデータを
 * 現行の Card 型（tagIds）に変換するヘルパー。
 *
 * 対応する入力バリエーション:
 *   - v1.0/v2.0 エクスポート JSON: tags?: string[] を持つ
 *   - v8 以前の DB データ: cardForm フィールドが残っている場合がある
 *   - 全バージョン: tags → tagIds へ変換、cardForm は削除
 *
 * @param c         エクスポートJSONから読み込んだカードデータ
 * @param overrides 新しい id / deckId / createdAt / updatedAt
 */
async function convertExportedCard(
  c:         ExportCard & Record<string, unknown>,
  overrides: { id: string; deckId: string; createdAt: string; updatedAt: string }
): Promise<Card> {
  // 旧 cardForm フィールドを読み取り、タグ名に変換（全バージョン対応）
  const oldForm  = (c as Record<string, unknown>).cardForm as string | undefined;
  const autoTag  = oldForm === 'cloze' ? '穴埋め' : oldForm === 'translation' ? '単語' : null;
  const existing = Array.isArray(c.tags) ? (c.tags as string[]) : [];
  const tagNames = autoTag && !existing.includes(autoTag)
    ? [...existing, autoTag]
    : existing;

  // タグ名 → タグID に変換（存在しないタグは自動作成）
  const tagIds = tagNames.length > 0 ? await ensureTagIds(tagNames) : undefined;

  // cardForm・tags を除いた新しいカードオブジェクトを作成
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { cardForm: _cf, tags: _tags, ...rest } = c as ExportCard & { cardForm?: unknown };
  return {
    ...rest,
    ...overrides,
    tagIds,
  };
}

// ── MemoryFlow v1.0 / v2.0 インポート ─────────────────────────────────────────

/**
 * DeckExportData（v1.0）をインポートする
 * @param exportData      エクスポートデータ
 * @param duplicateAction 同名デッキが存在する場合の処理
 */
export async function importDeckFromExport(
  exportData:      DeckExportData,
  duplicateAction: DuplicateAction = 'add_new'
): Promise<DeckImportResult> {
  const existingDecks = await getAllDecks();
  const duplicate     = existingDecks.find((d) => d.name === exportData.deck.name);

  if (duplicate && duplicateAction === 'cancel') {
    return { deckName: exportData.deck.name, cardCount: 0, action: 'cancelled' };
  }

  if (duplicate && duplicateAction === 'merge') {
    // 既存デッキにカードをマージ（新規 UUID を発行）
    const now      = new Date().toISOString();
    const newCards: Card[] = await Promise.all(
      exportData.cards.map((c) =>
        convertExportedCard(c as ExportCard & Record<string, unknown>, {
          id: uuidv4(), deckId: duplicate.id, createdAt: now, updatedAt: now,
        })
      )
    );
    await createCards(newCards);
    return { deckName: duplicate.name, cardCount: newCards.length, action: 'merged' };
  }

  // 新規デッキとして追加（同名の場合はサフィックスを付与）
  const now      = new Date().toISOString();
  const deckName = duplicate
    ? `${exportData.deck.name}（インポート）`
    : exportData.deck.name;

  const newDeck: Deck = {
    ...exportData.deck,
    id:        uuidv4(),
    name:      deckName,
    cardCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  await createDeck(newDeck);

  const newCards: Card[] = await Promise.all(
    exportData.cards.map((c) =>
      convertExportedCard(c as ExportCard & Record<string, unknown>, {
        id: uuidv4(), deckId: newDeck.id, createdAt: now, updatedAt: now,
      })
    )
  );
  await createCards(newCards);

  return { deckName, cardCount: newCards.length, action: 'created' };
}

/**
 * MultiDeckExportData（v2.0）をインポートする
 * 各デッキに対して importDeckFromExport を呼ぶ
 */
export async function importMultiDeckFromExport(
  exportData:      MultiDeckExportData,
  duplicateAction: DuplicateAction = 'add_new'
): Promise<DeckImportResult[]> {
  const results: DeckImportResult[] = [];
  for (const { deck, cards } of exportData.decks) {
    const v1: DeckExportData = { version: '1.0', exportedAt: exportData.exportedAt, deck, cards };
    const result = await importDeckFromExport(v1, duplicateAction);
    results.push(result);
  }
  return results;
}

// ── ファイル読み込み ────────────────────────────────────────────────────────────

/** JSON ファイルのフォーマット判別結果 */
export type MemoryFlowFileData =
  | { format: 'v1'; data: DeckExportData }
  | { format: 'v2'; data: MultiDeckExportData }
  | null;

/**
 * JSON ファイルを File オブジェクトから読み込んで MemoryFlow フォーマットを判別する
 * v1.0: { version: '1.0', deck, cards }
 * v2.0: { version: '2.0', decks: [{ deck, cards }] }
 */
export async function readMemoryFlowFile(file: File): Promise<MemoryFlowFileData> {
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object') return null;

    // v2.0 判定
    if (data.version === '2.0' && Array.isArray(data.decks)) {
      return { format: 'v2', data: data as MultiDeckExportData };
    }

    // v1.0 判定
    if (data.deck && Array.isArray(data.cards)) {
      return { format: 'v1', data: data as DeckExportData };
    }

    return null;
  } catch {
    return null;
  }
}

// ── Anki インポート ──────────────────────────────────────────────────────────────

/**
 * AnkiImportResult を MemoryFlow デッキ群として保存する
 *
 * 言語フィールドはすべて null で作成する（各デッキで使用言語が異なる可能性があるため）。
 * ユーザーはインポート後、デッキ設定画面で個別に言語を設定できる。
 * デッキ名には常に「（インポート）」サフィックスを付与し、後設定が必要なデッキを識別しやすくする。
 *
 * @param ankiResult  parseAnkiFile() の戻り値
 * @returns 作成されたデッキの結果配列
 */
export async function importFromAnki(
  ankiResult: AnkiImportResult
): Promise<DeckImportResult[]> {
  const results: DeckImportResult[] = [];

  for (const ankiDeck of ankiResult.decks) {
    if (ankiDeck.cards.length === 0) continue;

    const now = new Date().toISOString();

    // 常に「（インポート）」サフィックスを付与（後設定が必要なデッキの識別）
    const deckName = `${ankiDeck.name}（インポート）`;

    const newDeck: Deck = {
      id:              uuidv4(),
      name:            deckName,
      description:     'Imported from Anki',
      // 言語はすべて null: インポート後にデッキ設定画面で個別設定する
      sourceLang:      null,
      targetLang:      null,
      frontSpeechLang: null,
      backSpeechLang:  null,
      cardCount:       0,
      createdAt:       now,
      updatedAt:       now,
    };
    await createDeck(newDeck);

    const newCards: Card[] = await Promise.all(ankiDeck.cards.map(async (ac) => {
      // cardForm → タグ名 → タグID に変換（Anki の tags フィールドも結合）
      const autoTag  = ac.cardForm === 'cloze' ? '穴埋め' : '単語';
      const existing = Array.isArray(ac.tags) ? ac.tags : [];
      const tagNames = Array.from(new Set([...existing, autoTag]));
      const tagIds   = await ensureTagIds(tagNames);
      return {
        id:          uuidv4(),
        deckId:      newDeck.id,
        frontText:   ac.frontText,
        backText:    ac.backText,
        memo:        ac.memo,
        tagIds,
        source:      'import' as const,
        // SM-2 初期値
        easeFactor:  2.5,
        interval:    0,
        repetitions: 0,
        nextReview:  new Date().toISOString().slice(0, 10),
        createdAt:   now,
        updatedAt:   now,
      };
    }));
    await createCards(newCards);

    results.push({ deckName, cardCount: newCards.length, action: 'created' });
  }

  return results;
}

/**
 * JSON ファイルから DeckExportData を返す（後方互換: 旧 readDeckExportFile）
 * @deprecated readMemoryFlowFile を使用してください
 */
export async function readDeckExportFile(file: File): Promise<DeckExportData | null> {
  const result = await readMemoryFlowFile(file);
  if (!result) return null;
  if (result.format === 'v1') return result.data;
  // v2 の場合は最初のデッキを v1 として返す（互換性のため）
  const first = result.data.decks[0];
  if (!first) return null;
  return { version: '1.0', exportedAt: result.data.exportedAt, deck: first.deck, cards: first.cards };
}
