import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Alert
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useCardStore } from '../../src/stores/cardStore';
import { useDeckStore } from '../../src/stores/deckStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { pickFile, importFile } from '../../src/services/fileImporter';
import { importDeckFromExport, readDeckExportFile } from '../../src/services/deckImporter';
import { ImportPreview } from '../../src/components/ImportPreview';
import { getInitialSRS } from '../../src/services/srs';
import type { Card, ImportResult } from '../../src/types';

const DELIMITERS = [
  { key: '-', label: 'ハイフン (-)' },
  { key: ':', label: 'コロン (:)' },
  { key: '→', label: '矢印 (→)' },
  { key: '\t', label: 'タブ' },
];

/** ファイルインポート画面 */
export default function ImportScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { t } = useTranslation();
  const { createCards } = useCardStore();
  const { decks } = useDeckStore();
  const { defaultSourceLang, defaultTargetLang } = useSettingsStore();

  const deck = decks.find((d) => d.id === deckId);
  const sourceLang = deck?.sourceLang ?? defaultSourceLang;
  const targetLang = deck?.targetLang ?? defaultTargetLang;

  const [result, setResult] = useState<ImportResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [delimiter, setDelimiter] = useState('-');
  const [isSaving, setIsSaving] = useState(false);

  const handlePickFile = async () => {
    const file = await pickFile();
    if (!file) return;
    setIsLoading(true);
    try {
      const importResult = await importFile(file, delimiter);
      setResult(importResult);
    } catch (e) {
      Alert.alert('エラー', t('errors.invalidFile') + ': ' + String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportAll = async () => {
    if (!result || !deckId) return;
    setIsSaving(true);
    try {
      const validCards = result.cards.filter((c) => c.isValid);
      const now = new Date().toISOString();
      const cards: Card[] = validCards.map((c) => ({
        id: uuidv4(),
        deckId,
        cardType: c.cardType,
        frontText: c.frontText,
        backText: c.backText,
        extraInfo: c.extraInfo as Card['extraInfo'],
        source: 'import' as const,
        ...getInitialSRS(),
        createdAt: now,
        updatedAt: now,
      }));
      await createCards(cards);
      Alert.alert('', `${cards.length}枚インポートしました`, [
        { text: t('common.done'), onPress: () => router.back() },
      ]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('import.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* デッキ表示 */}
        {deck && (
          <View style={styles.deckBadge}>
            <Text style={styles.deckBadgeText}>📚 {deck.name}</Text>
          </View>
        )}

        {/* 区切り文字選択 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('import.selectDelimiter')}</Text>
          <View style={styles.delimiterRow}>
            {DELIMITERS.map((d) => (
              <TouchableOpacity
                key={d.key}
                style={[styles.delimiterChip, delimiter === d.key && styles.delimiterChipActive]}
                onPress={() => setDelimiter(d.key)}
              >
                <Text style={[styles.delimiterText, delimiter === d.key && styles.delimiterTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ファイル選択ボタン */}
        <TouchableOpacity style={styles.selectButton} onPress={handlePickFile} disabled={isLoading}>
          {isLoading ? (
            <ActivityIndicator color="#4F46E5" size="small" />
          ) : (
            <>
              <Text style={styles.selectButtonText}>{t('import.selectFile')}</Text>
              <Text style={styles.supportedText}>{t('import.supported')}</Text>
            </>
          )}
        </TouchableOpacity>

        {/* プレビュー */}
        {result && (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryRow}>
                {t('import.totalRows')}: {result.totalRows} /
                {t('import.valid')}: {result.validCount} /
                {t('import.errors')}: {result.errorCount}
              </Text>
              {result.fileType && (
                <Text style={styles.formatText}>{t('import.detected')}: {result.fileType}</Text>
              )}
            </View>

            <ImportPreview
              cards={result.cards}
              sourceLang={sourceLang}
              targetLang={targetLang}
            />

            <TouchableOpacity
              style={[styles.importButton, (result.validCount === 0 || isSaving) && styles.disabled]}
              onPress={handleImportAll}
              disabled={result.validCount === 0 || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.importButtonText}>
                  {t('import.importAll')} ({result.validCount})
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backText: { color: '#4F46E5', fontSize: 14 },
  title: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  deckBadge: { backgroundColor: '#EEF2FF', borderRadius: 8, padding: 8, alignSelf: 'flex-start' },
  deckBadgeText: { fontSize: 12, color: '#4F46E5', fontWeight: '500' },
  section: { gap: 8 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  delimiterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  delimiterChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: 'transparent',
  },
  delimiterChipActive: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  delimiterText: { fontSize: 12, color: '#64748B' },
  delimiterTextActive: { color: '#4F46E5', fontWeight: '600' },
  selectButton: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', gap: 6,
  },
  selectButtonText: { fontSize: 15, fontWeight: '600', color: '#4F46E5' },
  supportedText: { fontSize: 12, color: '#94A3B8' },
  summaryCard: {
    backgroundColor: '#F0FDF4', borderRadius: 10, padding: 12, gap: 4,
  },
  summaryRow: { fontSize: 13, color: '#166534' },
  formatText: { fontSize: 12, color: '#64748B' },
  importButton: {
    backgroundColor: '#4F46E5', borderRadius: 12, paddingVertical: 14, alignItems: 'center',
  },
  importButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
