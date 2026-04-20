import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, TextInput, Alert, ActivityIndicator
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useCardStore } from '../../src/stores/cardStore';
import { useDeckStore } from '../../src/stores/deckStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { CardFormSelector } from '../../src/components/CardTypeSelector';
import { ClaudeResponseParser } from '../../src/components/ClaudeResponseParser';
import { buildPrompt, parseInputItems } from '../../src/services/promptBuilder';
import { getInitialSRS } from '../../src/services/srs';
import type { CardForm, Card, ImportedCardData } from '../../src/types';

type AddMethod = 'manual' | 'claude' | null;

/** カード作成画面（翻訳・穴埋めの2フォーム対応）*/
export default function CreateCardScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { t } = useTranslation();
  const { createCard, createCards } = useCardStore();
  const { decks } = useDeckStore();
  const { defaultSourceLang, defaultTargetLang } = useSettingsStore();

  const deck = decks.find((d) => d.id === deckId);
  const sourceLang = deck?.sourceLang ?? defaultSourceLang;
  const targetLang = deck?.targetLang ?? defaultTargetLang;

  const [method, setMethod] = useState<AddMethod>(null);
  const [cardForm, setCardForm] = useState<CardForm>('translation');
  const [cardCount, setCardCount] = useState(5);

  // 手動入力
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Claude連携
  const [claudeInput, setClaudeInput] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [parsedCards, setParsedCards] = useState<ImportedCardData[]>([]);

  const handleManualSave = async () => {
    if (!frontText.trim() || !backText.trim() || !deckId) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const card: Card = {
        id: uuidv4(),
        deckId,
        cardForm,
        frontText: frontText.trim(),
        backText: backText.trim(),
        source: 'manual',
        ...getInitialSRS(),
        createdAt: now,
        updatedAt: now,
      };
      await createCard(card);
      setFrontText('');
      setBackText('');
      Alert.alert('', '保存しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePrompt = () => {
    const items = parseInputItems(claudeInput);
    if (items.length === 0) return;
    const prompt = buildPrompt(cardForm, items, sourceLang, targetLang, cardCount);
    setGeneratedPrompt(prompt);
  };

  const handleCopyPrompt = async () => {
    if (!generatedPrompt) return;
    try {
      await navigator.clipboard.writeText(generatedPrompt);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = generatedPrompt;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSaveAll = async () => {
    if (!deckId || parsedCards.length === 0) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const cards: Card[] = parsedCards.map((c) => ({
        id: uuidv4(),
        deckId,
        cardForm: c.cardForm,
        frontText: c.frontText,
        backText: c.backText,
        extraInfo: c.extraInfo as Card['extraInfo'],
        source: 'claude' as const,
        ...getInitialSRS(),
        createdAt: now,
        updatedAt: now,
      }));
      await createCards(cards);
      Alert.alert('', `${cards.length}枚保存しました`);
      setParsedCards([]);
      setGeneratedPrompt('');
      setClaudeInput('');
    } finally {
      setIsSaving(false);
    }
  };

  const getFrontLabel = (): string => {
    if (cardForm === 'cloze') return t('card.frontCloze');
    return t('card.frontTranslation');
  };

  const getBackLabel = (): string => {
    if (cardForm === 'cloze') return t('card.backCloze');
    return t('card.backTranslation');
  };

  const getInputPlaceholder = (): string => {
    if (cardForm === 'cloze') return t('claude.clozeInput');
    return t('claude.translationInput');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => method ? setMethod(null) : router.back()}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('card.addMethod')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* デッキ表示 */}
        {deck && (
          <View style={styles.deckBadge}>
            <Text style={styles.deckBadgeText}>📚 {deck.name}</Text>
          </View>
        )}

        {/* カード形式選択 */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('card.cardForm')}</Text>
          <CardFormSelector selected={cardForm} onChange={(f) => {
            setCardForm(f);
            setGeneratedPrompt('');
            setParsedCards([]);
          }} />
        </View>

        {/* 追加方法選択 */}
        {!method && (
          <View style={styles.methodList}>
            <TouchableOpacity style={styles.methodButton} onPress={() => setMethod('manual')}>
              <Text style={styles.methodText}>{t('card.manual')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.methodButton} onPress={() => setMethod('claude')}>
              <Text style={styles.methodText}>{t('card.claude')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.methodButton}
              onPress={() => router.push({ pathname: '/card/import', params: { deckId } })}
            >
              <Text style={styles.methodText}>{t('card.fileImport')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 手動入力フォーム */}
        {method === 'manual' && (
          <View style={styles.section}>
            {/* 上段: 学習言語テキスト（backText = 表面に表示）*/}
            <Text style={styles.inputLabel}>{getBackLabel()}</Text>
            <TextInput
              style={styles.input}
              value={backText}
              onChangeText={setBackText}
              placeholder={cardForm === 'cloze' ? '例: The ___ is shining today.' : '...'}
            />
            {/* 下段: 母語テキスト（frontText = 裏面に表示）*/}
            <Text style={styles.inputLabel}>{getFrontLabel()}</Text>
            <TextInput
              style={styles.input}
              value={frontText}
              onChangeText={setFrontText}
              placeholder="..."
            />
            <TouchableOpacity
              style={[styles.saveButton, (!frontText.trim() || !backText.trim()) && styles.disabled]}
              onPress={handleManualSave}
              disabled={!frontText.trim() || !backText.trim() || isSaving}
            >
              {isSaving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Claude連携フォーム */}
        {method === 'claude' && (
          <View style={styles.section}>
            <Text style={styles.stepLabel}>{t('claude.step1')}</Text>

            {/* 生成枚数スライダー */}
            <View style={styles.sliderRow}>
              <Text style={styles.inputLabel}>{t('claude.cardCountLabel')}: {cardCount}枚</Text>
              {/* @ts-ignore — Expo Web では <input type="range"> が有効 */}
              <input
                type="range"
                min={1}
                max={10}
                value={cardCount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCardCount(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#4F46E5', cursor: 'pointer', marginTop: 4 }}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>1</Text>
                <Text style={styles.sliderLabel}>10</Text>
              </View>
            </View>

            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={claudeInput}
              onChangeText={setClaudeInput}
              multiline
              numberOfLines={4}
              placeholder={getInputPlaceholder()}
              textAlignVertical="top"
            />

            <TouchableOpacity
              style={[styles.generateButton, !claudeInput.trim() && styles.disabled]}
              onPress={handleGeneratePrompt}
              disabled={!claudeInput.trim()}
            >
              <Text style={styles.generateButtonText}>{t('claude.generatePrompt')}</Text>
            </TouchableOpacity>

            {generatedPrompt ? (
              <>
                <Text style={styles.stepLabel}>{t('claude.step2')}</Text>
                <View style={styles.promptBox}>
                  <ScrollView style={styles.promptScroll}>
                    <Text style={styles.promptText} selectable>{generatedPrompt}</Text>
                  </ScrollView>
                </View>
                <TouchableOpacity style={styles.copyButton} onPress={handleCopyPrompt}>
                  <Text style={styles.copyButtonText}>
                    {isCopied ? `✓ ${t('claude.copied')}` : t('claude.copyPrompt')}
                  </Text>
                </TouchableOpacity>

                <ClaudeResponseParser
                  onParsed={setParsedCards}
                  targetLang={targetLang}
                  sourceLang={sourceLang}
                  onSwitchToManual={() => setMethod('manual')}
                />

                {parsedCards.length > 0 && (
                  <TouchableOpacity
                    style={[styles.saveButton, isSaving && styles.disabled]}
                    onPress={handleSaveAll}
                    disabled={isSaving}
                  >
                    {isSaving
                      ? <ActivityIndicator color="#FFFFFF" size="small" />
                      : <Text style={styles.saveButtonText}>
                          {t('claude.saveAll')} ({parsedCards.length})
                        </Text>
                    }
                  </TouchableOpacity>
                )}
              </>
            ) : null}
          </View>
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
  deckBadge: {
    backgroundColor: '#EEF2FF', borderRadius: 8, padding: 8, alignSelf: 'flex-start',
  },
  deckBadgeText: { fontSize: 12, color: '#4F46E5', fontWeight: '500' },
  section: { gap: 10 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#1E293B', backgroundColor: '#FFFFFF',
  },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },
  methodList: { gap: 10 },
  methodButton: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 18,
    borderWidth: 1, borderColor: '#E2E8F0',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  methodText: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  saveButton: {
    backgroundColor: '#4F46E5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  stepLabel: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  sliderRow: { gap: 4 },
  sliderLabels: {
    flexDirection: 'row', justifyContent: 'space-between',
  },
  sliderLabel: { fontSize: 11, color: '#94A3B8' },
  generateButton: {
    backgroundColor: '#10B981', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  generateButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  promptBox: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    backgroundColor: '#F8FAFC', maxHeight: 200,
  },
  promptScroll: { padding: 12 },
  promptText: { fontSize: 12, color: '#475569', lineHeight: 18 },
  copyButton: {
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center',
  },
  copyButtonText: { color: '#166534', fontSize: 14, fontWeight: '600' },
});
