import React from 'react';
import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** タブナビゲーション定義 */
export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  /**
   * insets.bottom は viewport-fit=cover + SafeAreaProvider があれば正しい値が入る。
   * 万が一 0 が返った場合の Platform フォールバック:
   *   - web (iPhone Safari): CSS env() 経由で読めるはずなので 0 のまま (CSS が補完)
   *   - iOS native: SafeAreaProvider が必ず値を返すので通常 0 にならない
   */
  const bottomInset = insets.bottom > 0
    ? insets.bottom
    : Platform.OS === 'ios' ? 34 : 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#4F46E5',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#F1F5F9',
          borderTopWidth: 1,
          paddingBottom: bottomInset,
          height: 56 + bottomInset,
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: t('tabs.decks'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📚</Text>,
        }}
      />
      <Tabs.Screen
        name="goals"
        options={{
          title: t('tabs.goals'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🎯</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('tabs.settings'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
