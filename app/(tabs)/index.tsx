import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDeckStore } from '../../src/stores/deckStore';
import { useGoalStore } from '../../src/stores/goalStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { getDueCards, getStudyCountByDateRange } from '../../src/services/database';
import { MotivationBanner } from '../../src/components/MotivationBanner';
import { StreakCounter } from '../../src/components/StreakCounter';
import { ProgressBar } from '../../src/components/ProgressBar';
import { GoalTracker } from '../../src/components/GoalTracker';
import { useMotivation } from '../../src/hooks/useMotivation';
import { getWeekDates, today } from '../../src/utils/dateUtils';

/** ホーム画面（今日の学習ダッシュボード）*/
export default function HomeScreen() {
  const { t } = useTranslation();
  const { decks, fetchDecks } = useDeckStore();
  const { goals, fetchGoals } = useGoalStore();
  const { defaultTargetLang } = useSettingsStore();
  const { getBannerMessage } = useMotivation();

  const [dueCount, setDueCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [weeklyData, setWeeklyData] = useState<Record<string, number>>({});
  const [bannerMessage, setBannerMessage] = useState('');

  useEffect(() => {
    fetchDecks();
    fetchGoals();
    loadStats();
  }, []);

  const loadStats = async () => {
    // 今日の復習カード数
    const dueCards = await getDueCards();
    setDueCount(dueCards.length);

    // 今週の学習データ
    const weekDates = getWeekDates();
    const counts = await getStudyCountByDateRange(weekDates[0], weekDates[6]);
    setWeeklyData(counts);

    // 連続学習日数を計算
    const streakCount = calculateStreak(counts);
    setStreak(streakCount);

    // モチベーションメッセージ
    const lastStudied = Object.keys(counts).sort().pop();
    const msg = getBannerMessage({ streak: streakCount, lastStudiedDate: lastStudied });
    setBannerMessage(msg);
  };

  const activeGoals = goals.filter((g) => !g.isCompleted);
  const weekDates = getWeekDates();
  const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];
  const maxCount = Math.max(...Object.values(weeklyData), 1);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <StreakCounter streak={streak} />
          <MotivationBanner message={bannerMessage} />
        </View>

        {/* 今日の学習カード */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.todayStudy')}</Text>
          <View style={styles.card}>
            <View style={styles.countRow}>
              <View style={styles.countItem}>
                <Text style={styles.countNumber}>{dueCount}</Text>
                <Text style={styles.countLabel}>{t('home.reviewCards')}</Text>
              </View>
              <View style={styles.countDivider} />
              <View style={styles.countItem}>
                <Text style={styles.countNumber}>{decks.length}</Text>
                <Text style={styles.countLabel}>{t('tabs.decks')}</Text>
              </View>
            </View>
            {dueCount > 0 ? (
              <TouchableOpacity
                style={styles.startButton}
                onPress={() => router.push('/deck/study/all')}
              >
                <Text style={styles.startButtonText}>{t('home.startStudy')}</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.noCards}>{t('home.noCards')}</Text>
            )}
          </View>
        </View>

        {/* 目標進捗 */}
        {activeGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('home.goalProgress')}</Text>
            {activeGoals.map((goal) => {
              const deckName = goal.deckId
                ? (decks.find((d) => d.id === goal.deckId)?.name ?? null)
                : null;
              return (
                <View key={goal.id} style={styles.card}>
                  <GoalTracker goal={goal} deckName={deckName} />
                </View>
              );
            })}
          </View>
        )}

        {/* 今週の学習 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('home.weeklyStudy')}</Text>
          <View style={styles.card}>
            <View style={styles.weekChart}>
              {weekDates.map((date, i) => {
                const count = weeklyData[date] ?? 0;
                const isToday = date === today();
                const height = Math.max(4, (count / maxCount) * 60);
                return (
                  <View key={date} style={styles.weekDay}>
                    <Text style={styles.weekCount}>{count > 0 ? count : ''}</Text>
                    <View
                      style={[
                        styles.weekBar,
                        { height, backgroundColor: isToday ? '#4F46E5' : count > 0 ? '#A5B4FC' : '#E2E8F0' },
                      ]}
                    />
                    <Text style={[styles.weekLabel, isToday && styles.weekLabelToday]}>
                      {DAY_LABELS[i]}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function calculateStreak(counts: Record<string, number>): number {
  let streak = 0;
  const d = new Date();
  for (let i = 0; i < 365; i++) {
    const dateStr = d.toISOString().split('T')[0];
    if (counts[dateStr]) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  header: { gap: 8 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
    paddingLeft: 2,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  countNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4F46E5',
  },
  countLabel: {
    fontSize: 12,
    color: '#64748B',
  },
  countDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E2E8F0',
  },
  startButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  noCards: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    paddingVertical: 8,
  },
  weekChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 90,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    justifyContent: 'flex-end',
  },
  weekCount: {
    fontSize: 10,
    color: '#64748B',
  },
  weekBar: {
    width: '100%',
    borderRadius: 3,
    minHeight: 4,
  },
  weekLabel: {
    fontSize: 11,
    color: '#94A3B8',
  },
  weekLabelToday: {
    color: '#4F46E5',
    fontWeight: '700',
  },
});
