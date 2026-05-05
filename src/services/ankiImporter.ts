/**
 * Anki .colpkg / .apkg インポーター（クライアントサイド・純 JS）
 *
 * 対応フォーマット:
 *   - .colpkg / .apkg  — ZIP アーカイブ内の SQLite ファイルを解析
 *   - collection.anki21b — Zstandard 圧縮 SQLite（Anki 2.1.50+）
 *   - collection.anki21  — 非圧縮 SQLite（Anki 2.1.x）
 *   - collection.anki2   — 非圧縮 SQLite（旧 Anki 2.0）
 *
 * 使用ライブラリ:
 *   - fflate@^0.8.0  — ZIP 解凍
 *   - fzstd@^0.1.1   — Zstandard 解凍
 *   - sql.js (asm.js) — SQLite クエリ（WASM 不要）
 *
 * import.meta を使用しない実装。Web Worker 不使用。
 */

import { unzipSync } from 'fflate';
import { decompress as zstdDecompress } from 'fzstd';
import { cleanHtml } from './htmlUtils';
import type { CardForm } from '../types';

// sql.js asm.js build を static require で読み込む（import.meta 不使用）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const initSqlJs: () => Promise<SqlJsStatic> = require('sql.js/dist/sql-asm.js');

// ── 型定義 ─────────────────────────────────────────────────────────────────────

/** sql.js が返す型（型情報なしパッケージのため手書き）*/
interface SqlJsStatic {
  Database: new (data?: ArrayLike<number> | Buffer | null) => SqlDatabase;
}
interface SqlDatabase {
  exec(sql: string, params?: unknown[]): SqlResult[];
  run(sql: string, params?: unknown[]): void;
  close(): void;
}
interface SqlResult {
  columns: string[];
  values: unknown[][];
}

/** インポートされた1デッキ分のデータ */
export interface AnkiDeck {
  /** Anki デッキ名（階層は "親::子" 形式）*/
  name: string;
  cards: AnkiCard[];
}

/** インポートされた1枚のカード */
export interface AnkiCard {
  frontText: string;
  backText:  string;
  cardForm:  CardForm;
  memo?:     string;
  tags?:     string[];
}

/** parseAnkiFile() の戻り値 */
export interface AnkiImportResult {
  decks: AnkiDeck[];
  /** パース中に発生した警告メッセージ */
  warnings: string[];
}

// ── 定数 ───────────────────────────────────────────────────────────────────────

/** Anki ノートフィールドの区切り文字（U+001F）*/
const FIELD_SEP = '\x1f';

/** Anki デフォルトデッキ ID（"Default" デッキ）*/
const DEFAULT_DECK_ID = 1;

// ── メインエントリ ──────────────────────────────────────────────────────────────

/**
 * .colpkg / .apkg ファイルを解析して AnkiImportResult を返す
 * @param file  ユーザーが選択したファイルオブジェクト
 */
export async function parseAnkiFile(file: File): Promise<AnkiImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // ── 1. ZIP を解凍して SQLite バイト列を取得 ─────────────────────────────────
  let sqliteBytes: Uint8Array;
  try {
    const files = unzipSync(uint8);

    if (files['collection.anki21b']) {
      // Zstandard 圧縮 SQLite（Anki 2.1.50+）
      sqliteBytes = zstdDecompress(files['collection.anki21b']);
    } else if (files['collection.anki21']) {
      sqliteBytes = files['collection.anki21'];
    } else if (files['collection.anki2']) {
      sqliteBytes = files['collection.anki2'];
    } else {
      const keys = Object.keys(files).join(', ');
      throw new Error(`対応する collection ファイルが見つかりません。含まれるファイル: ${keys}`);
    }
  } catch (e) {
    throw new Error(`ZIP の解凍に失敗しました: ${String(e)}`);
  }

  // ── 2. sql.js で SQLite を開く ──────────────────────────────────────────────
  let SQL: SqlJsStatic;
  try {
    SQL = await initSqlJs();
  } catch (e) {
    throw new Error(`SQL エンジンの初期化に失敗しました: ${String(e)}`);
  }

  const db = new SQL.Database(sqliteBytes);
  const warnings: string[] = [];

  try {
    // ── 3. デッキ・ノートタイプ・カード情報を取得 ──────────────────────────────
    const deckMap  = loadDeckMap(db, warnings);
    const modelMap = loadModelMap(db, warnings);
    const result   = extractCards(db, deckMap, modelMap, warnings);
    return { decks: result, warnings };
  } finally {
    db.close();
  }
}

