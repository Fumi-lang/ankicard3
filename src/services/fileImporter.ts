import type { ImportResult, ImportedCardData, CardForm } from '../types';
import { parseCSV } from './csvParser';
import { parseJSONCards } from './jsonParser';

/** ファイル選択ダイアログを表示してFileオブジェクトを返す */
export function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.json,.pdf,.docx,.txt';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0] ?? null;
      resolve(file);
    };
    input.click();
  });
}

/** ファイルを解析してImportResultを返す */
export async function importFile(
  file: File,
  delimiter?: string,
  defaultCardForm: CardForm = 'translation'
): Promise<ImportResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';

  let cards: ImportedCardData[];
  let fileType: ImportResult['fileType'];

  switch (ext) {
    case 'csv':
    case 'tsv':
    case 'txt': {
      cards = await parseCSV(file, defaultCardForm);
      fileType = 'csv';
      break;
    }
    case 'json': {
      const text = await file.text();
      const result = parseJSONCards(text);
      cards = result.cards;
      fileType = result.isMemoryFlow ? 'memoryflow' : 'json';
      break;
    }
    case 'pdf': {
      const { parsePDF } = await import('./pdfParser');
      cards = await parsePDF(file, delimiter);
      fileType = 'pdf';
      break;
    }
    case 'docx': {
      const { parseDOCX } = await import('./docxParser');
      cards = await parseDOCX(file, delimiter);
      fileType = 'docx';
      break;
    }
    default:
      throw new Error(`INVALID_FILE: 非対応の形式: ${ext}`);
  }

  const validCount = cards.filter((c) => c.isValid).length;
  const errorCount = cards.length - validCount;

  return {
    cards,
    totalRows: cards.length,
    validCount,
    errorCount,
    fileType,
  };
}

/**
 * テキストから単語ペアを検出する（PDF/DOCX共通ロジック）
 *
 * 検出優先順:
 * 1. 区切り文字（delimiter指定時）
 * 2. [-–—:：→⇒] 区切り
 * 3. 番号付きリスト
 * 4. タブ区切り
 */
export function parseTextPairs(
  text: string,
  delimiter?: string
): ImportedCardData[] {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  const results: ImportedCardData[] = [];

  const sepPattern = delimiter
    ? new RegExp(`^(.+?)\\s*${escapeRegExp(delimiter)}\\s*(.+)$`)
    : /^(.+?)\s*[-–—:：→⇒]\s*(.+)$/;

  const numberedPattern = /^\d+[.)）]\s*(.+?)\s*[-–—:：→⇒]\s*(.+)$/;
  const tabPattern = /^(.+?)\t+(.+)$/;

  for (const line of lines) {
    let match: RegExpMatchArray | null;

    if ((match = line.match(sepPattern))) {
      results.push({ cardForm: 'translation', frontText: match[1].trim(), backText: match[2].trim(), isValid: true });
    } else if ((match = line.match(numberedPattern))) {
      results.push({ cardForm: 'translation', frontText: match[1].trim(), backText: match[2].trim(), isValid: true });
    } else if ((match = line.match(tabPattern))) {
      results.push({ cardForm: 'translation', frontText: match[1].trim(), backText: match[2].trim(), isValid: true });
    }
  }

  return results;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
