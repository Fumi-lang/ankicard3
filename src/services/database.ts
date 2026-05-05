import Dexie, { type Table } from 'dexie';
import { v4 as uuidv4 } from 'uuid';
import type { Deck, Card, StudyLog, Goal, Tag } from '../types';

// ── デフォルトタグ定義 ─────────────────────────────────────────────────────────

/**
 * アプリが自動付与するデフォルトタグ。
 * 削除可能だが、新規カード保存時に自動再作成される。
 */
export const DEFAULT_TAG_DEFS: ReadonlyArray<{ name: string; color: string }> = [
  { name: '単語',   color: '#4F46E5' },  // インディゴ
  { name: '穴埋め', color: '#10B981' },  // エメラルド
] as const;

/** デフォルトタグ名のみの Set（高速ルックアップ用）*/
export const DEFAULT_TAG_NAMES = new Set(DEFAULT_TAG_DEFS.map((t) => t.name));

/** MemoryFlowのIndexedDBデータベース定義 */
export class MemoryFlowDB extends Dexie {
  decks!: Table<Deck>;
  cards!: Table<Card>;
  studyLogs!: Table<StudyLog>;
  goals!: Table<Goal>;
  tags!: Table<Tag>;

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
    // v3: memo フィールドを追加（既存カードにデフォルト '' をセット）
    this.version(3).stores({
      decks:     'id, name, sourceLang, targetLang, createdAt',
      cards:     'id, deckId, cardForm, nextReview, source, createdAt',
      studyLogs: 'id, cardId, reviewedAt',
      goals:     'id, deckId, startDate',
    }).upgrade((trans) => {
      return trans.table('cards').toCollection().modify((card: Record<string, unknown>) => {
        if (card.memo === undefined) card.memo = '';
      });
    });
    // v4: tags（カード）と dailyLimit（デッキ）を追加
    this.version(4).stores({
      decks:     'id, name, sourceLang, targetLang, createdAt',
      cards:     'id, deckId, cardForm, nextReview, source, createdAt',
      studyLogs: 'id, cardId, reviewedAt',
      goals:     'id, deckId, startDate',
    }).upgrade((trans) => {
      trans.table('cards').toCollection().modify((card: Record<string, unknown>) => {
        if (!Array.isArray(card.tags)) card.tags = [];
      });
      return trans.table('decks').toCollection().modify((deck: Record<string, unknown>) => {
        if (deck.dailyLimit === undefined) deck.dailyLimit = null;
      });
    });
    // v5: FSRS パラメータ（fsrs フィールド）を全カードに追加
    // ts-fsrs はここでインポートせず、ハードコード値で初期化（疎結合を維持する）
    this.version(5).stores({
      decks:     'id, name, sourceLang, targetLang, createdAt',
      cards:     'id, deckId, cardForm, nextReview, source, createdAt',
      studyLogs: 'id, cardId, reviewedAt',
      goals:     'id, deckId, startDate',
    }).upgrade((trans) => {
      return trans.table('cards').toCollection().modify((card: Record<string, unknown>) => {
        if (!card.fsrs) {
          card.fsrs = {
            difficulty:    0,
            stability:     0,
            state:         'new',
            lapses:        0,
            reps:          0,
            learningSteps: 0,
          };
        }
      });
    });

    // v6: 音声読み上げ言語フィールドを再設計
    //
    // 旧設計: extraSettings.clozeAnswerSpeechLang ('target' | 'source') → 間接参照
    // 新設計: deck.frontSpeechLang / deck.backSpeechLang → 直接言語コードを保存
    //
    // マイグレーション方針:
    //   frontSpeechLang = targetLang（表は学習言語、従来挙動を保持）
    //   backSpeechLang:
    //     clozeAnswerSpeechLang === 'target' → targetLang
    //     clozeAnswerSpeechLang === 'source' or 未設定 → sourceLang（デフォルト: 裏は母語）
    //   extraSettings.clozeAnswerSpeechLang → 削除
    //
    // sourceLang/targetLang: 既存データを破壊しない（string → string | null 互換）
    this.version(6).stores({
      decks:     'id, name, sourceLang, targetLang, createdAt',
      cards:     'id, deckId, cardForm, nextReview, source, createdAt',
      studyLogs: 'id, cardId, reviewedAt',
      goals:     'id, deckId, startDate',
    }).upgrade((trans) => {
      return trans.table('decks').toCollection().modify((deck: Record<string, unknown>) => {
        const extra = deck.extraSettings as Record<string, unknown> | undefined;
        const clozeAnswerSpeechLang = extra?.clozeAnswerSpeechLang as string | undefined;
        const srcLang = (deck.sourceLang as string | null | undefined) || null;
        const tgtLang = (deck.targetLang as string | null | undefined) || null;

        // frontSpeechLang: 既に設定済みでなければ targetLang を初期値に
        if (deck.frontSpeechLang === undefined || deck.frontSpeechLang === null) {
          deck.frontSpeechLang = tgtLang;
        }

        // backSpeechLang: clozeAnswerSpeechLang === 'target' なら targetLang、それ以外は sourceLang
        if (deck.backSpeechLang === undefined || deck.backSpeechLang === null) {
          deck.backSpeechLang = clozeAnswerSpeechLang === 'target' ? tgtLang : srcLang;
        }

        // extraSettings.clozeAnswerSpeechLang を削除（新フィールドへ移行完了）
        if (extra) {
          delete extra.clozeAnswerSpeechLang;
          deck.extraSettings = extra;
        }
      });
    });

