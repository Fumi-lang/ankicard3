import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
} from 'react-native-reanimated';

interface MotivationBannerProps {
  message: string;
}

/** モチベーション声掛けバナー（スライドイン + 自動フェードアウト）*/
export const MotivationBanner: React.FC<MotivationBannerProps> = ({ message }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-16);

  useEffect(() => {
    if (!message) return;
    // 表示: 250ms でスライドイン + フェードイン
    // 保持: 2500ms
    // 消去: 500ms でフェードアウト + スライドアップ（合計 3250ms）
    opacity.value = withSequence(
      withTiming(1, { duration: 250 }),
      withDelay(2500, withTiming(0, { duration: 500 })),
    );
    translateY.value = withSequence(
      withTiming(0, { duration: 250 }),
      withDelay(2500, withTiming(-16, { duration: 500 })),
    );
  }, [message]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!message) return null;

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <Text style={styles.message}>{message}</Text>
    </Animated.View>
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
    marginHorizontal: 16,
  },
  message: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500',
  },
});
