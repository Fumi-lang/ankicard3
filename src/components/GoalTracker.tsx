import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Goal } from '../types';
import { ProgressBar } from './ProgressBar';
import { diffDays, today } from '../utils/dateUtils';

interface GoalTrackerProps {
  goal: Goal;
}

/** 目標達成トラッカー */
export const GoalTracker: React.FC<GoalTrackerProps> = ({ goal }) => {
  const { t } = useTranslation();

  const progress = Math.min(1, goal.wordsLearned / goal.targetWords);
  const elapsed = diffDays(goal.startDate, today());
  const expectedProgress = Math.min(1, elapsed / goal.targetDays);
  const isOnTrack = progress >= expectedProgress - 0.05;
  const remaining = goal.targetWords - goal.wordsLearned;
  const daysLeft = Math.max(0, goal.targetDays - elapsed);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.numbers}>
          {goal.wordsLearned}/{goal.targetWords}{t('common.words')}
        </Text>
        <Text style={styles.daysLeft}>
          {daysLeft}{t('goals.daysLeft')}
        </Text>
      </View>
      <ProgressBar
        progress={progress}
        color={goal.isCompleted ? '#10B981' : isOnTrack ? '#4F46E5' : '#EF4444'}
      />
      <Text style={[styles.status, { color: goal.isCompleted ? '#10B981' : isOnTrack ? '#059669' : '#DC2626' }]}>
        {goal.isCompleted
          ? t('goals.completed')
          : isOnTrack
          ? `${t('goals.onTrack')} あと${remaining}${t('common.words')}`
          : t('goals.behindSchedule')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  numbers: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  daysLeft: {
    fontSize: 12,
    color: '#64748B',
  },
  status: {
    fontSize: 12,
    fontWeight: '500',
  },
});
