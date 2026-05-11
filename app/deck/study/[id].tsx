import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  TextInput, Modal, Switch, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useStudySession } from '../../../src/hooks/useStudySession';
import { useSpacedRepetition } from '../../../src/hooks/useSpacedRepetition';
import { useMotivation } from '../../../src/hooks/useMotivation';
import { useSettingsStore } from '../../../src/stores/settingsStore';
import { useCardStore } from '../../../src/stores/cardStore';
import { useTagStore } from '../../../src/stores/tagStore';
import { getDeckById } from '../../../src/services/database';
import { FlashCard } from '../../../src/components/FlashCard';
import { DifficultyButtons } from '../../../src/components/DifficultyButtons';
import { MotivationBanner } from '../../../src/components/MotivationBanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { REVIEW_BUCKET_ORDER, type ReviewBucket } from '../../../src/services/sessionUtils';
import { getTagDisplayName } from '../../../src/utils/tagDisplay';
import type { Card, Deck, StudyQuality } from '../../../src/types';

/** 応援バナー領域の高さ（常にこの分の空間を確保する）*/
const MOTIVATION_BANNER_HEIGHT = 56;

/** 学習セッション画面 */
export default function StudyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ja' | 'en';
  const { autoPlaySpeech, appLanguage } = useSettingsStore();

  const {
    currentCard, isFlipped, isComplete, isLoading,
    progressCompleted, progressTotal,
    consecutiveGraduated,
    summary,
    loadCards, flipCard, answerCard,
  } = useStudySession();

  const { updateCard } = useCardStore();
  const { getTagsByIds, ensureTagIds, sortedTagNames } = useTagStore();

  const { getEstimates } = useSpacedRepetition();
  const { getSessionMessage } = useMotivation();

  const insets = useSafeAreaInsets();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  // ボタン二重タップ防止
  const [isAnswering, setIsAnswering] = useState(false);

  // ── テキスト入力回答 ──────────────────────────────────────────────────────
  /** ユーザーが入力した回答テキスト */
  const [textAnswer, setTextAnswer] = useState('');

  // ── カード編集（学習画面から）────────────────────────────────────────────
  /** 学習画面上で編集したカードのオーバーライドマップ（表示反映用）*/
  const [editedCards, setEditedCards] = useState<Record<string, Card>>({});
  const [studyEditingCard, setStudyEditingCard] = useState<Card | null>(null);
  const [studyEditFront, setStudyEditFront] = useState('');
  const [studyEditBack, setStudyEditBack] = useState('');
  const [studyEditMemo, setStudyEditMemo] = useState('');
  const [studyEditTags, setStudyEditTags] = useState<string[]>([]);
  const [studyEditTagInput, setStudyEditTagInput] = useState('');
  const [studyEditTextInput, setStudyEditTextInput] = useState(false);
  const [studyEditSaving, setStudyEditSaving] = useState(false);

  // ── 表示カード（編集オーバーライドを優先）────────────────────────────────
  const displayCard = currentCard
    ? (editedCards[currentCard.id] ?? currentCard)
    : null;

  // カードが変わったらテキスト入力欄をクリア
  useEffect(() => {
    setTextAnswer('');
  }, [currentCard?.id]);

  useEffect(() => {
    const deckId = id === 'all' ? undefined : id;
    if (id && id !== 'all') {
      getDeckById(id).then((d) => {
        setDeck(d ?? null);
        loadCards(deckId, d ?? undefined);
      });
    } else {
      loadCards(deckId);
    }
  }, [id]);

  useEffect(() => {
    const msg = getSessionMessage({ consecutiveCorrect: consecutiveGraduated });
    if (msg) {
      setSessionMessage(msg);
      setTimeout(() => setSessionMessage(null), 3500);
    }
  }, [consecutiveGraduated]);

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

  const progressRatio = progressTotal > 0 ? progressCompleted / progressTotal : 0;

  // テキスト入力モードかどうか
  const useTextInput = displayCard?.textInputAnswer === true;

  // ── カード編集 ─────────────────────────────────────────────────────────────
  const handleOpenStudyEdit = (card: Card) => {
    const target = editedCards[card.id] ?? card;
    setStudyEditingCard(target);
    setStudyEditFront(target.frontText);
    setStudyEditBack(target.backText);
    setStudyEditMemo(target.memo ?? '');
    setStudyEditTags(getTagsByIds(target.tagIds ?? []).map((t) => t.name));
    setStudyEditTagInput('');
    setStudyEditTextInput(target.textInputAnswer ?? false);
  };

  const handleSaveStudyEdit = async () => {
    if (!studyEditingCard) return;
    setStudyEditSaving(true);
    try {
      const tagIds = studyEditTags.length > 0 ? await ensureTagIds(studyEditTags) : undefined;
      const updated: Card = {
        ...studyEditingCard,
        frontText: studyEditFront.trim(),
        backText:  studyEditBack.trim(),
        memo:      studyEditMemo.trim() || undefined,
        tagIds,
        textInputAnswer: studyEditTextInput,
        updatedAt: new Date().toISOString(),
      };
      await updateCard(updated);
      // 学習画面の表示をオーバーライドで即時反映
      setEditedCards((prev) => ({ ...prev, [updated.id]: updated }));
      setStudyEditingCard(null);
    } finally {
      setStudyEditSaving(false);
    }
  };

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
          <Text style={styles.progressText}>{progressCompleted}/{progressTotal}</Text>
        </View>
        {deck?.dailyLimit != null && (
          <Text style={styles.limitBadge}>🎯 {deck.dailyLimit}</Text>
        )}
      </View>

      {/* タップ可能エリア: テキスト入力モードではタップでのフリップを無効化 */}
      <Pressable
        style={styles.tapArea}
        onPress={() => { if (!isFlipped && !useTextInput) flipCard(); }}
      >
        <View style={styles.cardBody}>
          {sessionMessage && (
            <View style={styles.motivationOverlay} pointerEvents="none">
              <MotivationBanner message={sessionMessage} />
            </View>
          )}
          {displayCard && (
            <>
              {/* 編集ボタン（カード右上隅に絶対配置）*/}
              <TouchableOpacity
                style={styles.editCardBtn}
                onPress={() => handleOpenStudyEdit(displayCard)}
              >
                <Text style={styles.editCardBtnText}>✏️</Text>
              </TouchableOpacity>

              <FlashCard
                card={displayCard}
                isRevealed={isFlipped}
                onReveal={useTextInput ? () => {} : flipCard}
                frontSpeechLang={deck?.frontSpeechLang}
                backSpeechLang={deck?.backSpeechLang}
                hideHint={useTextInput}
              />

              {/* テキスト入力欄（textInputAnswer モード時）*/}
              {useTextInput && (
                <View style={styles.textAnswerBlock}>
                  {isFlipped && textAnswer.trim() !== '' && (
                    <Text style={styles.yourAnswerLabel}>{t('study.yourAnswer')}</Text>
                  )}
                  <TextInput
                    style={styles.textAnswerInput}
                    value={textAnswer}
                    onChangeText={setTextAnswer}
                    placeholder={t('study.typeAnswer')}
                    placeholderTextColor="#94A3B8"
                    editable={!isFlipped}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              )}
            </>
          )}
        </View>
      </Pressable>

      {/* 「答えを見る」ボタン（テキスト入力モード・未フリップ時）*/}
      {useTextInput && !isFlipped && (
        <View style={styles.showAnswerArea}>
          <TouchableOpacity style={styles.showAnswerButton} onPress={flipCard}>
            <Text style={styles.showAnswerButtonText}>{t('study.showAnswer')}</Text>
          </TouchableOpacity>
        </View>
      )}

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

      {/* ── カード編集モーダル ─────────────────────────────────────────────── */}
      <Modal visible={studyEditingCard !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.modalScroll}
            contentContainerStyle={styles.modalScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>{t('card.edit')}</Text>

            <Text style={styles.modalLabel}>{t('card.backTranslation')}</Text>
            <TextInput
              style={styles.modalInput}
              value={studyEditBack}
              onChangeText={setStudyEditBack}
              multiline
            />

            <Text style={styles.modalLabel}>{t('card.frontTranslation')}</Text>
            <TextInput
              style={styles.modalInput}
              value={studyEditFront}
              onChangeText={setStudyEditFront}
              multiline
            />

            <Text style={styles.modalLabel}>{t('card.memo')}</Text>
            <TextInput
              style={[styles.modalInput, styles.memoInput]}
              value={studyEditMemo}
              onChangeText={setStudyEditMemo}
              multiline
              placeholder={t('card.memoPlaceholder')}
              placeholderTextColor="#CBD5E1"
            />

            <Text style={styles.modalLabel}>{t('card.tags')}</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                value={studyEditTagInput}
                onChangeText={setStudyEditTagInput}
                placeholder={t('card.tagsPlaceholder')}
                placeholderTextColor="#CBD5E1"
                onSubmitEditing={() => {
                  const trimmed = studyEditTagInput.trim();
                  if (trimmed && !studyEditTags.includes(trimmed)) {
                    setStudyEditTags([...studyEditTags, trimmed]);
                  }
                  setStudyEditTagInput('');
                }}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.tagAddButton}
                onPress={() => {
                  const trimmed = studyEditTagInput.trim();
                  if (trimmed && !studyEditTags.includes(trimmed)) {
                    setStudyEditTags([...studyEditTags, trimmed]);
                  }
                  setStudyEditTagInput('');
                }}
              >
                <Text style={styles.tagAddButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            {(() => {
              const presetTags = sortedTagNames().filter((t2) => !studyEditTags.includes(t2));
              if (studyEditTags.length === 0 && presetTags.length === 0) return null;
              return (
                <View style={styles.tagChips}>
                  {studyEditTags.map((tag) => (
                    <TouchableOpacity
                      key={`set-${tag}`}
                      style={styles.tagChip}
                      onPress={() => setStudyEditTags(studyEditTags.filter((t2) => t2 !== tag))}
                    >
                      <Text style={styles.tagChipText}>
                        {getTagDisplayName(tag, appLanguage)} ×
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {presetTags.map((tag) => (
                    <TouchableOpacity
                      key={`preset-${tag}`}
                      style={styles.tagPresetChip}
                      onPress={() => setStudyEditTags([...studyEditTags, tag])}
                    >
                      <Text style={styles.tagPresetChipText}>
                        {getTagDisplayName(tag, appLanguage)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}

            {/* テキスト入力回答トグル */}
            <View style={styles.toggleRow}>
              <Text style={styles.modalLabel}>{t('card.textInputAnswer')}</Text>
              <Switch
                value={studyEditTextInput}
                onValueChange={setStudyEditTextInput}
                trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                thumbColor={studyEditTextInput ? '#4F46E5' : '#FFFFFF'}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setStudyEditingCard(null)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, studyEditSaving && styles.disabled]}
                onPress={handleSaveStudyEdit}
                disabled={studyEditSaving}
              >
                <Text style={styles.modalSaveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
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

  // ── 編集ボタン（右上絶対配置）─────────────────────────────────────────────
  editCardBtn: {
    position: 'absolute',
    top: MOTIVATION_BANNER_HEIGHT + 8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  editCardBtnText: { fontSize: 16 },

  // ── テキスト入力回答 ───────────────────────────────────────────────────────
  textAnswerBlock: {
    marginTop: 12,
    gap: 6,
  },
  yourAnswerLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  textAnswerInput: {
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: '#1E293B',
    backgroundColor: '#FFFFFF',
    minHeight: 104, // 約4行分（行高 ~25px + padding）
    textAlignVertical: 'top',
  },
  showAnswerArea: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    alignItems: 'center',
  },
  showAnswerButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  showAnswerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  distributionTitle: { fontSize: 13, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  distributionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  distributionLabel: { fontSize: 13, color: '#475569', width: 72 },
  distributionBarWrapper: {
    flex: 1, height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden',
  },
  distributionBar: { height: '100%', backgroundColor: '#818CF8', borderRadius: 4 },
  distributionCount: { fontSize: 13, fontWeight: '600', color: '#4F46E5', minWidth: 28, textAlign: 'right' },
  doneButton: {
    backgroundColor: '#4F46E5', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 48,
  },
  doneButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  // ── 編集モーダル ───────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalScroll: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  modalScrollContent: { padding: 24, gap: 10, paddingBottom: 32 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  modalLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  modalInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    padding: 10, fontSize: 14, color: '#1E293B', backgroundColor: '#FFFFFF',
  },
  memoInput: { minHeight: 70, textAlignVertical: 'top' },
  tagInputRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  tagAddButton: {
    backgroundColor: '#4F46E5', borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
  },
  tagAddButtonText: { color: '#FFFFFF', fontSize: 18, lineHeight: 20 },
  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    backgroundColor: '#EEF2FF', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  tagChipText: { fontSize: 12, color: '#4F46E5', fontWeight: '500' },
  tagPresetChip: {
    backgroundColor: 'transparent', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#CBD5E1',
  },
  tagPresetChipText: { fontSize: 12, color: '#64748B' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  modalCancelText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  modalSaveBtn: {
    flex: 1, backgroundColor: '#4F46E5', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  modalSaveText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  disabled: { opacity: 0.5 },
});
