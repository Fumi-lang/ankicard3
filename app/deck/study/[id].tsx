import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStudySession } from '../../../src/hooks/useStudySession';
import { useSpacedRepetition } from '../../../src/hooks/useSpacedRepetition';
import { useMotivation } from '../../../src/hooks/useMotivation';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { getDeckById } from '../../../src/services/database';
import { FlashCard } from '../../../src/components/FlashCard';
import { DifficultyButtons } from '../../../src/components/DifficultyButtons';
import { MotivationBanner } from '../../../src/components/MotivationBanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { REVIEW_BUCKET_ORDER, type ReviewBucket } from '../../../src/services/sessionUtils';
import type { Deck, StudyQuality } from '../../../src/types';

/** 応援バナー領域の高さ（常にこの分の空間を確保する）*/
const MOTIVATION_BANNER_HEIGHT = 56;

/** 学習セッション画面 */
export default function StudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ja' | 'en';
  const { autoPlaySpeech } = useSettingsStore();

  const {
    currentCard, isFlipped, isComplete, isLoading,
    progressCompleted, progressTotal,
    consecutiveGraduated,
    summary,
    loadCards, flipCard, answerCard,
  } = useStudySession();

  const { getEstimates } = useSpacedRepetition();
  const { getSessionMessage } = useMotivation();

  const insets = useSafeAreaInsets();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  // ボタン二重タップ防止
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    const deckId = id === 'all' ? undefined : id;
    if (id && id !== 'all') {
      getDeckById(id).then((d) => {
        setDeck(d ?? null);
        // デッキ設定を loadCards に渡す。selectTodayCards が Mode A/B・上限・順序付けを担う
        loadCards(deckId, d ?? undefined);
      });
    } else {
      loadCards(deckId);
    }
  }, [id]);

  useEffect(() => {
    // 連続 graduate 数をモチベーションメッセージのトリガーに使う
    const msg = getSessionMessage({ consecutiveCorrect: consecutiveGraduated });
    if (msg) {
      setSessionMessage(msg);
      setTimeout(() => setSessionMessage(null), 3500);
    }
  }, [consecutiveGraduated]);

  // デッキ固有の FSRS カスタム重み（未設定時は undefined → ライブラリデフォルト使用）
  const fsrsWeights = deck?.extraSettings?.fsrsWeights;

  const handleAnswer = async (quality: StudyQuality) => {
    if (isAnswering) return;
    setIsAnswering(true);
    await answerCard(quality, fsrsWeights);
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(quality === 'again' ? 100 : 30);
    }
    setIsAnswering(false);
  };

  const estimates = currentCard
    ? getEstimates(currentCard, lang, fsrsWeights)
    : (lang === 'ja'
      ? { again: '<1分', hard: '<10分', good: '1日', easy: '4日' }
      : { again: '<1m',  hard: '<10m',  good: '1d',  easy: '4d'  });

  // 進捗バー: graduated カード数 / 総カード数
  const progressRatio = progressTotal > 0 ? progressCompleted / progressTotal : 0;

  // frontSpeechLang / backSpeechLang は deck に直接保持する（v6 マイグレーション済み）

  // ── ローディング ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── セッション完了 ────────────────────────────────────────────────────────

  if (isComplete && summary) {
    const bucketLabels: Record<ReviewBucket, string> = {
      tomorrow: t('study.distributionTomorrow'),
      soon:     t('study.distributionSoon'),
      week:     t('study.distributionWeek'),
      later:    t('study.distributionLater'),
    };
    const unit = t('study.distributionUnit');

    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.completeContainer}>
          <Text style={styles.completeEmoji}>🎉</Text>
          <Text style={styles.completeTitle}>{t('study.sessionComplete')}</Text>

          {/* 学習完了枚数 + 所要時間 */}
          <View style={styles.completeSummaryRow}>
            <Text style={styles.completeSummaryMain}>
              {t('study.completedCount', { count: summary.completedCount })}
            </Text>
            <Text style={styles.completeSummaryDuration}>
              {t('study.sessionDuration')}: {(() => {
                const min = Math.floor(summary.durationSeconds / 60);
                const sec = summary.durationSeconds % 60;
                return t('study.sessionDurationValue', { min, sec: String(sec).padStart(2, '0') });
              })()}
            </Text>
          </View>

          {/* 次回復習予定の分布 */}
          <View style={styles.distributionCard}>
            <Text style={styles.distributionTitle}>{t('study.nextReviewSchedule')}</Text>
            {REVIEW_BUCKET_ORDER.map((bucket) => {
              const count = summary.reviewDistribution[bucket];
              if (count === 0) return null;
              const maxCount = Math.max(...Object.values(summary.reviewDistribution));
              const barWidth = maxCount > 0 ? `${Math.round((count / maxCount) * 100)}%` : '0%';
              return (
                <View key={bucket} style={styles.distributionRow}>
                  <Text style={styles.distributionLabel}>{bucketLabels[bucket]}</Text>
                  <View style={styles.distributionBarWrapper}>
                    <View style={[styles.distributionBar, { width: barWidth as `${number}%` }]} />
                  </View>
                  <Text style={styles.distributionCount}>{count}{unit}</Text>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── カードなし ────────────────────────────────────────────────────────────

  if (progressTotal === 0) {
    return (
      <SafeAreaView style={styles.safe}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <View style={styles.center}>
          <Text style={styles.noCardsText}>{t('study.noCards')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── 学習メイン ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
          </View>
          {/* 分子 = graduated 済み枚数 / 分母 = セッション総枚数 */}
          <Text style={styles.progressText}>{progressCompleted}/{progressTotal}</Text>
        </View>
        {deck?.dailyLimit != null && (
          <Text style={styles.limitBadge}>🎯 {deck.dailyLimit}</Text>
        )}
      </View>

      {/* タップ可能エリア（答え未表示時のみ反応）*/}
      <Pressable
        style={styles.tapArea}
        onPress={() => { if (!isFlipped) flipCard(); }}
      >
        <View style={styles.cardBody}>
          {sessionMessage && (
            <View style={styles.motivationOverlay} pointerEvents="none">
              <MotivationBanner message={sessionMessage} />
            </View>
          )}
          {currentCard && (
            <FlashCard
              card={currentCard}
              isRevealed={isFlipped}
              onReveal={flipCard}
              frontSpeechLang={deck?.frontSpeechLang}
              backSpeechLang={deck?.backSpeechLang}
            />
          )}
        </View>
      </Pressable>

      {/* 難易度ボタン（答え表示後のみ）*/}
      {isFlipped ? (
        <View style={{ paddingBottom: insets.bottom }}>
          <DifficultyButtons
            estimates={estimates}
            onAnswer={handleAnswer}
            disabled={isAnswering}
          />
        </View>
      ) : (
        <View style={{ height: Math.max(insets.bottom, 16) }} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#94A3B8', fontSize: 14 },

  // ── ヘッダー ───────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backButton: { padding: 4 },
  backText: { color: '#4F46E5', fontSize: 14 },
  progressContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  progressTrack: {
    flex: 1, height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#4F46E5', borderRadius: 3 },
  progressText: { fontSize: 12, color: '#64748B', minWidth: 36, textAlign: 'right' },
  limitBadge: { fontSize: 11, color: '#94A3B8', marginLeft: 4 },

  // ── カードエリア ───────────────────────────────────────────────────────────
  tapArea: {
    flex: 1,
    cursor: 'pointer',
  } as object,
  cardBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: MOTIVATION_BANNER_HEIGHT,
    paddingBottom: 8,
  },
  motivationOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: MOTIVATION_BANNER_HEIGHT,
    zIndex: 100,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },

  // ── カードなし ─────────────────────────────────────────────────────────────
  noCardsText: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },

  // ── セッション完了 ─────────────────────────────────────────────────────────
  completeContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 20, paddingHorizontal: 32, paddingVertical: 24,
  },
  completeEmoji: { fontSize: 60 },
  completeTitle: { fontSize: 22, fontWeight: '700', color: '#1E293B' },

  completeSummaryRow: { alignItems: 'center', gap: 4 },
  completeSummaryMain: { fontSize: 20, fontWeight: '700', color: '#4F46E5' },
  completeSummaryDuration: { fontSize: 13, color: '#94A3B8' },

  distributionCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    // shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  distributionTitle: {
    fontSize: 13, fontWeight: '600', color: '#64748B',
    marginBottom: 4,
  },
  distributionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  distributionLabel: {
    fontSize: 13, color: '#475569', width: 72,
  },
  distributionBarWrapper: {
    flex: 1, height: 8, backgroundColor: '#F1F5F9',
    borderRadius: 4, overflow: 'hidden',
  },
  distributionBar: {
    height: '100%', backgroundColor: '#818CF8', borderRadius: 4,
  },
  distributionCount: {
    fontSize: 13, fontWeight: '600', color: '#4F46E5', minWidth: 28, textAlign: 'right',
  },

  doneButton: {
    backgroundColor: '#4F46E5', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 48,
  },
  doneButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
