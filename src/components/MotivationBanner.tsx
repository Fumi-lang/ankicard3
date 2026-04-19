import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MotivationBannerProps {
  message: string;
}

/** モチベーション声掛けバナー */
export const MotivationBanner: React.FC<MotivationBannerProps> = ({ message }) => {
  if (!message) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF7ED',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    marginVertical: 8,
  },
  message: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
});
