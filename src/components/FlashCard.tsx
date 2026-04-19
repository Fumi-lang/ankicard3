import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ScrollView
} from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, interpolate, Extrapolation
} from 'react-native-reanimated';
import type { Card } from '../types';
import { CardTypeBadge } from './CardTypeBadge';
import { SpeechButton } from './SpeechButton';
import { useTranslation } from 'react-i18next';

interface FlashCardProps {
  card: Card;
  isFlipped: boolean;
  onFlip: () => void;
  sourceLang: string;
  targetLang: string;
}

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

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => !isFlipped && onFlip()}
      activeOpacity={isFlipped ? 1 : 0.85}
    >
      {/* 表面：学習言語（backText = targetLang のテキスト）を表示 */}
      <Animated.View style={[styles.card, styles.front, frontStyle]}>
        <View style={styles.cardContent}>
          <CardTypeBadge cardType={card.cardType} />
          <View style={styles.textRow}>
            <Text style={styles.mainText}>{card.backText}</Text>
            <SpeechButton text={card.backText} lang={targetLang} />
          </View>
          <Text style={styles.hint}>{t('study.tapToReveal')}</Text>
        </View>
      </Animated.View>

      {/* 裏面：母語（frontText = sourceLang のテキスト）を表示 */}
      <Animated.View style={[styles.card, styles.back, backStyle]}>
        <ScrollView style={styles.scrollArea} contentContainerStyle={styles.cardContent}>
          <CardTypeBadge cardType={card.cardType} />
          <View style={styles.textRow}>
            <Text style={styles.mainText}>{card.frontText}</Text>
            <SpeechButton text={card.frontText} lang={sourceLang} />
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
  front: {
    zIndex: 1,
  },
  back: {
    zIndex: 0,
  },
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
