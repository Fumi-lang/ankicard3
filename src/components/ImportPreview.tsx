import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ImportedCardData } from '../types';
import { SpeechButton } from './SpeechButton';

/** 最初に表示するカード数 */
const INITIAL_VISIBLE = 20;

interface ImportPreviewProps {
  cards: ImportedCardData[];
  targetLang: string;
  sourceLang: string;
}

/** インポートプレビュー（解析結果の確認UI）*/
export const ImportPreview: React.FC<ImportPreviewProps> = ({ cards, targetLang, sourceLang }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ja' | 'en';
  const [showAll, setShowAll] = useState(false);

  const validCards = cards.filter((c) => c.isValid);
  const errorCards = cards.filter((c) => !c.isValid);

  const visibleCards = showAll ? validCards : validCards.slice(0, INITIAL_VISIBLE);
  const remainingCount = validCards.length - INITIAL_VISIBLE;
  const hasMore = validCards.length > INITIAL_VISIBLE;

  const showAllLabel  = lang === 'en' ? `Show all (${validCards.length})` : `すべて表示 (${validCards.length}件)`;
  const collapseLabel = lang === 'en' ? 'Collapse' : '折りたたむ';

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {t('import.valid')}: {validCards.length} / {t('import.errors')}: {errorCards.length}
        </Text>
      </View>

      {visibleCards.map((item, i) => (
        <View key={i} style={styles.cardRow}>
          <View style={styles.textContainer}>
            <View style={styles.textRow}>
              <Text style={styles.front} numberOfLines={2}>{item.frontText}</Text>
              <SpeechButton text={item.frontText} lang={sourceLang} size="small" />
            </View>
            <View style={styles.textRow}>
              <Text style={styles.back} numberOfLines={2}>{item.backText}</Text>
              <SpeechButton text={item.backText} lang={targetLang} size="small" />
            </View>
          </View>
        </View>
      ))}

      {hasMore && !showAll && (
        <View style={styles.moreBlock}>
          <Text style={styles.moreText}>
            {lang === 'en' ? `...and ${remainingCount} more` : `...他 ${remainingCount} 件`}
          </Text>
          <TouchableOpacity style={styles.showAllButton} onPress={() => setShowAll(true)}>
            <Text style={styles.showAllButtonText}>{showAllLabel}</Text>
          </TouchableOpacity>
        </View>
      )}

      {showAll && hasMore && (
        <TouchableOpacity style={styles.collapseButton} onPress={() => setShowAll(false)}>
          <Text style={styles.collapseButtonText}>{collapseLabel}</Text>
        </TouchableOpacity>
      )}

      {errorCards.length > 0 && (
        <View style={styles.errorSection}>
          <Text style={styles.errorTitle}>⚠️ 一部情報が取得できませんでした</Text>
          {errorCards.slice(0, 3).map((c, i) => (
            <Text key={i} style={styles.errorText}>{c.errorMessage}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 8 },
  summary: {
    backgroundColor: '#F0FDF4',
    padding: 8,
    borderRadius: 6,
  },
  summaryText: {
    fontSize: 13,
    color: '#166534',
    fontWeight: '500',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  front: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  back: {
    flex: 1,
    fontSize: 13,
    color: '#475569',
  },
  moreBlock: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  moreText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
  },
  showAllButton: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  showAllButtonText: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '600',
  },
  collapseButton: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  collapseButtonText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  errorSection: {
    backgroundColor: '#FFF1F2',
    padding: 8,
    borderRadius: 6,
    gap: 2,
  },
  errorTitle: {
    fontSize: 13,
    color: '#BE123C',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    color: '#BE123C',
  },
});
