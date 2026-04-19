import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { CardType } from '../types';

interface CardTypeSelectorProps {
  selected: CardType;
  onChange: (type: CardType) => void;
}

const TYPES: CardType[] = ['word', 'collocation', 'sentence'];

/** カードタイプ選択UI（タブ形式）*/
export const CardTypeSelector: React.FC<CardTypeSelectorProps> = ({ selected, onChange }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {TYPES.map((type) => (
        <TouchableOpacity
          key={type}
          style={[styles.tab, selected === type && styles.activeTab]}
          onPress={() => onChange(type)}
        >
          <Text style={[styles.tabText, selected === type && styles.activeText]}>
            {t(`cardType.${type}`)}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

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
