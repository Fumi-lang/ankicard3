import { addDays, today } from '../utils/dateUtils';

/** SM-2アルゴリズムの入力 */
export interface SRSInput {
  quality: 0 | 1 | 2 | 3 | 4 | 5;
  easeFactor: number;
  interval: number;
  repetitions: number;
}

/** SM-2アルゴリズムの出力 */
export interface SRSOutput {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: string;
}

/** StudyQualityからSM-2 qualityスコアへのマッピング */
export const QUALITY_MAP = {
  again: 0,
  hard: 2,
  good: 4,
  easy: 5,
} as const;

/** easeFactor の最小値 */
const MIN_EASE_FACTOR = 1.3;

/**
 * SM-2アルゴリズム（Ankiの変種）を計算して次の復習スケジュールを返す
 *
 * quality 0-2: 不正解（intervalをリセット）
 * quality 3-5: 正解（intervalを伸ばす）
 */
export function calculateSRS(input: SRSInput): SRSOutput {
  const { quality, easeFactor, interval, repetitions } = input;

  let newEaseFactor = easeFactor;
  let newInterval: number;
  let newRepetitions: number;

  if (quality >= 3) {
    // 正解
    if (repetitions === 0) {
      newInterval = 1;
    } else if (repetitions === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.floor(interval * easeFactor);
    }
    newRepetitions = repetitions + 1;
  } else {
    // 不正解: intervalをリセット
    newInterval = 1;
    newRepetitions = 0;
  }

  // easeFactor更新（最小値1.3に制限）
  const easeAdjust = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02);
  newEaseFactor = Math.max(MIN_EASE_FACTOR, easeFactor + easeAdjust);

  const nextReview = addDays(today(), newInterval);

  return {
    easeFactor: Math.round(newEaseFactor * 1000) / 1000,
    interval: newInterval,
    repetitions: newRepetitions,
    nextReview,
  };
}

/** 新規カードのSM-2初期値 */
export function getInitialSRS(): Pick<SRSOutput, 'easeFactor' | 'interval' | 'repetitions' | 'nextReview'> {
  return {
    easeFactor: 2.5,
    interval: 0,
    repetitions: 0,
    nextReview: today(),
  };
}

/**
 * 各難易度ボタンの「次回復習までの目安」を返す（表示用）
 * lang: 'ja' | 'en' で単位表示を切り替え
 */
export function getNextReviewEstimates(
  easeFactor: number,
  interval: number,
  repetitions: number,
  lang: 'ja' | 'en' = 'ja'
): Record<'again' | 'hard' | 'good' | 'easy', string> {
  const unit = {
    min: lang === 'ja' ? '分' : 'min',
    day: lang === 'ja' ? '日' : 'd',
  };

  if (repetitions === 0) {
    // 新規カードの目安
    return {
      again: `<1${unit.min}`,
      hard: `<10${unit.min}`,
      good: `1${unit.day}`,
      easy: `4${unit.day}`,
    };
  }

  const hardInterval = Math.max(1, Math.floor(interval * 1.2));
  const goodInterval = Math.max(1, Math.floor(interval * easeFactor));
  const easyInterval = Math.max(1, Math.floor(interval * easeFactor * 1.3));

  return {
    again: `<1${unit.min}`,
    hard: `${hardInterval}${unit.day}`,
    good: `${goodInterval}${unit.day}`,
    easy: `${easyInterval}${unit.day}`,
  };
}
