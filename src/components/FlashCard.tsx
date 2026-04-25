import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming
} from 'react-native-reanimated';
import type { Card } from '../types';
import { CardFormBadge } from './CardTypeBadge';
import { SpeechButton } from './SpeechButton';
import { useTranslation } from 'react-i18next';
import {
  getSceneCategoryById,
  getSceneSubcategoryById,
} from '../utils/sceneCategories';

interface FlashCardProps {
  card: Card;
  isRevealed: boolean;
  onReveal: () => void;
  sourceLang: string;
  targetLang: string;
  /** 穴埋めカード裏面（答え）の読み上げ言語。未指定時は targetLang を使用 */
  clozeAnswerLang?: string;
}

/**
 * ___（アンダースコア3つ）を穴埋めボックスとして描画するコンポーネント
 */
const TextWithBlanks: React.FC<{ text: string; style?: object }> = ({ text, style }) => {
  const parts = text.split('___');
  if (parts.length === 1) return <Text style={style}>{text}</Text>;
  return (
    <Text style={style}>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <Text style={styles.blankBox}>{'________'}</Text>
          )}
        </React.Fragment>
      ))}
    </Text>
  );
};

/** フラッシュカードUI（タップで答えをエクスパンド表示）*/
export const FlashCard: React.FC<FlashCardProps> = ({
  card,
  isRevealed,
  onReveal,
  sourceLang,
  targetLang,
  clozeAnswerLang,
}) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ja' | 'en';

  // 裏面エクスパンドアニメーション
  const revealOpacity = useSharedValue(0);
  const revealTranslateY = useSharedValue(8);

  useEffect(() => {
    if (isRevealed) {
      revealOpacity.value = withTiming(1, { duration: 250 });
      revealTranslateY.value = withTiming(0, { duration: 250 });
    } else {
      // 即座にリセット（次のカードへの遷移時）
      revealOpacity.value = 0;
      revealTranslateY.value = 8;
    }
  }, [isRevealed]);

  const revealAnimStyle = useAnimatedStyle(() => ({
    opacity: revealOpacity.value,
    transform: [{ translateY: revealTranslateY.value }],
  }));

  // CEFR レベル
  const frontLevel = card.extraInfo?.wordLevel ?? card.extraInfo?.sentenceLevel;
  const wordLevel = card.extraInfo?.wordLevel;
  const sentenceLevel = card.extraInfo?.sentenceLevel;

  // シーンバッジ
  const sceneCategoryId = card.extraInfo?.sceneCategoryId;
  const sceneSubcategoryId = card.extraInfo?.sceneSubcategoryId;
  const sceneCategory = sceneCategoryId ? getSceneCategoryById(sceneCategoryId) : undefined;
  const sceneSubcategory =
    sceneCategoryId && sceneSubcategoryId
      ? getSceneSubcategoryById(sceneCategoryId, sceneSubcategoryId)
      : undefined;
  const sceneBadgeLabel = sceneCategory
    ? sceneSubcategory
      ? `${sceneCategory.label[lang]} > ${sceneSubcategory.label[lang]}`
      : sceneCategory.label[lang]
    : null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => !isRevealed && onReveal()}
      activeOpacity={isRevealed ? 1 : 0.85}
    >
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.cardContent}>
        {/* 表面：常に表示（学習言語テキスト）*/}
        <View style={styles.badgeRow}>
          <CardFormBadge cardForm={card.cardForm} />
          {frontLevel && <Text style={styles.levelBadge}>{frontLevel}</Text>}
          {sceneBadgeLabel && (
            <Text style={styles.sceneBadge}>{sceneBadgeLabel}</Text>
          )}
        </View>
        <View style={styles.textRow}>
          <TextWithBlanks text={card.backText} style={styles.mainText} />
          <SpeechButton text={card.backText} lang={targetLang} />
        </View>

        {/* タップヒント（未表示時のみ）*/}
        {!isRevealed && (
          <Text style={styles.hint}>{t('study.tapToReveal')}</Text>
        )}

        {/* 裏面：アニメーションで展開表示 */}
        <Animated.View style={revealAnimStyle}>
          {isRevealed && (
            <>
              <View style={styles.divider} />
              {/* 裏面メインテキスト（母語 or 答え）*/}
              <View style={styles.textRow}>
                <Text style={styles.answerText}>{card.frontText}</Text>
                <SpeechButton
                  text={card.frontText}
                  lang={card.cardForm === 'translation' ? sourceLang : (clozeAnswerLang ?? targetLang)}
                />
              </View>
              {/* 裏面レベルバッジ */}
              <View style={styles.badgeRow}>
                {wordLevel && (
                  <Text style={styles.levelBadge}>単語 {wordLevel}</Text>
                )}
                {sentenceLevel && (
                  <Text style={[styles.levelBadge, styles.sentenceLevelBadge]}>文 {sentenceLevel}</Text>
                )}
                {!wordLevel && !sentenceLevel && frontLevel && (
                  <Text style={styles.levelBadge}>{frontLevel}</Text>
                )}
              </View>
              {/* 補足情報 */}
              {card.extraInfo?.partOfSpeech && (
                <Text style={styles.meta}>品詞: {card.extraInfo.partOfSpeech}</Text>
              )}
              {card.extraInfo?.pronunciation && (
                <Text style={styles.meta}>発音: {card.extraInfo.pronunciation}</Text>
              )}
              {card.extraInfo?.exampleSentence && (
                <View style={styles.exampleRow}>
                  <Text style={styles.exampleLabel}>例文:</Text>
                  <Text style={styles.example}>{card.extraInfo.exampleSentence}</Text>
                </View>
              )}
              {card.extraInfo?.collocations && card.extraInfo.collocations.length > 0 && (
                <View style={styles.exampleRow}>
                  <Text style={styles.exampleLabel}>コロケーション:</Text>
                  <Text style={styles.example}>{card.extraInfo.collocations.join(' / ')}</Text>
                </View>
              )}
              {card.extraInfo?.contextNote && (
                <View style={styles.meaningBox}>
                  <Text style={styles.meaningLabel}>{t('study.meaningLabel')}</Text>
                  <Text style={styles.meaningText}>{card.extraInfo.contextNote}</Text>
                </View>
              )}
              {card.memo && (
                <View style={styles.memoBox}>
                  <Text style={styles.memoLabel}>{t('study.memoLabel')}</Text>
                  <Text style={styles.memoText}>{card.memo}</Text>
                </View>
              )}
              {card.extraInfo?.verb && (
                <VerbInfo verb={card.extraInfo.verb} />
              )}
              {card.extraInfo?.noun && card.extraInfo.noun.gender && (
                <Text style={styles.meta}>
                  性: {card.extraInfo.noun.gender}
                  {card.extraInfo.noun.plural ? ` / 複数: ${card.extraInfo.noun.plural}` : ''}
                </Text>
              )}
            </>
          )}
        </Animated.View>
      </ScrollView>
    </TouchableOpacity>
  );
};

