import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Alert, FlatList
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCardStore } from '../../src/stores/cardStore';
import { getDeckById } from '../../src/services/database';
import { exportDeck } from '../../src/services/deckExporter';
import { CardFormBadge } from '../../src/components/CardTypeBadge';
import { SpeechButton } from '../../src/components/SpeechButton';
import type { Card, CardForm, Deck } from '../../src/types';

/** デッキ詳細・カード一覧画面 */
export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { cards, fetchCards, deleteCard } = useCardStore();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [filterForm, setFilterForm] = useState<CardForm | 'all'>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCards(id);
      getDeckById(id).then(setDeck);
    }
  }, [id]);

  const filteredCards = filterForm === 'all'
    ? cards
    : cards.filter((c) => c.cardForm === filterForm);

  const handleDelete = (card: Card) => {
    if (typeof window !== 'undefined') {
      if (window.confirm(t('card.confirmDelete'))) {
        deleteCard(card.id);
      }
      return;
    }
    Alert.alert(t('card.delete'), t('card.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteCard(card.id) },
    ]);
  };

  const handleExport = async (includeProgress: boolean) => {
    setShowExportMenu(false);
    if (!id) return;
    try {
      await exportDeck(id, includeProgress);
    } catch (e) {
      Alert.alert('エラー', String(e));
    }
  };

  if (!deck) return null;

  const FILTERS: { key: CardForm | 'all'; label: string }[] = [
    { key: 'all',         label: t('deck.filterAll') },
    { key: 'translation', label: t('deck.filterTranslation') },
    { key: 'cloze',       label: t('deck.filterCloze') },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{deck.name}</Text>
        <TouchableOpacity onPress={() => setShowExportMenu(true)} style={styles.menuButton}>
          <Text style={styles.menuText}>⋮</Text>
        </TouchableOpacity>
      </View>

      {/* アクションボタン */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push(`/deck/study/${id}`)}
        >
          <Text style={styles.primaryButtonText}>{t('deck.startStudy')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push({ pathname: '/card/create', params: { deckId: id } })}
        >
          <Text style={styles.secondaryButtonText}>{t('deck.addCard')}</Text>
        </TouchableOpacity>
      </View>

      {/* フィルタ */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filterForm === f.key && styles.filterChipActive]}
            onPress={() => setFilterForm(f.key)}
          >
            <Text style={[styles.filterText, filterForm === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* カード一覧 */}
      <FlatList
        data={filteredCards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.cardRow}>
            <CardFormBadge cardForm={item.cardForm} />
            <View style={styles.cardTexts}>
              <View style={styles.textRow}>
                <Text style={styles.frontText} numberOfLines={2}>{item.frontText}</Text>
                <SpeechButton text={item.frontText} lang={deck.sourceLang} size="small" />
              </View>
              <View style={styles.textRow}>
                <Text style={styles.backText} numberOfLines={2}>{item.backText}</Text>
                <SpeechButton text={item.backText} lang={deck.targetLang} size="small" />
              </View>
            </View>
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
              <Text style={styles.deleteText}>×</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('common.empty')}</Text>
        }
      />

      {/* エクスポートメニュー */}
      {showExportMenu && (
        <View style={styles.exportMenu}>
          <TouchableOpacity style={styles.exportMenuItem} onPress={() => handleExport(true)}>
            <Text style={styles.exportMenuText}>{t('deck.exportWithProgress')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportMenuItem} onPress={() => handleExport(false)}>
            <Text style={styles.exportMenuText}>{t('deck.exportWithoutProgress')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportMenuCancel} onPress={() => setShowExportMenu(false)}>
            <Text style={styles.exportMenuCancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  backButton: { padding: 4 },
  backText: { color: '#4F46E5', fontSize: 14 },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: '#1E293B', textAlign: 'center', marginHorizontal: 8 },
  menuButton: { padding: 4 },
  menuText: { fontSize: 22, color: '#64748B' },
  actions: {
    flexDirection: 'row', gap: 8, padding: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  primaryButton: {
    flex: 1, backgroundColor: '#4F46E5', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  secondaryButton: {
    flex: 1, borderWidth: 1.5, borderColor: '#4F46E5',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  secondaryButtonText: { color: '#4F46E5', fontWeight: '600', fontSize: 14 },
  filterBar: { paddingHorizontal: 12, paddingVertical: 8, maxHeight: 44, backgroundColor: '#FFFFFF' },
  filterChip: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 14,
    backgroundColor: '#F1F5F9', marginRight: 6,
  },
  filterChipActive: { backgroundColor: '#EEF2FF' },
  filterText: { fontSize: 12, color: '#64748B' },
  filterTextActive: { color: '#4F46E5', fontWeight: '600' },
  list: { padding: 12, gap: 8 },
  cardRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardTexts: { flex: 1, gap: 4 },
  textRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  frontText: { flex: 1, fontSize: 14, fontWeight: '500', color: '#1E293B' },
  backText: { flex: 1, fontSize: 13, color: '#475569' },
  deleteButton: { padding: 4 },
  deleteText: { fontSize: 18, color: '#CBD5E1' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 60, fontSize: 14 },
  exportMenu: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 16, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
  },
  exportMenuItem: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 14, alignItems: 'center',
  },
  exportMenuText: { fontSize: 14, color: '#1E293B', fontWeight: '500' },
  exportMenuCancel: { padding: 14, alignItems: 'center' },
  exportMenuCancelText: { fontSize: 14, color: '#94A3B8' },
});
