import { calculateSRS, getInitialSRS } from '../services/srs';

describe('SM-2アルゴリズム', () => {
  // 新規カードの初期値
  const initial = { easeFactor: 2.5, interval: 0, repetitions: 0 };

  test('初回正解（quality=4）: interval=1, repetitions=1', () => {
    const result = calculateSRS({ quality: 4, ...initial });
    expect(result.repetitions).toBe(1);
    expect(result.interval).toBe(1);
    expect(result.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  test('2回目正解（quality=4）: interval=6, repetitions=2', () => {
    const result = calculateSRS({ quality: 4, easeFactor: 2.5, interval: 1, repetitions: 1 });
    expect(result.repetitions).toBe(2);
    expect(result.interval).toBe(6);
  });

  test('3回目正解（quality=4）: interval=前回×easeFactor', () => {
    const result = calculateSRS({ quality: 4, easeFactor: 2.5, interval: 6, repetitions: 2 });
    expect(result.repetitions).toBe(3);
    expect(result.interval).toBe(15); // floor(6 * 2.5) = 15
  });

  test('不正解（quality=0）: intervalとrepetitionsがリセット', () => {
    const result = calculateSRS({ quality: 0, easeFactor: 2.5, interval: 10, repetitions: 3 });
    expect(result.interval).toBe(1);
    expect(result.repetitions).toBe(0);
  });

  test('不正解後に正解（quality=4）: 再び通常ルート', () => {
    const afterFail = calculateSRS({ quality: 0, easeFactor: 2.5, interval: 10, repetitions: 3 });
    const afterRecovery = calculateSRS({ quality: 4, ...afterFail });
    expect(afterRecovery.interval).toBe(1); // repetitions=0 → interval=1
    expect(afterRecovery.repetitions).toBe(1);
  });

  test('easeFactorが最小値1.3を下回らない', () => {
    let state = { easeFactor: 1.3, interval: 1, repetitions: 1 };
    for (let i = 0; i < 5; i++) {
      state = calculateSRS({ quality: 0, ...state });
    }
    expect(state.easeFactor).toBeGreaterThanOrEqual(1.3);
  });

  test('quality=5（Easy）でeaseFactorが上昇する', () => {
    const result = calculateSRS({ quality: 5, easeFactor: 2.5, interval: 6, repetitions: 2 });
    expect(result.easeFactor).toBeGreaterThan(2.5);
  });

  test('quality=2（Hard）でeaseFactorが低下する', () => {
    const result = calculateSRS({ quality: 2, easeFactor: 2.5, interval: 6, repetitions: 2 });
    expect(result.easeFactor).toBeLessThan(2.5);
  });

  test('getInitialSRS: 今日の日付でnextReviewが設定される', () => {
    const init = getInitialSRS();
    const todayStr = new Date().toISOString().split('T')[0];
    expect(init.nextReview).toBe(todayStr);
    expect(init.easeFactor).toBe(2.5);
    expect(init.repetitions).toBe(0);
  });
});