    // v7: 1日の学習上限ロジックを再設計
    //
    // 新フィールド:
    //   includeReviewInDailyLimit: false（Mode A）または true（Mode B）
    //   reviewRatio: 復習カードの割合（%）。Mode B 時のみ使用。デフォルト 50。
    //
    // マイグレーション方針:
    //   既存デッキはすべて Mode A（復習は上限外）でデフォルト初期化する。
    //   これにより従来の動作（復習カードは全件出題）が維持される。
    this.version(7).stores({
      decks:     'id, name, sourceLang, targetLang, createdAt',
      cards:     'id, deckId, cardForm, nextReview, source, createdAt',
      studyLogs: 'id, cardId, reviewedAt',
      goals:     'id, deckId, startDate',
    }).upgrade((trans) => {
      return trans.table('decks').toCollection().modify((deck: Record<string, unknown>) => {
        if (deck.includeReviewInDailyLimit === undefined) {
          deck.includeReviewInDailyLimit = false;
        }
        if (deck.reviewRatio === undefined) {
          deck.reviewRatio = 50;
        }
      });
    });

    // v8: Card.cardForm フィールドを廃止し、tags['単語'|'穴埋め'] で分類管理する
    //
    // 変更:
    //   - cards インデックスから cardForm を削除
    //   - 既存カードの cardForm を対応するタグに変換してから削除
    //       'translation' → '単語' タグを tags に追加
    //       'cloze'       → '穴埋め' タグを tags に追加
    //   - cardForm フィールド自体を削除
    this.version(8).stores({
      decks:     'id, name, sourceLang, targetLang, createdAt',
      cards:     'id, deckId, nextReview, source, createdAt',  // cardForm をインデックスから削除
      studyLogs: 'id, cardId, reviewedAt',
      goals:     'id, deckId, startDate',
    }).upgrade((trans) => {
      return trans.table('cards').toCollection().modify((card: Record<string, unknown>) => {
        const form = card.cardForm as string | undefined;
        if (form) {
          const existing = Array.isArray(card.tags) ? (card.tags as string[]) : [];
          const autoTag  = form === 'cloze' ? '穴埋め' : '単語';
          if (!existing.includes(autoTag)) {
            card.tags = [...existing, autoTag];
          }
        }
        delete card.cardForm;
      });
    });

