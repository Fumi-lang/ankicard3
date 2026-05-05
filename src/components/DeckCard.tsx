import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Deck } from '../types';
import { getLangName } from '../utils/speechLocale';

interface DeckCardProps {
  deck: Deck;
  dueCount?: number;
  /** 今日出題予定のカード数（selectTodayCards で計算済み）。null = 未計算 */
  todayCount?: number | null;
  onPress: () => void;
  onStudy?: () => void;
  onDelete?: () => void;
}

/** デッキ一覧用カードUI */
export const DeckCard: React.FC<DeckCardProps> = ({ deck, dueCount = 0, todayCount = null, onPress, onStudy, onDelete }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ja' | 'en';

  const sourceLangName = getLangName(deck.sourceLang, lang);
  const targetLangName = getLangName(deck.targetLang, lang);
  // 両方の言語が未設定かどうか
  const hasLangs = !!(deck.sourceLang || deck.targetLang);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{deck.name}</Text>
        <View style={styles.headerRight}>
          {onDelete && (
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onDelete(); }}
              style={styles.deleteButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.deleteButtonText}>×</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      {deck.description && (
        <Text style={styles.description} numberOfLines={1}>{deck.description}</Text>
      )}
      <View style={styles.footer}>
        {hasLangs ? (
          <Text style={styles.meta}>
            {sourceLangName || '?'} → {targetLangName || '?'}
          </Text>
        ) : (
          <Text style={styles.metaUnset}>
            {lang === 'en' ? 'Language not set' : '言語未設定'}
          </Text>
        )}
        <View style={styles.footerRight}>
          {todayCount !== null && (
            <Text style={styles.todayBadge}>
              {lang === 'en' ? `Today: ${todayCount}` : `今日: ${todayCount}枚`}
            </Text>
          )}
          <Text style={styles.meta}>
            {deck.cardCount}{t('deck.cardCount')}
          </Text>
        </View>
      </View>
      {onStudy && dueCount > 0 && (
        <TouchableOpacity style={styles.studyButton} onPress={onStudy}>
          <Text style={styles.studyButtonText}>{t('deck.startStudy')}</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    gap: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    lineHeight: 20,
    color: '#DC2626',
    fontWeight: '700',
  },
  description: {
    fontSize: 13,
    color: '#64748B',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayBadge: {
    fontSize: 11,
    color: '#4F46E5',
    fontWeight: '600',
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  meta: {
    fontSize: 12,
    color: '#94A3B8',
  },
  metaUnset: {
    fontSize: 12,
    color: '#CBD5E1',
    fontStyle: 'italic',
  },
  studyButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  studyButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