// ── デッキ情報の読み込み ────────────────────────────────────────────────────────

/**
 * col テーブルの decks JSON または decks テーブル（Anki 2.1.28+）からデッキ名マップを返す
 * @returns Map<deckId (number), deckName (string)>
 */
function loadDeckMap(db: SqlDatabase, warnings: string[]): Map<number, string> {
  const map = new Map<number, string>();

  // 新形式（Anki 2.1.28+）: decks テーブルが存在する
  try {
    const res = db.exec("SELECT id, name FROM decks");
    if (res.length > 0) {
      for (const row of res[0].values) {
        const id   = Number(row[0]);
        const name = String(row[1] ?? 'Unknown');
        map.set(id, sanitizeDeckName(name));
      }
      return map;
    }
  } catch {
    // テーブルが存在しない場合は旧形式にフォールバック
  }

  // 旧形式: col テーブルの decks JSON
  try {
    const res = db.exec("SELECT decks FROM col LIMIT 1");
    if (res.length > 0 && res[0].values.length > 0) {
      const raw = String(res[0].values[0][0]);
      const parsed = JSON.parse(raw) as Record<string, { id: number; name: string }>;
      for (const deck of Object.values(parsed)) {
        if (deck.id !== undefined && deck.name !== undefined) {
          map.set(Number(deck.id), sanitizeDeckName(deck.name));
        }
      }
    }
  } catch (e) {
    warnings.push(`デッキ情報の読み込みに失敗しました: ${String(e)}`);
  }

  // フォールバック: デッキが取得できなかった場合
  if (map.size === 0) {
    map.set(DEFAULT_DECK_ID, 'Imported Deck');
  }

  return map;
}

/** Anki の内部デッキ名（"親::子"）を保持したまま返す。先頭・末尾スペースのみ除去 */
function sanitizeDeckName(name: string): string {
  // "Default" デッキは "Imported Deck" に変換
  const trimmed = name.trim();
  return trimmed === 'Default' ? 'Imported Deck' : trimmed;
}

// ── ノートタイプ（モデル）情報の読み込み ────────────────────────────────────────

/** ノートタイプ情報 */
interface NoteModel {
  /** フィールド名の配列（インデックス順）*/
  fields: string[];
  /** テンプレート種別: 'basic' | 'cloze' */
  type: 'basic' | 'cloze';
}

/**
 * notetypes テーブルまたは col.models JSON からノートタイプマップを返す
 * @returns Map<modelId (number), NoteModel>
 */
function loadModelMap(db: SqlDatabase, warnings: string[]): Map<number, NoteModel> {
  const map = new Map<number, NoteModel>();

  // 新形式: notetypes + fields テーブル
  try {
    const ntRes = db.exec("SELECT id, name, config FROM notetypes");
    const fRes  = db.exec("SELECT ntid, name, ord FROM fields ORDER BY ntid, ord");
    if (ntRes.length > 0) {
      // フィールドをモデルIDごとにグループ化
      const fieldsByModel = new Map<number, string[]>();
      if (fRes.length > 0) {
        for (const row of fRes[0].values) {
          const ntid = Number(row[0]);
          const name = String(row[1] ?? '');
          if (!fieldsByModel.has(ntid)) fieldsByModel.set(ntid, []);
          fieldsByModel.get(ntid)!.push(name);
        }
      }

      for (const row of ntRes[0].values) {
        const id   = Number(row[0]);
        const conf = row[2];
        const type = detectModelType(conf, String(row[1] ?? ''));
        map.set(id, {
          fields: fieldsByModel.get(id) ?? [],
          type,
        });
      }
      return map;
    }
  } catch {
    // フォールバックへ
  }

  // 旧形式: col.models JSON
  try {
    const res = db.exec("SELECT models FROM col LIMIT 1");
    if (res.length > 0 && res[0].values.length > 0) {
      const raw = String(res[0].values[0][0]);
      const parsed = JSON.parse(raw) as Record<string, {
        id: number | string;
        name: string;
        type: number;  // 0 = basic, 1 = cloze
        flds: Array<{ name: string; ord: number }>;
      }>;

      for (const model of Object.values(parsed)) {
        const id     = Number(model.id);
        const isCloze = model.type === 1;
        const fields  = (model.flds ?? [])
          .sort((a, b) => a.ord - b.ord)
          .map((f) => f.name);
        map.set(id, { fields, type: isCloze ? 'cloze' : 'basic' });
      }
    }
  } catch (e) {
    warnings.push(`ノートタイプ情報の読み込みに失敗しました: ${String(e)}`);
  }

  return map;
}

