import { getInitialCardValues, reviewCard, previewRatings, FSRS_RATING_MAP } from '../services/srs';
import type { Card } from '../types';

// テスト用の最小カード生成ヘルパー
function makeCard(overrides: Partial<Card> = {}): Card {
  const base = getInitialCardValues();
  return {
    id: 'test-card-id',
    deckId: 'test-deck-id',
    frontText: 'hello',
    backText: 'こんにちは',
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...base,
    ...overrides,
  };
}

describe('FSRS-6.0 スケジューリング', () => {
  const now = new Date('2024-06-01T00:00:00.000Z');

  test('getInitialCardValues: FSRS 初期値と SM-2 互換フィールドを返す', () => {
    const init = getInitialCardValues();
    expect(init.easeFactor).toBe(2.5);
    expect(init.interval).toBe(0);
    expect(init.repetitions).toBe(0);
    expect(init.fsrs?.state).toBe('new');
    expect(init.fsrs?.difficulty).toBe(0);
    expect(init.fsrs?.stability).toBe(0);
    expect(init.fsrs?.lapses).toBe(0);
    expect(init.fsrs?.reps).toBe(0);
    // nextReview は今日の UTC 00:00:00.000Z
    expect(init.nextReview).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
  });

  test('FSRS_RATING_MAP: 4択のマッピングが正しい', () => {
    expect(FSRS_RATING_MAP.again).toBe(1);
    expect(FSRS_RATING_MAP.hard).toBe(2);
    expect(FSRS_RATING_MAP.good).toBe(3);
    expect(FSRS_RATING_MAP.easy).toBe(4);
  });

  test('reviewCard(again): 新規カードを Again 評価すると Learning 状態になる', () => {
    const card = makeCard();
    const { updatedCard, log } = reviewCard(card, 'again', now);
    expect(updatedCard.fsrs?.state).toBe('learning');
    expect(updatedCard.fsrs?.reps).toBeGreaterThanOrEqual(1);
    expect(log.rating).toBe(1);
    expect(log.cardId).toBe(card.id);
  });

  test('reviewCard(good): 新規カードを Good 評価すると Learning 状態になる', () => {
    const card = makeCard();
    const { updatedCard, log } = reviewCard(card, 'good', now);
    expect(['learning', 'review']).toContain(updatedCard.fsrs?.state);
    expect(log.rating).toBe(3);
  });

  test('reviewCard(easy): 新規カードを Easy 評価すると Review 状態になる', () => {
    const card = makeCard();
    const { updatedCard } = reviewCard(card, 'easy', now);
    expect(updatedCard.fsrs?.state).toBe('review');
    // Review 状態の nextReview は 00:00:00.000Z に正規化される
    expect(updatedCard.nextReview).toMatch(/T00:00:00\.000Z$/);
  });

  test('reviewCard: lastReview と updatedAt が now の ISO 文字列になる', () => {
    const card = makeCard();
    const { updatedCard } = reviewCard(card, 'good', now);
    expect(updatedCard.lastReview).toBe(now.toISOString());
    expect(updatedCard.updatedAt).toBe(now.toISOString());
    expect(updatedCard.fsrs?.lastReview).toBe(now.toISOString());
  });

  test('reviewCard: SM-2 互換フィールド（interval/repetitions）も更新される', () => {
    const card = makeCard();
    const { updatedCard } = reviewCard(card, 'easy', now);
    expect(updatedCard.interval).toBeGreaterThanOrEqual(0);
    expect(updatedCard.repetitions).toBeGreaterThanOrEqual(1);
  });

  test('previewRatings: 4択の目安文字列が返る（ja）', () => {
    const card = makeCard();
    const estimates = previewRatings(card, now, 'ja');
    expect(estimates).toHaveProperty('again');
    expect(estimates).toHaveProperty('hard');
    expect(estimates).toHaveProperty('good');
    expect(estimates).toHaveProperty('easy');
    // 日本語の単位を含む
    const units = ['分', '時間', '日', '<1分'];
    const hasJaUnit = Object.values(estimates).every(
      (s) => units.some((u) => s.includes(u))
    );
    expect(hasJaUnit).toBe(true);
  });

  test('previewRatings: 4択の目安文字列が返る（en）', () => {
    const card = makeCard();
    const estimates = previewRatings(card, now, 'en');
    const units = ['m', 'h', 'd', '<1m'];
    const hasEnUnit = Object.values(estimates).every(
      (s) => units.some((u) => s.includes(u))
    );
    expect(hasEnUnit).toBe(true);
  });

  test('lapses: Again を2回評価するとラプス数が増える', () => {
    let card = makeCard();
    const { updatedCard: c1 } = reviewCard(card, 'easy', new Date('2024-06-01T00:00:00.000Z'));
    // Review 状態にしてから Again
    const { updatedCard: c2 } = reviewCard(c1, 'again', new Date('2024-06-10T00:00:00.000Z'));
    expect(c2.fsrs?.lapses).toBeGreaterThanOrEqual(1);
  });
});
