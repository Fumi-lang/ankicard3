import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Deck } from '../types';
import { getLangName } from '../utils/speechLocale';

interface DeckCardProps {
  deck: Deck;
  dueCount?: number;
  onPress: () => void;
  onStudy?: () => void;
  onDelete?: () => void;
}

/** デッキ一覧用カードUI */
export const DeckCard: React.FC<DeckCardProps> = ({ deck, dueCount = 0, onPress, onStudy, onDelete }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ja' | 'en';

  const sourceLangName = getLangName(deck.sourceLang, lang);
  const targetLangName = getLangName(deck.targetLang, lang);

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.header}>
        <Text style={styles.name} numberOfLines={1}>{deck.name}</Text>
        <View style={styles.headerRight}>
          {dueCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{dueCount}</Text>
            </View>
          )}
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
        <Text style={styles.meta}>
          {sourceLangName} → {targetLangName}
        </Text>
        <Text style={styles.meta}>
          {deck.cardCount}{t('deck.cardCount')}
        </Text>
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
  badge: {
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    fontSize: 13,
    color: '#64748B',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  meta: {
    fontSize: 12,
    color: '#94A3B8',
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
