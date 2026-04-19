import Papa from 'papaparse';
import type { ImportedCardData, CardType } from '../types';

/** CSV/TSVファイルを解析してImportedCardData[]に変換 */
export async function parseCSV(file: File): Promise<ImportedCardData[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][];
        const cards = rows
          .map((row, i) => parseCSVRow(row, i))
          .filter((c): c is ImportedCardData => c !== null);
        resolve(cards);
      },
      error: (err) => reject(err),
    });
  });
}

/** 文字列からCSVを解析（テキスト入力用）*/
export function parseCSVText(text: string): ImportedCardData[] {
  const results = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });
  return (results.data as string[][])
    .map((row, i) => parseCSVRow(row, i))
    .filter((c): c is ImportedCardData => c !== null);
}

function parseCSVRow(row: string[], index: number): ImportedCardData | null {
  if (row.length < 2) {
    return {
      cardType: 'word',
      frontText: row[0]?.trim() ?? '',
      backText: '',
      isValid: false,
      errorMessage: `行 ${index + 1}: 列が足りません（2列以上必要）`,
    };
  }

  const frontText = row[0]?.trim() ?? '';
  const backText = row[1]?.trim() ?? '';
  const cardTypeRaw = row[2]?.trim().toLowerCase();

  const validTypes: CardType[] = ['word', 'collocation', 'sentence'];
  const cardType: CardType = validTypes.includes(cardTypeRaw as CardType)
    ? (cardTypeRaw as CardType)
    : 'word';

  if (!frontText || !backText) {
    return {
      cardType,
      frontText,
      backText,
      isValid: false,
      errorMessage: `行 ${index + 1}: 表面または裏面が空です`,
    };
  }

  return { cardType, frontText, backText, isValid: true };
}
