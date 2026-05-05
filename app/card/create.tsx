import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useCardStore } from '../../src/stores/cardStore';
import { useDeckStore } from '../../src/stores/deckStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { CardFormSelector } from '../../src/components/CardTypeSelector';
import { ClaudeResponseParser } from '../../src/components/ClaudeResponseParser';
import { buildPrompt, parseInputItems, type SceneParam } from '../../src/services/promptBuilder';
import { SCENE_CATEGORIES, REGISTER_CATEGORIES, getSceneCategoryById } from '../../src/utils/sceneCategories';
import { getInitialSRS } from '../../src/services/srs';
import { useTagStore } from '../../src/stores/tagStore';
import type { CardForm, Card, ImportedCardData } from '../../src/types';

type AddMethod = 'manual' | 'claude';

/** cardForm に対応する自動タグ名を返す */
const getAutoTag = (form: CardForm): string => (form === 'cloze' ? '穴埋め' : '単語');

/** カード作成画面（翻訳・穴埋めの2フォーム対応）*/
export default function CreateCardScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { t } = useTranslation();
  const { createCard, createCards } = useCardStore();
  const { decks } = useDeckStore();
  const { defaultSourceLang, defaultTargetLang } = useSettingsStore();
  const { ensureTagIds, sortedTagNames } = useTagStore();

  const deck = decks.find((d) => d.id === deckId);
  const sourceLang = deck?.sourceLang ?? defaultSourceLang;
  const targetLang = deck?.targetLang ?? defaultTargetLang;

  const [method, setMethod] = useState<AddMethod>('manual');
  const [cardForm, setCardForm] = useState<CardForm>('translation');
  const [cardCount, setCardCount] = useState(5);

  // 手動入力
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [memo, setMemo] = useState('');
  // タグ（autoTag を初期値として保持）
  const [tags, setTags] = useState<string[]>([getAutoTag('translation')]);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Claude連携
  const [claudeInput, setClaudeInput] = useState('');
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [parsedCards, setParsedCards] = useState<ImportedCardData[]>([]);

  // シーン選択（Claude連携・穴埋めフォームのみ）
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSubcategory, setSelectedSubcategory] = useState<string | null>(null);
  const [selectedRegister, setSelectedRegister] = useState<string | null>(null);

  /**
   * カード形式変更時: タグ内の autoTag を新フォームのものに入れ替え、
   * Claude 連携ステートをリセットする。
   */
  const handleCardFormChange = (newForm: CardForm) => {
    const oldAutoTag = getAutoTag(cardForm);
    const newAutoTag = getAutoTag(newForm);
    if (oldAutoTag !== newAutoTag) {
      setTags((prev) => {
        const withoutOld = prev.filter((tag) => tag !== oldAutoTag);
        return withoutOld.includes(newAutoTag) ? withoutOld : [newAutoTag, ...withoutOld];
      });
    }
    setCardForm(newForm);
    // プロンプトはフォーム変更で無効になるためリセット
    setGeneratedPrompt('');
    setParsedCards([]);
    setSelectedCategory(null);
    setSelectedSubcategory(null);
    setSelectedRegister(null);
  };

  const handleManualSave = async () => {
    if (!frontText.trim() || !backText.trim() || !deckId) return;
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      // tags ステートがそのまま保存対象（autoTag は初期値として既に含まれている）
      const tagIds = tags.length > 0 ? await ensureTagIds(tags) : undefined;
      const card: Card = {
        id: uuidv4(),
        deckId,
        frontText: frontText.trim(),
        backText: backText.trim(),
        memo: memo.trim() || undefined,
        tagIds,
        source: 'manual',
        ...getInitialSRS(),
        createdAt: now,
        updatedAt: now,
      };
      await createCard(card);
      setFrontText('');
      setBackText('');
      setMemo('');
      // 保存後は autoTag のみに戻す（ユーザー追加タグはクリア）
      setTags([getAutoTag(cardForm)]);
      setTagInput('');
      Alert.alert('', '保存しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePrompt = () => {
    const items = parseInputItems(claudeInput);
    if (items.length === 0) return;
    const scene: SceneParam | undefined =
      cardForm === 'cloze'
        ? { categoryId: selectedCategory, subcategoryId: selectedSubcategory, registerId: selectedRegister }
        : undefined;
    const prompt = buildPrompt(cardForm, items, sourceLang, targetLang, cardCount, scene);
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
      // tags ステートをそのまま使用（autoTag 含む）
      const tagIds = tags.length > 0 ? await ensureTagIds(tags) : undefined;
      const cards: Card[] = parsedCards.map((c) => ({
        id: uuidv4(),
        deckId,
        frontText: c.frontText,
        backText: c.backText,
        extraInfo: {
          ...c.extraInfo,
          ...(cardForm === 'cloze' && selectedCategory
            ? {
                sceneCategoryId: selectedCategory,
                sceneSubcategoryId: selectedSubcategory ?? undefined,
              }
            : {}),
        } as Card['extraInfo'],
        tagIds,
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

  /** タグ入力セクション（手動・Claude 共通）*/
  const renderTagSection = () => {
    const presetTags = sortedTagNames().filter((t2) => !tags.includes(t2));
    return (
      <View style={styles.tagSection}>
        <Text style={styles.inputLabel}>{t('card.tags')}</Text>
        <View style={styles.tagInputRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            value={tagInput}
            onChangeText={setTagInput}
            placeholder={t('card.tagsPlaceholder')}
            placeholderTextColor="#CBD5E1"
            onSubmitEditing={() => {
              const trimmed = tagInput.trim();
              if (trimmed && !tags.includes(trimmed)) {
                setTags([...tags, trimmed]);
              }
              setTagInput('');
            }}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={styles.tagAddButton}
            onPress={() => {
              const trimmed = tagInput.trim();
              if (trimmed && !tags.includes(trimmed)) {
                setTags([...tags, trimmed]);
              }
              setTagInput('');
            }}
          >
            <Text style={styles.tagAddButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        {(tags.length > 0 || presetTags.length > 0) && (
          <View style={styles.tagChips}>
            {/* 設定済みタグ（autoTag も含む）— × で削除可 */}
            {tags.map((tag) => (
              <TouchableOpacity
                key={`set-${tag}`}
                style={styles.tagChip}
                onPress={() => setTags(tags.filter((t2) => t2 !== tag))}
              >
                <Text style={styles.tagChipText}>{tag} ×</Text>
              </TouchableOpacity>
            ))}
            {/* プリセット候補 — タップで追加 */}
            {presetTags.map((tag) => (
              <TouchableOpacity
                key={`preset-${tag}`}
                style={styles.tagPresetChip}
                onPress={() => setTags([...tags, tag])}
              >
                <Text style={styles.tagPresetChipText}>{tag}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
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

        {/* 追加方法タブ（常時表示）*/}
        <View style={styles.methodTabs}>
          <TouchableOpacity
            style={[styles.methodTab, method === 'manual' && styles.methodTabActive]}
            onPress={() => setMethod('manual')}
          >
            <Text style={[styles.methodTabText, method === 'manual' && styles.methodTabTextActive]}>
              {t('card.manual')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.methodTab, method === 'claude' && styles.methodTabActive]}
            onPress={() => setMethod('claude')}
          >
            <Text style={[styles.methodTabText, method === 'claude' && styles.methodTabTextActive]}>
              {t('card.claude')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* カード形式選択（タブの下・共通）*/}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('card.cardForm')}</Text>
          <CardFormSelector selected={cardForm} onChange={handleCardFormChange} />
        </View>

        {/* ── 手動入力フォーム ── */}
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
            {/* メモ（任意）*/}
            <Text style={styles.inputLabel}>{t('card.memo')}</Text>
            <TextInput
              style={[styles.input, styles.memoInput]}
              value={memo}
              onChangeText={setMemo}
              multiline
              numberOfLines={3}
              placeholder={t('card.memoPlaceholder')}
              placeholderTextColor="#CBD5E1"
              textAlignVertical="top"
            />
            {/* タグ（任意）— メモの下・保存ボタンの上 */}
            {renderTagSection()}
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

        {/* ── Claude連携フォーム ── */}
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

            {/* シーン選択（穴埋めカードのみ）*/}
            {cardForm === 'cloze' && (
              <SceneSelector
                selectedCategory={selectedCategory}
                selectedSubcategory={selectedSubcategory}
                selectedRegister={selectedRegister}
                onSelectCategory={(id) => {
                  setSelectedCategory(id);
                  setSelectedSubcategory(null);
                }}
                onSelectSubcategory={setSelectedSubcategory}
                onSelectRegister={setSelectedRegister}
              />
            )}

            {/* タグ（任意）— 生成ボタンの上 */}
            {renderTagSection()}

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
  // 追加方法タブ
  methodTabs: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
  },
  methodTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  methodTabActive: {
    backgroundColor: '#FFFFFF',
  },
  methodTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  methodTabTextActive: {
    color: '#4F46E5',
  },
  section: { gap: 10 },
  tagSection: { gap: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  inputLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#1E293B', backgroundColor: '#FFFFFF',
  },
  multilineInput: { minHeight: 90, textAlignVertical: 'top' },
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
  memoInput: { minHeight: 80, textAlignVertical: 'top' },
  tagInputRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  tagAddButton: {
    backgroundColor: '#4F46E5', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
  },
  tagAddButtonText: { color: '#FFFFFF', fontSize: 18, lineHeight: 20 },
  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: {
    backgroundColor: '#EEF2FF', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  tagChipText: { fontSize: 12, color: '#4F46E5', fontWeight: '500' },
  tagPresetChip: {
    backgroundColor: 'transparent', borderRadius: 12,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: '#CBD5E1',
  },
  tagPresetChipText: { fontSize: 12, color: '#64748B' },
  // シーン選択
  sceneSection: { gap: 6 },
  sceneLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sceneLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  sceneChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sceneChip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 14, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: 'transparent',
  },
  sceneChipActive: { backgroundColor: '#EEF2FF', borderColor: '#7C3AED' },
  sceneChipText: { fontSize: 12, color: '#64748B' },
  sceneChipTextActive: { color: '#7C3AED', fontWeight: '600' },
  sceneDescription: { fontSize: 11, color: '#94A3B8', lineHeight: 15 },
});

/** シーン選択コンポーネント（第一分類 + サブカテゴリー + 文体の3段階）*/
const SceneSelector: React.FC<{
  selectedCategory: string | null;
  selectedSubcategory: string | null;
  selectedRegister: string | null;
  onSelectCategory: (id: string | null) => void;
  onSelectSubcategory: (id: string | null) => void;
  onSelectRegister: (id: string | null) => void;
}> = ({ selectedCategory, selectedSubcategory, selectedRegister, onSelectCategory, onSelectSubcategory, onSelectRegister }) => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language as 'ja' | 'en';

  const activeCategory = selectedCategory ? getSceneCategoryById(selectedCategory) : undefined;

  return (
    <View style={styles.sceneSection}>
      {/* 第一分類 */}
      <Text style={styles.sceneLabel}>{t('claude.sceneLabel')}</Text>
      <View style={styles.sceneChips}>
        <TouchableOpacity
          style={[styles.sceneChip, !selectedCategory && styles.sceneChipActive]}
          onPress={() => onSelectCategory(null)}
        >
          <Text style={[styles.sceneChipText, !selectedCategory && styles.sceneChipTextActive]}>
            {t('claude.sceneAuto')}
          </Text>
        </TouchableOpacity>
        {SCENE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.sceneChip, selectedCategory === cat.id && styles.sceneChipActive]}
            onPress={() => onSelectCategory(cat.id)}
          >
            <Text style={[styles.sceneChipText, selectedCategory === cat.id && styles.sceneChipTextActive]}>
              {cat.label[lang]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 選択中カテゴリーの説明 */}
      {activeCategory && (
        <Text style={styles.sceneDescription}>{activeCategory.description[lang]}</Text>
      )}

      {/* サブカテゴリーチップ（第一分類選択時のみ）*/}
      {activeCategory && (
        <View style={styles.sceneChips}>
          <TouchableOpacity
            style={[styles.sceneChip, !selectedSubcategory && styles.sceneChipActive]}
            onPress={() => onSelectSubcategory(null)}
          >
            <Text style={[styles.sceneChipText, !selectedSubcategory && styles.sceneChipTextActive]}>
              {t('claude.sceneAuto')}
            </Text>
          </TouchableOpacity>
          {activeCategory.subcategories.map((sub) => (
            <TouchableOpacity
              key={sub.id}
              style={[styles.sceneChip, selectedSubcategory === sub.id && styles.sceneChipActive]}
              onPress={() => onSelectSubcategory(sub.id)}
            >
              <Text style={[styles.sceneChipText, selectedSubcategory === sub.id && styles.sceneChipTextActive]}>
                {sub.label[lang]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* 文体（レジスター）チップ */}
      <Text style={[styles.sceneLabel, { marginTop: 6 }]}>{t('claude.registerLabel')}</Text>
      <View style={styles.sceneChips}>
        <TouchableOpacity
          style={[styles.sceneChip, !selectedRegister && styles.sceneChipActive]}
          onPress={() => onSelectRegister(null)}
        >
          <Text style={[styles.sceneChipText, !selectedRegister && styles.sceneChipTextActive]}>
            {t('claude.sceneAuto')}
          </Text>
        </TouchableOpacity>
        {REGISTER_CATEGORIES.map((reg) => (
          <TouchableOpacity
            key={reg.id}
            style={[styles.sceneChip, selectedRegister === reg.id && styles.sceneChipActive]}
            onPress={() => onSelectRegister(selectedRegister === reg.id ? null : reg.id)}
          >
            <Text style={[styles.sceneChipText, selectedRegister === reg.id && styles.sceneChipTextActive]}>
              {reg.label[lang]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
