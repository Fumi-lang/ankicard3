import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Modal, TextInput, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useGoalStore } from '../../src/stores/goalStore';
import { useDeckStore } from '../../src/stores/deckStore';
import { GoalTracker } from '../../src/components/GoalTracker';
import type { Goal } from '../../src/types';
import { today } from '../../src/utils/dateUtils';

/** 目標設定・進捗画面 */
export default function GoalsScreen() {
  const { t } = useTranslation();
  const { goals, fetchGoals, createGoal, deleteGoal } = useGoalStore();
  const { decks, fetchDecks } = useDeckStore();

  const [showModal, setShowModal] = useState(false);
  const [targetWords, setTargetWords] = useState('100');
  const [targetDays, setTargetDays] = useState('30');
  const [selectedDeckId, setSelectedDeckId] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchGoals();
    fetchDecks();
  }, []);

  const dailyTarget =
    parseInt(targetWords) > 0 && parseInt(targetDays) > 0
      ? Math.ceil(parseInt(targetWords) / parseInt(targetDays))
      : 0;

  const handleCreate = async () => {
    if (!targetWords || !targetDays) return;
    const goal: Goal = {
      id: uuidv4(),
      deckId: selectedDeckId,
      targetWords: parseInt(targetWords),
      targetDays: parseInt(targetDays),
      wordsLearned: 0,
      startDate: today(),
      isCompleted: false,
      createdAt: new Date().toISOString(),
    };
    await createGoal(goal);
    setShowModal(false);
    setTargetWords('100');
    setTargetDays('30');
  };

  const handleDelete = (id: string) => {
    // Alert.alertはWeb環境でボタン付きダイアログを表示できないため window.confirm を使用
    if (typeof window !== 'undefined') {
      if (window.confirm(`${t('goals.delete')} — ${t('common.confirm')}`)) {
        deleteGoal(id);
      }
      return;
    }
    Alert.alert(t('goals.delete'), t('common.confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteGoal(id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tabs.goals')}</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {goals.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>🎯</Text>
            <Text style={styles.emptyLabel}>{t('goals.noGoals')}</Text>
          </View>
        ) : (
          goals.map((goal) => (
            <View key={goal.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalTitle}>
                  {goal.deckId
                    ? decks.find((d) => d.id === goal.deckId)?.name ?? t('goals.allDecks')
                    : t('goals.allDecks')}
                </Text>
                <TouchableOpacity onPress={() => handleDelete(goal.id)}>
                  <Text style={styles.deleteText}>×</Text>
                </TouchableOpacity>
              </View>
              <GoalTracker goal={goal} />
            </View>
          ))
        )}
      </ScrollView>

      {/* 目標作成モーダル */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('goals.newGoal')}</Text>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>{t('goals.targetWords')}</Text>
              <TextInput
                style={styles.numberInput}
                value={targetWords}
                onChangeText={setTargetWords}
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputRow}>
              <Text style={styles.inputLabel}>{t('goals.targetDays')}</Text>
              <TextInput
                style={styles.numberInput}
                value={targetDays}
                onChangeText={setTargetDays}
                keyboardType="number-pad"
              />
            </View>

            {dailyTarget > 0 && (
              <View style={styles.dailyTarget}>
                <Text style={styles.dailyTargetText}>
                  📅 {t('goals.dailyTarget')}: {dailyTarget}{t('common.words')}/日
                </Text>
              </View>
            )}

            <Text style={styles.inputLabel}>{t('goals.targetDeck')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.deckPicker}>
              <TouchableOpacity
                style={[styles.deckChip, !selectedDeckId && styles.deckChipActive]}
                onPress={() => setSelectedDeckId(undefined)}
              >
                <Text style={[styles.deckChipText, !selectedDeckId && styles.deckChipTextActive]}>
                  {t('goals.allDecks')}
                </Text>
              </TouchableOpacity>
              {decks.map((deck) => (
                <TouchableOpacity
                  key={deck.id}
                  style={[styles.deckChip, selectedDeckId === deck.id && styles.deckChipActive]}
                  onPress={() => setSelectedDeckId(deck.id)}
                >
                  <Text style={[styles.deckChipText, selectedDeckId === deck.id && styles.deckChipTextActive]}>
                    {deck.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setShowModal(false)}>
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={handleCreate}>
                <Text style={styles.saveText}>{t('goals.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  title: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  addButton: {
    backgroundColor: '#4F46E5', width: 36, height: 36,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontSize: 22, lineHeight: 26 },
  container: { flex: 1 },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  empty: { paddingVertical: 60, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 40 },
  emptyLabel: { fontSize: 14, color: '#94A3B8' },
  goalCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, gap: 12,
  },
  goalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalTitle: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  deleteText: { fontSize: 20, color: '#94A3B8', padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inputLabel: { fontSize: 13, color: '#475569', fontWeight: '600' },
  numberInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    padding: 10, width: 100, textAlign: 'right', fontSize: 16,
  },
  dailyTarget: { backgroundColor: '#EEF2FF', padding: 10, borderRadius: 8 },
  dailyTargetText: { fontSize: 13, color: '#4F46E5', fontWeight: '500' },
  deckPicker: { height: 40 },
  deckChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#F1F5F9', marginRight: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  deckChipActive: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  deckChipText: { fontSize: 12, color: '#64748B' },
  deckChipTextActive: { color: '#4F46E5', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1, borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontSize: 15 },
  saveButton: {
    flex: 1, backgroundColor: '#4F46E5',
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
