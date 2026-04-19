import type { ImportedCardData } from '../types';
import { parseTextPairs } from './fileImporter';

/** DOCXファイルからテキストを抽出してカードデータに変換 */
export async function parseDOCX(
  file: File,
  delimiter?: string
): Promise<ImportedCardData[]> {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();

  const result = await mammoth.extractRawText({ arrayBuffer });
  return parseTextPairs(result.value, delimiter);
}
