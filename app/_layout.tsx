import '../src/i18n';
import React from 'react';
import { Stack } from 'expo-router';

/** ルートレイアウト（i18n初期化含む）*/
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="deck/[id]" />
      <Stack.Screen name="deck/study/[id]" />
      <Stack.Screen name="card/create" />
      <Stack.Screen name="card/import" />
    </Stack>
  );
}
