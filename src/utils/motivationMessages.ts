/** モチベーションメッセージ定義（日本語・英語両対応）*/

export type MotivationType =
  | 'streak'
  | 'comeback'
  | 'nearGoal'
  | 'morning'
  | 'afternoon'
  | 'evening'
  | 'fiveCorrect'
  | 'hardCleared'
  | 'sessionComplete'
  | 'allEasy';

interface MotivationMessage {
  ja: string;
  en: string;
}

/** メッセージテンプレート。{n}はプレースホルダー */
export const MOTIVATION_MESSAGES: Record<MotivationType, MotivationMessage> = {
  streak: {
    ja: '🔥 {n}日連続学習中！素晴らしい継続力です！',
    en: '🔥 {n}-day streak! Fantastic dedication!',
  },
  comeback: {
    ja: 'おかえりなさい！今日から再スタートしましょう 💪',
    en: 'Welcome back! Let\'s restart today 💪',
  },
  nearGoal: {
    ja: 'あと{n}語で目標達成！🎯',
    en: 'Only {n} more words to your goal! 🎯',
  },
  morning: {
    ja: '朝の学習は記憶の定着に最適！🌅',
    en: 'Morning study is great for memory! 🌅',
  },
  afternoon: {
    ja: '午後も頑張りましょう！📚',
    en: 'Keep it up this afternoon! 📚',
  },
  evening: {
    ja: '夜の復習で記憶を定着させましょう！🌙',
    en: 'Evening review helps cement memories! 🌙',
  },
  fiveCorrect: {
    ja: '5問連続正解！その調子です！✨',
    en: '5 correct in a row! Keep it up! ✨',
  },
  hardCleared: {
    ja: '難しいカードをクリア！粘り強さが光ります 💡',
    en: 'Cleared a tough card! Persistence pays off 💡',
  },
  sessionComplete: {
    ja: '今日の学習セッション完了！お疲れ様でした 🎉',
    en: "Today's session complete! Great work 🎉",
  },
  allEasy: {
    ja: '全問Easy！完璧な復習でした！🏆',
    en: 'All Easy! Perfect review session! 🏆',
  },
};

/** メッセージを取得し、{n}を数値で置換する */
export function getMotivationMessage(
  type: MotivationType,
  lang: 'ja' | 'en' = 'ja',
  n?: number
): string {
  const msg = MOTIVATION_MESSAGES[type][lang];
  if (n !== undefined) {
    return msg.replace('{n}', String(n));
  }
  return msg;
}

/** 時間帯に応じたメッセージタイプを返す */
export function getTimeBasedType(): MotivationType {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}
