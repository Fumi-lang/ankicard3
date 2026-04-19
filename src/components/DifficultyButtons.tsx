import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { StudyQuality } from '../types';

interface DifficultyButtonsProps {
  estimates: Record<'again' | 'hard' | 'good' | 'easy', string>;
  onAnswer: (quality: StudyQuality) => void;
  disabled?: boolean;
}

const BUTTON_CONFIG: { quality: StudyQuality; color: string; textColor: string }[] = [
  { quality: 'again', color: '#FEE2E2', textColor: '#DC2626' },
  { quality: 'hard',  color: '#FEF3C7', textColor: '#D97706' },
  { quality: 'good',  color: '#DCFCE7', textColor: '#16A34A' },
  { quality: 'easy',  color: '#DBEAFE', textColor: '#2563EB' },
];

/** 回答難易度ボタン（Again/Hard/Good/Easy）*/
export const DifficultyButtons: React.FC<DifficultyButtonsProps> = ({
  estimates,
  onAnswer,
  disabled = false,
}) => {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      {BUTTON_CONFIG.map(({ quality, color, textColor }) => (
        <TouchableOpacity
          key={quality}
          style={[styles.button, { backgroundColor: color }, disabled && styles.disabled]}
          onPress={() => onAnswer(quality)}
          disabled={disabled}
        >
          <Text style={[styles.label, { color: textColor }]}>
            {t(`study.${quality}`)}
          </Text>
          <Text style={[styles.estimate, { color: textColor }]}>
            {estimates[quality]}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  estimate: {
    fontSize: 11,
    marginTop: 2,
  },
});
