/** 日付計算ユーティリティ */

/** 今日の日付をYYYY-MM-DD形式で返す */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** 指定日数後の日付をYYYY-MM-DD形式で返す */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

/** 2つの日付の差分を日数で返す（d2 - d1）*/
export function diffDays(d1: string, d2: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(d2).getTime() - new Date(d1).getTime()) / msPerDay);
}

/** 指定日付が今日以前かどうか */
export function isDueToday(dateStr: string): boolean {
  return dateStr <= today();
}

/** YYYY-MM-DD形式でフォーマット */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** ファイル名用の日付フォーマット（YYYYMMDD）*/
export function formatDateCompact(date: Date): string {
  return date.toISOString().split('T')[0].replace(/-/g, '');
}

/** 曜日インデックス（0=日曜）から今週の日付を返す */
export function getWeekDates(): string[] {
  const d = new Date();
  const day = d.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(d);
    date.setDate(d.getDate() - day + i);
    return formatDate(date);
  });
}
