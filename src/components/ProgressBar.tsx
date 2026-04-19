import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface ProgressBarProps {
  progress: number; // 0〜1
  label?: string;
  showPercent?: boolean;
  color?: string;
}

/** 学習進捗バー */
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercent = true,
  color = '#4F46E5',
}) => {
  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: color }]} />
      </View>
      {showPercent && <Text style={styles.percent}>{percent}%</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  track: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  percent: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'right',
    marginTop: 2,
  },
});