/** 動詞活用情報 */
const VerbInfo: React.FC<{ verb: NonNullable<Card['extraInfo']>['verb'] }> = ({ verb }) => {
  if (!verb) return null;
  return (
    <View style={styles.verbContainer}>
      {verb.pastTense && <Text style={styles.meta}>過去形: {verb.pastTense}</Text>}
      {verb.pastParticiple && <Text style={styles.meta}>過去分詞: {verb.pastParticiple}</Text>}
      {verb.irregular && <Text style={[styles.meta, { color: '#EF4444' }]}>不規則動詞</Text>}
      {verb.conjugation && Object.keys(verb.conjugation).length > 0 && (
        <View>
          {Object.entries(verb.conjugation).map(([person, form]) => (
            <Text key={person} style={styles.conjugation}>{person}: {form}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minHeight: 160,
  },
  scrollArea: {
    borderRadius: 16,
  },
  cardContent: {
    padding: 20,
    gap: 10,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  levelBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sentenceLevelBadge: {
    color: '#0891B2',
    backgroundColor: '#ECFEFF',
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  mainText: {
    fontSize: 26,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  answerText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#4F46E5',
    textAlign: 'center',
  },
  blankBox: {
    color: '#4F46E5',
    fontWeight: '700',
    textDecorationLine: 'underline',
    letterSpacing: 2,
  },
  hint: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 12,
  },
  meta: {
    fontSize: 13,
    color: '#64748B',
  },
  exampleRow: {
    gap: 2,
  },
  exampleLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
  },
  example: {
    fontSize: 13,
    color: '#475569',
    fontStyle: 'italic',
  },
  meaningBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  meaningLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#D97706',
  },
  meaningText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  memoBox: {
    backgroundColor: '#F0FDF4',
    borderRadius: 8,
    padding: 8,
    gap: 2,
  },
  memoLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
  },
  memoText: {
    fontSize: 13,
    color: '#14532D',
    lineHeight: 18,
  },
  sceneBadge: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7C3AED',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  verbContainer: {
    gap: 2,
  },
  conjugation: {
    fontSize: 12,
    color: '#64748B',
    paddingLeft: 8,
  },
});
