import React, { useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation
} from 'react-native-reanimated';
import type { Card } from '../types';
import { CardFormBadge } from './CardTypeBadge';
import { SpeechButton } from './SpeechButton';
import { useTranslation } from 'react-i18next';

interface FlashCardProps {
  card: Card;
  isFlipped: boolean;
  onFlip: () => void;
  sourceLang: string;
  targetLang: string;
}

/**
 * ___（アンダースコア3つ）を穴埋めボックスとして描画するコンポーネント
 * React Native では <Text> の入れ子でインラインスタイルを実現する
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

/** フラッシュカードUI（3Dフリップアニメーション付き）*/
export const FlashCard: React.FC<FlashCardProps> = ({
  card,
  isFlipped,
  onFlip,
  sourceLang,
  targetLang,
}) => {
  const { t } = useTranslation();
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(isFlipped ? 180 : 0, { duration: 400 });
  }, [isFlipped]);

  // 表面のアニメーションスタイル
  const frontStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [0, 180], Extrapolation.CLAMP);
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  // 裏面のアニメーションスタイル
  const backStyle = useAnimatedStyle(() => {
    const rotateY = interpolate(rotation.value, [0, 180], [180, 360], Extrapolation.CLAMP);
    return {
      transform: [{ rotateY: `${rotateY}deg` }],
      backfaceVisibility: 'hidden',
    };
  });

  // CEFR レベル
  // 表面: wordLevel を優先表示（穴埋めカードでは暗記対象単語のレベルが最重要）
  const frontLevel = card.extraInfo?.wordLevel ?? card.extraInfo?.sentenceLevel;
  const wordLevel = card.extraInfo?.wordLevel;
  const sentenceLevel = card.extraInfo?.sentenceLevel;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => !isFlipped && onFlip()}
      activeOpacity={isFlipped ? 1 : 0.85}
    >
      {/* 表面：学習言語（backText = targetLang のテキスト）を表示 */}
      <Animated.View style={[styles.card, styles.front, frontStyle]}>
        <View style={styles.cardContent}>
          <View style={styles.badgeRow}>
            <CardFormBadge cardForm={card.cardForm} />
            {frontLevel && <Text style={styles.levelBadge}>{frontLevel}</Text>}
          </View>
          <View style={styles.textRow}>
            <TextWithBlanks text={card.backText} style={styles.mainText} />
            <SpeechButton text={card.backText} lang={targetLang} />
          </View>
          <Text style={styles.hint}>{t('study.tapToReveal')}</Text>
        </View>
      </Animated.View>

      {/* 裏面：母語 or 答え（frontText = sourceLang のテキスト）を表示 */}
      <Animated.View style={[styles.card, styles.back, backStyle]}>
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.cardContent}>
          <View style={styles.badgeRow}>
            <CardFormBadge cardForm={card.cardForm} />
            {/* 裏面では wordLevel と sentenceLevel を両方表示 */}
            {wordLevel && (
              <Text style={styles.levelBadge}>単語 {wordLevel}</Text>
            )}
            {sentenceLevel && (
              <Text style={[styles.levelBadge, styles.sentenceLevelBadge]}>文 {sentenceLevel}</Text>
            )}
            {/* どちらも存在しない場合（翻訳カードで単一レベルのみ）*/}
            {!wordLevel && !sentenceLevel && frontLevel && (
              <Text style={styles.levelBadge}>{frontLevel}</Text>
            )}
          </View>
          <View style={styles.textRow}>
            <Text style={styles.mainText}>{card.frontText}</Text>
            {card.cardForm === 'translation' && (
              <SpeechButton text={card.frontText} lang={sourceLang} />
            )}
          </View>
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
            <Text style={styles.contextNote}>{card.extraInfo.contextNote}</Text>
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
        </ScrollView>
      </Animated.View>
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
    aspectRatio: 1.6,
    position: 'relative',
  },
  card: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  front: { zIndex: 1 },
  back: { zIndex: 0 },
  scrollArea: {
    flex: 1,
    borderRadius: 16,
  },
  cardContent: {
    padding: 20,
    gap: 12,
    minHeight: '100%',
    justifyContent: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    marginTop: 8,
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
  contextNote: {
    fontSize: 12,
    color: '#64748B',
    backgroundColor: '#F8FAFC',
    padding: 8,
    borderRadius: 6,
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