/** ノートタイプが cloze かどうかを判定する */
function detectModelType(config: unknown, name: string): 'basic' | 'cloze' {
  // 新形式の config はプロトバッファのバイナリだが、
  // 名前に "cloze" が含まれる場合は穴埋め型とみなす（ヒューリスティック）
  if (typeof name === 'string' && name.toLowerCase().includes('cloze')) return 'cloze';

  // config がバイナリの場合: Anki のプロトバッファで kind=1 は cloze
  if (config instanceof Uint8Array || (Array.isArray(config) && config.length > 0)) {
    // プロトバッファ簡易解析: フィールド番号 1, wire type 0 = varint
    // kind フィールドは通常先頭バイト 0x08 に続く varint
    try {
      const bytes = config instanceof Uint8Array ? config : new Uint8Array(config as number[]);
      if (bytes[0] === 0x08 && bytes[1] === 0x01) return 'cloze';
    } catch {
      // ignore
    }
  }
  return 'basic';
}

// ── カード抽出 ──────────────────────────────────────────────────────────────────

/**
 * notes / cards テーブルからカードを抽出し、デッキ別に整理して返す
 */
function extractCards(
  db: SqlDatabase,
  deckMap:  Map<number, string>,
  modelMap: Map<number, NoteModel>,
  warnings: string[]
): AnkiDeck[] {

  // notes テーブルからノートを取得
  let notesRes: SqlResult[];
  try {
    notesRes = db.exec("SELECT id, mid, tags, flds FROM notes");
  } catch (e) {
    throw new Error(`ノートの読み込みに失敗しました: ${String(e)}`);
  }

  if (!notesRes.length || !notesRes[0].values.length) {
    return [];
  }

  // cards テーブルから did (デッキID) と nid (ノートID) を取得
  // ord も取得（穴埋め: どの cN を表面に出すか）
  const cardsByNote = new Map<number, Array<{ did: number; ord: number }>>();
  try {
    const cardsRes = db.exec("SELECT nid, did, ord FROM cards");
    if (cardsRes.length > 0) {
      for (const row of cardsRes[0].values) {
        const nid = Number(row[0]);
        const did = Number(row[1]);
        const ord = Number(row[2]);
        if (!cardsByNote.has(nid)) cardsByNote.set(nid, []);
        cardsByNote.get(nid)!.push({ did, ord });
      }
    }
  } catch (e) {
    warnings.push(`カード情報の読み込みに失敗しました: ${String(e)}`);
  }

  // デッキ別カード集約
  const deckCards = new Map<number, AnkiCard[]>();

  for (const row of notesRes[0].values) {
    const nid    = Number(row[0]);
    const mid    = Number(row[1]);
    const rawTags = String(row[2] ?? '').trim();
    const flds   = String(row[3] ?? '');

    const fields = flds.split(FIELD_SEP).map(cleanHtml);
    const model  = modelMap.get(mid);
    const tags   = rawTags ? rawTags.split(/\s+/).filter(Boolean) : undefined;

    // カードのデッキIDを取得（複数カードある場合は最初の did を使用）
    const cardInfos = cardsByNote.get(nid) ?? [{ did: DEFAULT_DECK_ID, ord: 0 }];
    const primaryDid = cardInfos[0].did;

    if (!deckCards.has(primaryDid)) deckCards.set(primaryDid, []);

    if (model?.type === 'cloze') {
      // 穴埋めノートから穴埋めカードを生成
      // 同じノートから複数カード（c1, c2, ...）が生成されることがある
      const clozeNums = extractClozeNumbers(flds);
      if (clozeNums.size === 0) {
        // cloze マーカーなし: 通常カードとして扱う
        const card = buildBasicCard(fields, tags);
        if (card) deckCards.get(primaryDid)!.push(card);
      } else {
        // 各 cN について1枚ずつ生成
        for (const cNum of clozeNums) {
          const card = buildClozeCard(fields, cNum, tags);
          if (card) {
            // cN ごとにデッキIDが異なる場合があるので cardInfos から探す
            const info = cardInfos.find((c) => c.ord === cNum - 1) ?? cardInfos[0];
            if (!deckCards.has(info.did)) deckCards.set(info.did, []);
            deckCards.get(info.did)!.push(card);
          }
        }
      }
    } else {
      // 通常（Basic）カード
      const card = buildBasicCard(fields, tags);
      if (card) deckCards.get(primaryDid)!.push(card);
    }
  }

  // デッキIDをデッキ名に変換して AnkiDeck[] を作成
  const result: AnkiDeck[] = [];
  for (const [did, cards] of deckCards.entries()) {
    if (cards.length === 0) continue;
    const name = deckMap.get(did) ?? `Deck ${did}`;
    result.push({ name, cards });
  }

  // デッキ名でソート（表示の安定性のため）
  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

// ── カード生成ヘルパー ──────────────────────────────────────────────────────────

/**
 * Basic ノートから翻訳カードを生成する
 * フィールド 0 = 表面（学習言語）、フィールド 1 = 裏面（母語）
 */
function buildBasicCard(
  fields: string[],
  tags:   string[] | undefined
): AnkiCard | null {
  const front = fields[0]?.trim();
  const back  = fields[1]?.trim();
  if (!front && !back) return null;

  // Anki では Field 0 が通常「表面」の元データだが、
  // MemoryFlow の translation カードは:
  //   backText  = 学習言語テキスト（表示上は "表面"）
  //   frontText = 母語テキスト（表示上は "裏面"）
  return {
    frontText: back  ?? front ?? '',
    backText:  front ?? '',
    cardForm:  'translation',
    tags:      tags && tags.length > 0 ? tags : undefined,
  };
}

/**
 * Cloze ノートから穴埋めカードを生成する
 * @param cNum  対象の穴埋め番号（1 始まり）
 *
 * target (backText)  = 空所入り文（___）
 * source (frontText) = 答え（空所に入る語句）
 */
function buildClozeCard(
  fields: string[],
  cNum:   number,
  tags:   string[] | undefined
): AnkiCard | null {
  const rawFront = fields[0] ?? '';  // 穴埋め文
  const rawBack  = fields[1] ?? '';  // 意味（母語）

  // cN::answer → ___ に変換（表面: 問題文）
  const question = convertClozeToBlank(rawFront, cNum);
  // 答え（cNum に対応する answer テキストを抽出）
  const answer   = extractClozeAnswer(rawFront, cNum);

  if (!question.trim() || !answer.trim()) return null;

  const memo = rawBack.trim() || undefined;

  return {
    frontText: answer,         // 答え（穴埋めに入る語句）
    backText:  question,       // 空所入り問題文（___を含む）
    cardForm:  'cloze',
    memo,
    tags: tags && tags.length > 0 ? tags : undefined,
  };
}

// ── Cloze 変換ユーティリティ ────────────────────────────────────────────────────

/** Anki の {{cN::...}} パターン（hint 付き: {{cN::answer::hint}}）*/
const CLOZE_PATTERN = /\{\{c(\d+)::([^}:]+)(?:::[^}]*)?\}\}/g;

/**
 * テキスト中に存在する全穴埋め番号を返す
 */
function extractClozeNumbers(text: string): Set<number> {
  const nums = new Set<number>();
  const pattern = /\{\{c(\d+)::/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    nums.add(parseInt(m[1], 10));
  }
  return nums;
}

/**
 * cNum に対応する穴埋め部分を ___ に置換し、他の穴埋めは答えテキストをそのまま表示する
 */
function convertClozeToBlank(text: string, cNum: number): string {
  // HTML クリーンアップは既に cleanHtml で済んでいるが、
  // Cloze マーカーは HTML ではないため CLOZE_PATTERN で処理する
  return text.replace(CLOZE_PATTERN, (_, num, answer) => {
    return parseInt(num, 10) === cNum ? '___' : answer;
  });
}

/**
 * cNum に対応する答えテキストを抽出する
 */
function extractClozeAnswer(text: string, cNum: number): string {
  const pattern = /\{\{c(\d+)::([^}:]+)(?:::[^}]*)?\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text)) !== null) {
    if (parseInt(m[1], 10) === cNum) {
      return cleanHtml(m[2]);
    }
  }
  return '';
}
