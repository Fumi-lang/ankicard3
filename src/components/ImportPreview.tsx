import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ImportedCardData } from '../types';
import { CardFormBadge } from './CardTypeBadge';
import { SpeechButton } from './SpeechButton';

interface ImportPreviewProps {
  cards: ImportedCardData[];
  targetLang: string;
  sourceLang: string;
}

/** インポートプレビュー（解析結果の確認UI）*/
export const ImportPreview: React.FC<ImportPreviewProps> = ({ cards, targetLang, sourceLang }) => {
  const { t } = useTranslation();

  const validCards = cards.filter((c) => c.isValid);
  const errorCards = cards.filter((c) => !c.isValid);

  return (
    <View style={styles.container}>
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          {t('import.valid')}: {validCards.length} / {t('import.errors')}: {errorCards.length}
        </Text>
      </View>
      <FlatList
        data={validCards.slice(0, 20)} // プレビューは最大20件
        keyExtractor={(_, i) => String(i)}
        scrollEnabled={false}
        renderItem={({ item }) => (
          <View style={styles.cardRow}>
            <CardFormBadge cardForm={item.cardForm} />
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
        )}
      />
      {validCards.length > 20 && (
        <Text style={styles.moreText}>...他 {validCards.length - 20} 件</Text>
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
  moreText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
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
