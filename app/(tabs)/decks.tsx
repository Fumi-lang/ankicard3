import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, TextInput, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDeck } from '../../src/hooks/useDeck';
import { DeckCard } from '../../src/components/DeckCard';
import { getDueCards } from '../../src/services/database';
import { SUPPORTED_LANGUAGES } from '../../src/utils/speechLocale';
import type { Deck, AppLanguage } from '../../src/types';
import { useSettingsStore } from '../../src/stores/settingsStore';

/** デッキ一覧画面 */
export default function DecksScreen() {
  const { t } = useTranslation();
  const { decks, isLoading, fetchDecks, createDeck, deleteDeck } = useDeck();
  const { defaultSourceLang, defaultTargetLang, appLanguage } = useSettingsStore();

  const [dueCounts, setDueCounts] = useState<Record<string, number>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [description, setDescription] = useState('');
  const [sourceLang, setSourceLang] = useState(defaultSourceLang);
  const [targetLang, setTargetLang] = useState(defaultTargetLang);

  useEffect(() => {
    fetchDecks().then(loadDueCounts);
  }, []);

  const loadDueCounts = async () => {
    const counts: Record<string, number> = {};
    for (const deck of decks) {
      const cards = await getDueCards(deck.id);
      counts[deck.id] = cards.length;
    }
    setDueCounts(counts);
  };

  useEffect(() => {
    if (decks.length > 0) loadDueCounts();
  }, [decks]);

  const handleCreate = async () => {
    if (!deckName.trim()) return;
    await createDeck({ name: deckName.trim(), description, sourceLang, targetLang });
    setDeckName('');
    setDescription('');
    setShowCreateModal(false);
  };

  const handleDelete = (deck: Deck) => {
    if (typeof window !== 'undefined') {
      if (window.confirm(`${t('deck.deleteDeck')}: "${deck.name}"\n${t('deck.confirmDelete')}`)) {
        deleteDeck(deck.id);
      }
      return;
    }
    Alert.alert(t('deck.deleteDeck'), t('deck.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteDeck(deck.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tabs.decks')}</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {decks.length === 0 && !isLoading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('deck.noDecks')}</Text>
          </View>
        ) : (
          decks.map((deck) => (
            <DeckCard
              key={deck.id}
              deck={deck}
              dueCount={dueCounts[deck.id] ?? 0}
              onPress={() => router.push(`/deck/${deck.id}`)}
              onStudy={() => router.push(`/deck/study/${deck.id}`)}
              onDelete={() => handleDelete(deck)}
            />
          ))
        )}
      </ScrollView>

      {/* デッキ作成モーダル */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('deck.newDeck')}</Text>

            <TextInput
              style={styles.input}
              placeholder={t('deck.deckName')}
              value={deckName}
              onChangeText={setDeckName}
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder={t('deck.description')}
              value={description}
              onChangeText={setDescription}
            />

            <Text style={styles.inputLabel}>{t('deck.sourceLang')}</Text>
            <LangPicker value={sourceLang} onChange={setSourceLang} appLanguage={appLanguage} />

            <Text style={styles.inputLabel}>{t('deck.targetLang')}</Text>
            <LangPicker value={targetLang} onChange={setTargetLang} appLanguage={appLanguage} />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowCreateModal(false); setDeckName(''); }}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.createButton, !deckName.trim() && styles.disabled]}
                onPress={handleCreate}
                disabled={!deckName.trim()}
              >
                <Text style={styles.createText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** 言語選択ピッカー */
const LangPicker: React.FC<{
  value: string;
  onChange: (v: string) => void;
  appLanguage: AppLanguage;
}> = ({ value, onChange, appLanguage }) => {
  return (
    <View style={styles.langPicker}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={[styles.langChip, value === lang.code && styles.langChipActive]}
            onPress={() => onChange(lang.code)}
          >
            <Text style={[styles.langChipText, value === lang.code && styles.langChipTextActive]}>
              {appLanguage === 'en' ? lang.nameEn : lang.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  addButton: {
    backgroundColor: '#4F46E5',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontSize: 22, lineHeight: 26 },
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  empty: { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    gap: 12,
    maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#1E293B',
  },
  inputLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  langPicker: { height: 40 },
  langChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  langChipActive: {
    backgroundColor: '#EEF2FF',
    borderColor: '#4F46E5',
  },
  langChipText: { fontSize: 12, color: '#64748B' },
  langChipTextActive: { color: '#4F46E5', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontSize: 15 },
  createButton: {
    flex: 1,
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  createText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
