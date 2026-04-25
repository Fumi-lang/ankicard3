import '../src/i18n';
import React from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

/** ルートレイアウト（i18n初期化含む）*/
export default function RootLayout() {
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
