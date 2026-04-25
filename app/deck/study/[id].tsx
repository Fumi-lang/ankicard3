import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Pressable
} from 'react-native';
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
    correctCount, incorrectCount, consecutiveCorrect,
    cards, currentIndex, loadCards, flipCard, answerCard,
  } = useStudySession();

  const { getEstimates } = useSpacedRepetition();
  const { getSessionMessage } = useMotivation();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  // ボタン二重タップ防止
  const [isAnswering, setIsAnswering] = useState(false);

  useEffect(() => {
    const deckId = id === 'all' ? undefined : id;
    loadCards(deckId);
    if (id && id !== 'all') {
      getDeckById(id).then((d) => {
        setDeck(d ?? null);
      });
    }
  }, [id]);

  useEffect(() => {
    // モチベーションメッセージを更新
    const msg = getSessionMessage({ consecutiveCorrect });
    if (msg) {
      setSessionMessage(msg);
      setTimeout(() => setSessionMessage(null), 3500);
    }
  }, [consecutiveCorrect]);

  const handleAnswer = async (quality: StudyQuality) => {
    if (isAnswering) return;
    setIsAnswering(true);
    await answerCard(quality);
    // バイブレーション（モバイルブラウザのみ）
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(quality === 'again' ? 100 : 30);
    }
    setIsAnswering(false);
  };

  const estimates = currentCard ? getEstimates(currentCard, lang) : {
    again: '<1分', hard: '<10分', good: '1日', easy: '4日',
  };

  const progress = cards.length > 0 ? currentIndex / cards.length : 0;

  const clozeAnswerLangValue =
    deck?.extraSettings?.clozeAnswerSpeechLang === 'source'
      ? (deck?.sourceLang ?? 'ja')
      : (deck?.targetLang ?? 'en');

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.completeContainer}>
          <Text style={styles.completeEmoji}>🎉</Text>
          <Text style={styles.completeTitle}>{t('study.sessionComplete')}</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{correctCount}</Text>
              <Text style={styles.statLabel}>{t('study.correct')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, { color: '#EF4444' }]}>{incorrectCount}</Text>
              <Text style={styles.statLabel}>{t('study.incorrect')}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
            <Text style={styles.doneButtonText}>{t('common.done')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (cards.length === 0) {
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

  return (
    <SafeAreaView style={styles.safe}>
      {/* ヘッダー（タップ範囲外）*/}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{currentIndex + 1}/{cards.length}</Text>
        </View>
      </View>

      {/* タップ可能エリア（カード外の余白も含む・答え未表示時のみ反応）*/}
      <Pressable
        style={styles.tapArea}
        onPress={() => { if (!isFlipped) flipCard(); }}
      >
        {/* バナー領域を常に確保（固定 paddingTop）+ バナーを絶対配置でオーバーレイ */}
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
              sourceLang={deck?.sourceLang ?? 'ja'}
              targetLang={deck?.targetLang ?? 'en'}
              clozeAnswerLang={clozeAnswerLangValue}
            />
          )}
        </View>
      </Pressable>

      {/* 難易度ボタン（タップ範囲外・答え表示後のみ）*/}
      {isFlipped ? (
        <DifficultyButtons
          estimates={estimates}
          onAnswer={handleAnswer}
          disabled={isAnswering}
        />
      ) : (
        <View style={styles.flipHint} />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#94A3B8', fontSize: 14 },
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
  tapArea: {
    flex: 1,
    // Web: カード未表示時にカーソルをポインターに
    cursor: 'pointer',
  } as object,
  cardBody: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: MOTIVATION_BANNER_HEIGHT,  // バナー領域を常に確保
    paddingBottom: 8,
  },
  motivationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: MOTIVATION_BANNER_HEIGHT,
    zIndex: 100,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  flipHint: { height: 16 },
  completeContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32,
  },
  completeEmoji: { fontSize: 60 },
  completeTitle: { fontSize: 22, fontWeight: '700', color: '#1E293B' },
  statsRow: { flexDirection: 'row', gap: 40 },
  statItem: { alignItems: 'center', gap: 4 },
  statNumber: { fontSize: 36, fontWeight: '700', color: '#10B981' },
  statLabel: { fontSize: 13, color: '#64748B' },
  doneButton: {
    backgroundColor: '#4F46E5', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 48,
  },
  doneButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  noCardsText: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },
});
