import { create } from 'zustand';
import type { Tag } from '../types';
import {
  getAllTags,
  getTagUsageCounts,
  ensureTagIds as dbEnsureTagIds,
  DEFAULT_TAG_NAMES,
} from '../services/database';

interface TagState {
  /** システム全体の全タグ（Dexie から都度ロード）*/
  tags:     Tag[];
  isLoaded: boolean;
  /**
   * タグ ID → 使用枚数（全カード集計）。
   * fetchAllTags 時にキャッシュし、ensureTagIds 後に再計算。
   */
  usageCounts: Record<string, number>;

  /**
   * 全タグを IndexedDB から読み込んでストアを更新する。
   * アプリ起動時と、タグ追加後に呼ぶ。
   */
  fetchAllTags: () => Promise<void>;

  /**
   * タグ名配列を受け取り、対応する Tag ID 配列を返す。
   * 存在しないタグは自動作成され、ストアも更新される。
   */
  ensureTagIds: (names: string[]) => Promise<string[]>;

  /**
   * ID 配列から Tag オブジェクト配列を返す（同期）。
   */
  getTagsByIds: (ids: string[]) => Tag[];

  /**
   * タグ名から Tag オブジェクトを返す（同期）。
   */
  getTagByName: (name: string) => Tag | undefined;

  /**
   * タグ候補用のソート済みタグ名配列（同期）。
   * 順序: デフォルトタグ先頭固定 → その他は使用頻度降順 → 同頻度は createdAt 昇順
   */
  sortedTagNames: () => string[];
}

/** タグ状態管理ストア（方式 B: 全件 Zustand キャッシュ）*/
export const useTagStore = create<TagState>((set, get) => ({
  tags:        [],
  isLoaded:    false,
  usageCounts: {},

  fetchAllTags: async () => {
    const [tags, usageCounts] = await Promise.all([getAllTags(), getTagUsageCounts()]);
    set({ tags, usageCounts, isLoaded: true });
  },

  ensureTagIds: async (names: string[]) => {
    if (names.length === 0) return [];
    const ids = await dbEnsureTagIds(names);
    // 新規タグ作成の可能性があるためストアを再同期
    const [freshTags, freshCounts] = await Promise.all([getAllTags(), getTagUsageCounts()]);
    set({ tags: freshTags, usageCounts: freshCounts, isLoaded: true });
    return ids;
  },

  getTagsByIds: (ids: string[]) => {
    if (ids.length === 0) return [];
    const map = new Map(get().tags.map((t) => [t.id, t]));
    return ids.map((id) => map.get(id)).filter((t): t is Tag => t !== undefined);
  },

  getTagByName: (name: string) => {
    return get().tags.find((t) => t.name === name);
  },

  sortedTagNames: () => {
    const { tags, usageCounts } = get();
    const defaults = tags.filter((t) => DEFAULT_TAG_NAMES.has(t.name));
    const others   = tags.filter((t) => !DEFAULT_TAG_NAMES.has(t.name));

    // その他: 使用頻度降順 → 同頻度は createdAt 昇順（古い＝安定したタグが上）
    others.sort((a, b) => {
      const diff = (usageCounts[b.id] ?? 0) - (usageCounts[a.id] ?? 0);
      if (diff !== 0) return diff;
      return a.createdAt.localeCompare(b.createdAt);
    });

    // デフォルトタグは仕様定義順（単語 → 穴埋め）に固定
    const orderedDefaults = [...DEFAULT_TAG_NAMES]
      .map((name) => defaults.find((t) => t.name === name))
      .filter((t): t is Tag => t !== undefined);

    return [...orderedDefaults, ...others].map((t) => t.name);
  },
}));
