import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CardForm } from '../types';

/** カードフォーム別カラー */
const FORM_COLORS: Record<CardForm, { bg: string; text: string }> = {
  translation: { bg: '#EEF2FF', text: '#4F46E5' },
  cloze:       { bg: '#ECFEFF', text: '#0891B2' },
};

interface CardFormBadgeProps {
  cardForm: CardForm;
}

/** カードフォームを示すバッジコンポーネント */
export const CardFormBadge: React.FC<CardFormBadgeProps> = ({ cardForm }) => {
  const { t } = useTranslation();
  const colors = FORM_COLORS[cardForm] ?? FORM_COLORS.translation;

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.text, { color: colors.text }]}>
        {t(`cardType.${cardForm}`)}
      </Text>
    </View>
  );
};

// 後方互換エイリアス
export const CardTypeBadge = CardFormBadge;

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
