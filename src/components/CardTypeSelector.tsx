import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CardForm } from '../types';

interface CardFormSelectorProps {
  selected: CardForm;
  onChange: (form: CardForm) => void;
}

const FORMS: CardForm[] = ['translation', 'cloze'];

/** カードフォーム選択UI（タブ形式）*/
export const CardFormSelector: React.FC<CardFormSelectorProps> = ({ selected, onChange }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {FORMS.map((form) => (
        <TouchableOpacity
          key={form}
          style={[styles.tab, selected === form && styles.activeTab]}
          onPress={() => onChange(form)}
        >
          <Text style={[styles.tabText, selected === form && styles.activeText]}>
            {t(`cardType.${form}`)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// 後方互換エイリアス
export const CardTypeSelector = CardFormSelector;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  tabText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  activeText: {
    color: '#4F46E5',
    fontWeight: '700',
  },
});
