import '../src/i18n';
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTagStore } from '../src/stores/tagStore';

/** ルートレイアウト（i18n初期化・タグストア初期化含む）*/
export default function RootLayout() {
  const { fetchAllTags } = useTagStore();

  // アプリ起動時にタグを全件ロード（方式 B キャッシュ初期化）
  useEffect(() => {
    fetchAllTags();
  }, []);

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="deck/[id]" />
        <Stack.Screen name="deck/study/[id]" />
        <Stack.Screen name="card/create" />
        <Stack.Screen name="card/import" />
      </Stack>
    </SafeAreaProvider>
  );
}
