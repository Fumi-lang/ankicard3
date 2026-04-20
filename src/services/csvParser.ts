import Papa from 'papaparse';
import type { ImportedCardData, CardForm } from '../types';

/** CSV/TSVファイルを解析してImportedCardData[]に変換 */
export async function parseCSV(
  file: File,
  defaultCardForm: CardForm = 'translation'
): Promise<ImportedCardData[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        const rows = results.data as string[][];
        const cards = rows
          .map((row, i) => parseCSVRow(row, i, defaultCardForm))
          .filter((c): c is ImportedCardData => c !== null);
        resolve(cards);
      },
      error: (err) => reject(err),
    });
  });
}

/** 文字列からCSVを解析（テキスト入力用）*/
export function parseCSVText(
  text: string,
  defaultCardForm: CardForm = 'translation'
): ImportedCardData[] {
  const results = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });
  return (results.data as string[][])
    .map((row, i) => parseCSVRow(row, i, defaultCardForm))
    .filter((c): c is ImportedCardData => c !== null);
}

function parseCSVRow(
  row: string[],
  index: number,
  defaultCardForm: CardForm
): ImportedCardData | null {
  if (row.length < 2) {
    return {
      cardForm: defaultCardForm,
      frontText: row[0]?.trim() ?? '',
      backText: '',
      isValid: false,
      errorMessage: `行 ${index + 1}: 列が足りません（2列以上必要）`,
    };
  }

  const frontText = row[0]?.trim() ?? '';
  const backText = row[1]?.trim() ?? '';
  const cardFormRaw = row[2]?.trim().toLowerCase();

  const validForms: CardForm[] = ['translation', 'cloze'];
  const cardForm: CardForm = validForms.includes(cardFormRaw as CardForm)
    ? (cardFormRaw as CardForm)
    : defaultCardForm;

  if (!frontText || !backText) {
    return {
      cardForm,
      frontText,
      backText,
      isValid: false,
      errorMessage: `行 ${index + 1}: 表面または裏面が空です`,
    };
  }

  return { cardForm, frontText, backText, isValid: true };
}
