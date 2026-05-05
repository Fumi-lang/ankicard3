/**
 * セッション制御ユーティリティ
 *
 * FSRSの「graduate（翌日以降に送られた）」判定と、
 * 次回復習日の分布バケット計算を提供する。
 *
 * 【判定方針】
 *   評価ラベル（Again/Hard/Good/Easy）ではなく、FSRSが返す nextReview の値のみで判定する。
 *   これにより Learning Steps の設定変更に自動追従できる。
 *
 * 【将来の切り替えポイント】
 *   「翌日のローカル日付到達」基準に変更したい場合は isCardGraduatedFromSession のみ修正する。
 */

/** Graduate 判定の閾値（時間）: この時間以上先に nextReview が設定されていれば graduate */
export const SESSION_GRADUATION_THRESHOLD_HOURS = 24;

/**
 * カードがセッションを graduate したか（翌日以降に送られたか）を判定する
 *
 * 現在の実装: nextReview - now >= SESSION_GRADUATION_THRESHOLD_HOURS
 * 将来の選択肢: new Date(nextReview).toLocaleDateString() > now.toLocaleDateString()
 *
 * @param nextReview  FSRSが返した次回復習日時（UTC ISO文字列）
 * @param now         評価を行った時刻
 */
export function isCardGraduatedFromSession(nextReview: string, now: Date): boolean {
  const thresholdMs = SESSION_GRADUATION_THRESHOLD_HOURS * 60 * 60 * 1000;
  return new Date(nextReview).getTime() - now.getTime() >= thresholdMs;
}

// ── 復習分布バケット ─────────────────────────────────────────────────────────

/** 次回復習日の分布バケット */
export type ReviewBucket = 'tomorrow' | 'soon' | 'week' | 'later';

/**
 * 次回復習日から分布バケットを返す
 *
 * tomorrow: 〜1日後（翌日）
 * soon:     2〜3日後
 * week:     4〜7日後
 * later:    8日以降
 */
export function getReviewBucket(nextReview: string, now: Date): ReviewBucket {
  const diffDays = (new Date(nextReview).getTime() - now.getTime()) / 86400000;
  if (diffDays < 2) return 'tomorrow';
  if (diffDays < 4) return 'soon';
  if (diffDays < 8) return 'week';
  return 'later';
}

/** 分布バケットの表示順（固定）*/
export const REVIEW_BUCKET_ORDER: ReviewBucket[] = ['tomorrow', 'soon', 'week', 'later'];
