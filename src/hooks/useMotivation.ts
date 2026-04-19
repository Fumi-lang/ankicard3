import { useMemo } from 'react';
import { getMotivationMessage, getTimeBasedType } from '../utils/motivationMessages';
import { useSettingsStore } from '../stores/settingsStore';
import { diffDays, today } from '../utils/dateUtils';

interface UseMotivationReturn {
  getBannerMessage: (opts: {
    streak: number;
    lastStudiedDate?: string;
    nearGoalCount?: number;
  }) => string;
  getSessionMessage: (opts: {
    consecutiveCorrect: number;
    hardCleared?: boolean;
    isComplete?: boolean;
    allEasy?: boolean;
  }) => string | null;
}

/** モチベーションメッセージを取得するフック */
export function useMotivation(): UseMotivationReturn {
  const appLanguage = useSettingsStore((s) => s.appLanguage);

  const getBannerMessage = useMemo(
    () =>
      ({
        streak,
        lastStudiedDate,
        nearGoalCount,
      }: {
        streak: number;
        lastStudiedDate?: string;
        nearGoalCount?: number;
      }): string => {
        // 久しぶりの学習
        if (lastStudiedDate) {
          const diff = diffDays(lastStudiedDate, today());
          if (diff > 3) {
            return getMotivationMessage('comeback', appLanguage);
          }
        }

        // 目標に近い
        if (nearGoalCount !== undefined && nearGoalCount <= 20 && nearGoalCount > 0) {
          return getMotivationMessage('nearGoal', appLanguage, nearGoalCount);
        }

        // 連続学習
        if (streak > 1) {
          return getMotivationMessage('streak', appLanguage, streak);
        }

        // 時間帯に応じたメッセージ
        return getMotivationMessage(getTimeBasedType(), appLanguage);
      },
    [appLanguage]
  );

  const getSessionMessage = useMemo(
    () =>
      ({
        consecutiveCorrect,
        hardCleared,
        isComplete,
        allEasy,
      }: {
        consecutiveCorrect: number;
        hardCleared?: boolean;
        isComplete?: boolean;
        allEasy?: boolean;
      }): string | null => {
        if (isComplete && allEasy) return getMotivationMessage('allEasy', appLanguage);
        if (isComplete) return getMotivationMessage('sessionComplete', appLanguage);
        if (hardCleared) return getMotivationMessage('hardCleared', appLanguage);
        if (consecutiveCorrect > 0 && consecutiveCorrect % 5 === 0) {
          return getMotivationMessage('fiveCorrect', appLanguage);
        }
        return null;
      },
    [appLanguage]
  );

  return { getBannerMessage, getSessionMessage };
}
