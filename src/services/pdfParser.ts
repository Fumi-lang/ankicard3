import type { ImportedCardData } from '../types';
import { parseTextPairs } from './fileImporter';

/** PDFファイルからテキストを抽出してカードデータに変換 */
export async function parsePDF(
  file: File,
  delimiter?: string
): Promise<ImportedCardData[]> {
  // pdfjs-distをブラウザ互換で動的インポート
  const pdfjsLib = await import('pdfjs-dist');

  // workerを無効化（Web環境でのシンプルな実装）
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    fullText += pageText + '\n';
  }

  return parseTextPairs(fullText, delimiter);
}
