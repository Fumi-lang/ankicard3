import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CardType } from '../types';

/** カードタイプ別カラー */
const TYPE_COLORS: Record<CardType, { bg: string; text: string }> = {
  word:        { bg: '#EEF2FF', text: '#4F46E5' },
  collocation: { bg: '#ECFEFF', text: '#0891B2' },
  sentence:    { bg: '#ECFDF5', text: '#059669' },
};

interface CardTypeBadgeProps {
  cardType: CardType;
}

/** カードタイプを示すバッジコンポーネント */
export const CardTypeBadge: React.FC<CardTypeBadgeProps> = ({ cardType }) => {
  const { t } = useTranslation();
  const colors = TYPE_COLORS[cardType];

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {t(`cardType.${cardType}`)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
  },
});
