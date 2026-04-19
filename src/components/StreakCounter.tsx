import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface StreakCounterProps {
  streak: number;
}

/** 連続学習日数カウンター */
export const StreakCounter: React.FC<StreakCounterProps> = ({ streak }) => {
  const { i18n } = useTranslation();
  const lang = i18n.language as 'ja' | 'en';

  if (streak === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.fire}>🔥</Text>
      <Text style={styles.count}>{streak}</Text>
      <Text style={styles.unit}>{lang === 'ja' ? '日連続' : 'day streak'}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fire: {
    fontSize: 20,
  },
  count: {
    fontSize: 22,
    fontWeight: '700',
    color: '#F59E0B',
  },
  unit: {
    fontSize: 14,
    color: '#64748B',
  },
});