    // v9: タグを独立エンティティ化（tags テーブル新設）
    //
    // 変更:
    //   - tags テーブルを新設（id, &name）
    //   - 既存カードの Card.tags: string[] から一意タグ名を収集してエンティティ化
    //   - デフォルトタグ（単語/穴埋め）が未作成なら追加
    //   - Card.tags: string[] → Card.tagIds: string[] に変換
    //   - Card.tags フィールドを削除
    this.version(9).stores({
      decks:     'id, name, sourceLang, targetLang, createdAt',
      cards:     'id, deckId, nextReview, source, createdAt',
      studyLogs: 'id, cardId, reviewedAt',
      goals:     'id, deckId, startDate',
      tags:      'id, &name, createdAt',  // &name = ユニークインデックス
    }).upgrade(async (trans) => {
      const now = new Date().toISOString();

      // Step 1: 全カードからユニークなタグ名を収集（同期イテレーション）
      const allNames = new Set<string>();
      await trans.table('cards').toCollection().each((card: Record<string, unknown>) => {
        if (Array.isArray(card.tags)) {
          (card.tags as string[]).forEach((n: string) => allNames.add(n));
        }
      });

      // Step 2: デフォルトタグ名をマージ
      for (const dt of DEFAULT_TAG_DEFS) {
        allNames.add(dt.name);
      }

      // Step 3: タグエンティティを作成して name → id マップを構築
      const nameToId = new Map<string, string>();
      const tagEntities: Tag[] = [];
      for (const name of allNames) {
        const id    = uuidv4();
        const color = DEFAULT_TAG_DEFS.find((dt) => dt.name === name)?.color;
        nameToId.set(name, id);
        tagEntities.push({ id, name, color, createdAt: now, updatedAt: now });
      }
      await trans.table('tags').bulkAdd(tagEntities);

      // Step 4: Card.tags → Card.tagIds に変換し tags フィールドを削除
      await trans.table('cards').toCollection().modify((card: Record<string, unknown>) => {
        const names  = Array.isArray(card.tags) ? (card.tags as string[]) : [];
        const tagIds = names
          .map((n: string) => nameToId.get(n))
          .filter((id): id is string => id !== undefined);
        if (tagIds.length > 0) {
          card.tagIds = tagIds;
        }
        delete card.tags;
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
  // FSRS intraday スケジュール対応: 分単位の精度の nextReview を正しく判定するため
  // 日付文字列ではなく現在時刻の ISO 文字列で比較する（レキシコグラフィック順が成立する）
  const nowISO = new Date().toISOString();
  const collection = db.cards.where('nextReview').belowOrEqual(nowISO);
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

/** 指定日・指定デッキの学習ログ件数を返す（dailyLimit チェック用）*/
export async function getTodayStudyCountForDeck(deckId: string): Promise<number> {
  const todayStr = new Date().toISOString().split('T')[0];
  const start = `${todayStr}T00:00:00.000Z`;
  const end   = `${todayStr}T23:59:59.999Z`;
  // deckId に対応するカードIDを取得してからログを数える
  const cards = await db.cards.where('deckId').equals(deckId).toArray();
  const cardIds = new Set(cards.map((c) => c.id));
  const logs = await db.studyLogs.where('reviewedAt').between(start, end, true, true).toArray();
  return logs.filter((l) => cardIds.has(l.cardId)).length;
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

// ─── タグ操作 ─────────────────────────────────────────────────────────────────

/** 全タグを createdAt 昇順で返す */
export async function getAllTags(): Promise<Tag[]> {
  return db.tags.orderBy('createdAt').toArray();
}

/** 指定 ID のタグを返す */
export async function getTagById(id: string): Promise<Tag | undefined> {
  return db.tags.get(id);
}

/** タグを新規作成する */
export async function createTag(tag: Tag): Promise<void> {
  await db.tags.add(tag);
}

/** タグを更新する（put = upsert）*/
export async function updateTag(tag: Tag): Promise<void> {
  await db.tags.put(tag);
}

/** タグを削除する */
export async function deleteTagById(id: string): Promise<void> {
  await db.tags.delete(id);
}

/**
 * タグ名からタグ ID を取得する。存在しなければ新規作成して ID を返す。
 * デフォルトタグは色付きで、その他のタグは color = undefined で作成する。
 *
 * @param name  タグ名（trim 済みの非空文字列を期待）
 */
export async function ensureTagId(name: string): Promise<string> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Tag name cannot be empty');

  const existing = await db.tags.where('name').equals(trimmed).first();
  if (existing) return existing.id;

  const color    = DEFAULT_TAG_DEFS.find((dt) => dt.name === trimmed)?.color;
  const now      = new Date().toISOString();
  const newTag: Tag = {
    id:        uuidv4(),
    name:      trimmed,
    color,
    createdAt: now,
    updatedAt: now,
  };
  await db.tags.add(newTag);
  return newTag.id;
}

/**
 * タグ名の配列を受け取り、各名前に対応するタグ ID の配列を返す。
 * 存在しないタグは自動作成される（デフォルトタグは色付き）。
 * 重複 ID は除去して返す。
 *
 * @param names タグ名配列（空文字や重複は内部で除去）
 */
export async function ensureTagIds(names: string[]): Promise<string[]> {
  const unique = Array.from(new Set(names.map((n) => n.trim()).filter(Boolean)));
  const ids    = await Promise.all(unique.map(ensureTagId));
  return Array.from(new Set(ids));
}

/**
 * 全カードの tagIds を集計し、タグ ID ごとの使用枚数を返す。
 * タグ候補の使用頻度ソートに使用する。
 * O(cards) — 初回ロード時のキャッシュ構築用。
 */
export async function getTagUsageCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  await db.cards.each((card) => {
    if (Array.isArray(card.tagIds)) {
      for (const id of card.tagIds) {
        counts[id] = (counts[id] ?? 0) + 1;
      }
    }
  });
  return counts;
}
