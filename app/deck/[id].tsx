import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, Modal, TextInput, Platform, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCardStore } from '../../src/stores/cardStore';
import { useDeckStore } from '../../src/stores/deckStore';
import { getDeckById, getDueCards } from '../../src/services/database';
import { selectTodayCards } from '../../src/services/cardSelector';
import { SpeechButton } from '../../src/components/SpeechButton';
import { SUPPORTED_LANGUAGES } from '../../src/utils/speechLocale';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useTagStore } from '../../src/stores/tagStore';
import { getTagDisplayName, getTagDisplayNameFromEntity } from '../../src/utils/tagDisplay';
import { updateDeckCardsTextInputAnswer } from '../../src/services/database';
import type { Card, Deck, AppLanguage } from '../../src/types';

/** デッキ詳細・カード一覧画面 */
export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { cards, fetchCards, deleteCard, updateCard, bulkUpdateCards, bulkDeleteCards } = useCardStore();
  const { updateDeck } = useDeckStore();
  const { appLanguage } = useSettingsStore();
  const { getTagsByIds, ensureTagIds, sortedTagNames } = useTagStore();

  const [deck, setDeck] = useState<Deck | null>(null);
  /** フィルタ中のタグ ID（null = 全件表示）*/
  const [filterTagId, setFilterTagId] = useState<string | null>(null);

  // ── カード編集モーダル ──────────────────────────────────────────────────────
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [editFront, setEditFront] = useState('');
  const [editBack, setEditBack] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState('');
  const [editTextInputAnswer, setEditTextInputAnswer] = useState(false);

  // ── 複数選択モード ──────────────────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 一括操作モーダル（統合）
  const [bulkEditVisible, setBulkEditVisible] = useState(false);
  const [bulkEditMemoText, setBulkEditMemoText] = useState('');
  const [bulkEditTagInput, setBulkEditTagInput] = useState('');
  const [bulkEditPendingTags, setBulkEditPendingTags] = useState<string[]>([]);
  const [bulkEditTextInput, setBulkEditTextInput] = useState(false);

  const [bulkDeleteVisible, setBulkDeleteVisible] = useState(false);

  // ── デッキ設定モーダル（9項目）─────────────────────────────────────────────
  const [showDeckSettings, setShowDeckSettings] = useState(false);
  const [settingName, setSettingName] = useState('');
  const [settingDesc, setSettingDesc] = useState('');
  const [settingSourceLang, setSettingSourceLang] = useState<string | null>(null);
  const [settingTargetLang, setSettingTargetLang] = useState<string | null>(null);
  const [settingFrontSpeechLang, setSettingFrontSpeechLang] = useState<string | null>(null);
  const [settingBackSpeechLang, setSettingBackSpeechLang] = useState<string | null>(null);
  const [settingDailyLimit, setSettingDailyLimit] = useState('');
  /** 8. 復習を上限に含めるか（Mode B） */
  const [settingIncludeReview, setSettingIncludeReview] = useState(false);
  /** 9. 復習カードの割合（%）Mode B のみ有効 */
  const [settingReviewRatio, setSettingReviewRatio] = useState(50);
  /** 10. テキスト入力回答 */
  const [settingTextInputAnswer, setSettingTextInputAnswer] = useState(false);
  /** テキスト入力回答 ON への切り替え確認ダイアログ表示フラグ */
  const [textInputWarningVisible, setTextInputWarningVisible] = useState(false);

  // ── 今日のカード数（詳細画面表示用）──────────────────────────────────────
  const [todayReviewCount, setTodayReviewCount] = useState<number | null>(null);
  const [todayNewCount,    setTodayNewCount]    = useState<number | null>(null);

  useEffect(() => {
    if (id) {
      fetchCards(id);
      getDeckById(id).then(async (d) => {
        if (!d) return;
        setDeck(d);
        // 今日のカード数を計算して表示
        const due = await getDueCards(id);
        const result = selectTodayCards(d, due);
        setTodayReviewCount(result.reviewCount);
        setTodayNewCount(result.newCount);
      });
    }
  }, [id]);

  // デッキ全体に含まれるユニークなタグエンティティ（表示・フィルタチップ用）
  const allTagIds  = Array.from(new Set(cards.flatMap((c) => c.tagIds ?? [])));
  const allTagObjs = getTagsByIds(allTagIds);

  const filteredCards = cards
    .filter((c) => !filterTagId || (c.tagIds ?? []).includes(filterTagId));

  // ── 複数選択モード操作 ─────────────────────────────────────────────────────
  const toggleSelect = (cardId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const allVisibleSelected =
    filteredCards.length > 0 && filteredCards.every((c) => selectedIds.has(c.id));

  const handleToggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredCards.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        filteredCards.forEach((c) => next.add(c.id));
        return next;
      });
    }
  };

  const handleExitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  // 一括編集モーダルを開く
  const handleOpenBulkEdit = () => {
    const selected = cards.filter((c) => selectedIds.has(c.id));
    const allOn = selected.length > 0 && selected.every((c) => c.textInputAnswer === true);
    setBulkEditTextInput(allOn);
    setBulkEditMemoText('');
    setBulkEditTagInput('');
    setBulkEditPendingTags([]);
    setBulkEditVisible(true);
  };

  // 即時: メモを一括削除（モーダルを閉じない）
  const handleBulkClearMemo = async () => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(t('deck.clearMemo'))
      : false;
    if (!confirmed) return;
    const targetCards = cards.filter((c) => selectedIds.has(c.id));
    if (targetCards.length === 0) return;
    const now = new Date().toISOString();
    await bulkUpdateCards(targetCards.map((c) => ({ ...c, memo: undefined, updatedAt: now })));
  };

  // 即時: タグを一括削除（モーダルを閉じない）
  const handleBulkClearTags = async () => {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(t('deck.clearTags'))
      : false;
    if (!confirmed) return;
    const targetCards = cards.filter((c) => selectedIds.has(c.id));
    if (targetCards.length === 0) return;
    const now = new Date().toISOString();
    await bulkUpdateCards(targetCards.map((c) => ({ ...c, tagIds: undefined, updatedAt: now })));
  };

  // 即時: テキスト入力回答を一括切り替え（モーダルを閉じない）
  const handleBulkTextInputToggle = async (val: boolean) => {
    if (val) {
      const confirmed = typeof window !== 'undefined'
        ? window.confirm(t('deck.textInputAnswerWarningMsg'))
        : false;
      if (!confirmed) return;
    }
    const targetCards = cards.filter((c) => selectedIds.has(c.id));
    if (targetCards.length === 0) return;
    const now = new Date().toISOString();
    await bulkUpdateCards(targetCards.map((c) => ({ ...c, textInputAnswer: val, updatedAt: now })));
    setBulkEditTextInput(val);
  };

  // 完了: 保留中のメモ追記・タグ追加を適用してモーダルを閉じる
  const handleBulkEditDone = async () => {
    const targetCards = cards.filter((c) => selectedIds.has(c.id));
    const hasMemo = bulkEditMemoText.trim().length > 0;
    const hasTag  = bulkEditPendingTags.length > 0;
    if (targetCards.length > 0 && (hasMemo || hasTag)) {
      const pendingTagIds = hasTag ? await ensureTagIds(bulkEditPendingTags) : [];
      const now = new Date().toISOString();
      const updated = targetCards.map((c) => {
        const existing = c.memo ?? '';
        const newMemo = hasMemo
          ? (existing ? `${existing}\n${bulkEditMemoText.trim()}` : bulkEditMemoText.trim())
          : c.memo;
        const existingTagIds = c.tagIds ?? [];
        const newTagIds = hasTag
          ? Array.from(new Set([...existingTagIds, ...pendingTagIds]))
          : existingTagIds;
        return {
          ...c,
          memo:   newMemo || undefined,
          tagIds: newTagIds.length > 0 ? newTagIds : undefined,
          updatedAt: now,
        };
      });
      await bulkUpdateCards(updated);
    }
    setBulkEditVisible(false);
    setBulkEditMemoText('');
    setBulkEditPendingTags([]);
    setBulkEditTagInput('');
  };

  // 一括削除
  const handleBulkDeleteConfirm = async () => {
    const ids = Array.from(selectedIds);
    await bulkDeleteCards(ids);
    setSelectedIds(new Set());
    setBulkDeleteVisible(false);
  };

  // ── カード削除 ─────────────────────────────────────────────────────────────
  const handleDelete = (card: Card) => {
    if (typeof window !== 'undefined') {
      if (window.confirm(t('card.confirmDelete'))) deleteCard(card.id);
      return;
    }
    Alert.alert(t('card.delete'), t('card.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => deleteCard(card.id) },
    ]);
  };

  // ── カード編集 ─────────────────────────────────────────────────────────────
  const handleOpenEdit = (card: Card) => {
    setEditingCard(card);
    setEditFront(card.frontText);
    setEditBack(card.backText);
    setEditMemo(card.memo ?? '');
    // tagIds → タグ名配列に変換して編集フォームに表示
    setEditTags(getTagsByIds(card.tagIds ?? []).map((t) => t.name));
    setEditTagInput('');
    setEditTextInputAnswer(card.textInputAnswer ?? false);
  };

  const handleSaveEdit = async () => {
    if (!editingCard) return;
    // タグ名 → タグID に変換（存在しないタグは自動作成）
    const tagIds = editTags.length > 0 ? await ensureTagIds(editTags) : undefined;
    await updateCard({
      ...editingCard,
      frontText: editFront.trim(),
      backText:  editBack.trim(),
      memo:      editMemo.trim() || undefined,
      tagIds,
      textInputAnswer: editTextInputAnswer,
      updatedAt: new Date().toISOString(),
    });
    setEditingCard(null);
  };

  // ── デッキ設定モーダルを開く ────────────────────────────────────────────────
  const openDeckSettings = () => {
    if (!deck) return;
    setSettingName(deck.name);
    setSettingDesc(deck.description ?? '');
    setSettingSourceLang(deck.sourceLang ?? null);
    setSettingTargetLang(deck.targetLang ?? null);
    setSettingFrontSpeechLang(deck.frontSpeechLang ?? null);
    setSettingBackSpeechLang(deck.backSpeechLang ?? null);
    setSettingDailyLimit(deck.dailyLimit != null ? String(deck.dailyLimit) : '');
    setSettingIncludeReview(deck.includeReviewInDailyLimit ?? false);
    setSettingReviewRatio(deck.reviewRatio ?? 50);
    setSettingTextInputAnswer(deck.textInputAnswer ?? false);
    setShowDeckSettings(true);
  };

  // ── デッキ設定保存 ─────────────────────────────────────────────────────────
  const handleSaveDeckSettings = async () => {
    if (!deck) return;
    if (!settingName.trim()) return;
    const newDailyLimit = settingDailyLimit.trim()
      ? (parseInt(settingDailyLimit.trim(), 10) || null)
      : null;
    const prevTextInputAnswer = deck.textInputAnswer ?? false;
    const updated: Deck = {
      ...deck,
      name:                       settingName.trim(),
      description:                settingDesc.trim() || undefined,
      sourceLang:                 settingSourceLang,
      targetLang:                 settingTargetLang,
      frontSpeechLang:            settingFrontSpeechLang,
      backSpeechLang:             settingBackSpeechLang,
      dailyLimit:                 newDailyLimit,
      includeReviewInDailyLimit:  settingIncludeReview,
      reviewRatio:                settingReviewRatio,
      textInputAnswer:            settingTextInputAnswer,
      // extraSettings から clozeAnswerSpeechLang を除外（廃止済み）
      extraSettings:    deck.extraSettings
        ? { ...deck.extraSettings, clozeAnswerSpeechLang: undefined }
        : undefined,
      updatedAt: new Date().toISOString(),
    };
    await updateDeck(updated);
    // textInputAnswer 設定が変化した場合、デッキ内全カードを一括更新
    if (settingTextInputAnswer !== prevTextInputAnswer && id) {
      await updateDeckCardsTextInputAnswer(id, settingTextInputAnswer);
      // ストアを再同期（一括更新後）
      await fetchCards(id);
    }
    setDeck(updated);
    // 設定変更後は今日のカード数を再計算
    if (id) {
      const due = await getDueCards(id);
      const result = selectTodayCards(updated, due);
      setTodayReviewCount(result.reviewCount);
      setTodayNewCount(result.newCount);
    }
    setShowDeckSettings(false);
  };

  if (!deck) return null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* ヘッダー */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>{t('common.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{deck.name}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.selectModeBtn, selectMode && styles.selectModeBtnActive]}
            onPress={() => selectMode ? handleExitSelectMode() : setSelectMode(true)}
          >
            <Text style={[styles.selectModeBtnText, selectMode && styles.selectModeBtnTextActive]}>
              {selectMode ? '✓' : '☑'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openDeckSettings} style={styles.menuButton}>
            <Text style={styles.menuText}>⋮</Text>
          </TouchableOpacity>
        </View>
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

      {/* 今日のカード数 */}
      {todayReviewCount !== null && todayNewCount !== null && (
        <View style={styles.todayCountBar}>
          <Text style={styles.todayCountText}>
            {t('deck.todayCardCount', {
              total: todayReviewCount + todayNewCount,
              review: todayReviewCount,
              newCards: todayNewCount,
            })}
          </Text>
        </View>
      )}

      {/* タグフィルタ（タグエンティティの ID でフィルタ、名前を表示）*/}
      {allTagObjs.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagFilterBar}>
          <TouchableOpacity
            style={[styles.tagFilterChip, !filterTagId && styles.tagFilterChipActive]}
            onPress={() => setFilterTagId(null)}
          >
            <Text style={[styles.tagFilterText, !filterTagId && styles.tagFilterTextActive]}>
              # {t('deck.filterAll')}
            </Text>
          </TouchableOpacity>
          {allTagObjs.map((tag) => (
            <TouchableOpacity
              key={tag.id}
              style={[styles.tagFilterChip, filterTagId === tag.id && styles.tagFilterChipActive]}
              onPress={() => setFilterTagId(filterTagId === tag.id ? null : tag.id)}
            >
              <Text style={[styles.tagFilterText, filterTagId === tag.id && styles.tagFilterTextActive]}>
                # {getTagDisplayNameFromEntity(tag, appLanguage)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* カード一覧
          FlatList の CellRenderer は onLayout 計測が flexWrap reflow より先に走るため
          タグ行の高さが低く記録され、スペーサーに潰されて表示が切れる問題がある。
          Web のみのアプリなのでブラウザネイティブスクロール (ScrollView + map) を使用。 */}
      <ScrollView style={styles.listScroll} contentContainerStyle={styles.list}>
        {filteredCards.length === 0 ? (
          <Text style={styles.emptyText}>{t('common.empty')}</Text>
        ) : (
          filteredCards.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.cardRow, selectMode && selectedIds.has(item.id) && styles.cardRowSelected]}
              activeOpacity={selectMode ? 0.7 : 1}
              onPress={() => { if (selectMode) toggleSelect(item.id); }}
            >
              {/* チェックボックス（選択モード時のみ）*/}
              {selectMode && (
                <View style={[styles.checkbox, selectedIds.has(item.id) && styles.checkboxChecked]}>
                  {selectedIds.has(item.id) && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
              )}
              <View style={styles.cardTexts}>
                {/* 上段: 表示上の表面 (backText) — frontSpeechLang で読み上げ */}
                <View style={styles.textRow}>
                  <Text style={styles.targetText} numberOfLines={2}>{item.backText}</Text>
                  <SpeechButton text={item.backText} lang={deck.frontSpeechLang} size="small" />
                </View>
                {/* 下段: 表示上の裏面 (frontText) — backSpeechLang で読み上げ */}
                <View style={styles.textRow}>
                  <Text style={styles.sourceText} numberOfLines={2}>{item.frontText}</Text>
                  <SpeechButton text={item.frontText} lang={deck.backSpeechLang} size="small" />
                </View>
                {item.memo ? (
                  <Text style={styles.memoPreview} numberOfLines={1}>
                    📝 {item.memo.length > 30 ? item.memo.slice(0, 30) + '…' : item.memo}
                  </Text>
                ) : null}
                {item.tagIds && item.tagIds.length > 0 && (
                  <View style={styles.cardTagRow}>
                    {getTagsByIds(item.tagIds).map((tag) => (
                      <View key={tag.id} style={styles.cardTag}>
                        <Text style={styles.cardTagText}># {getTagDisplayNameFromEntity(tag, appLanguage)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              {/* 通常モード: 編集・削除ボタン */}
              {!selectMode && (
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => handleOpenEdit(item)} style={styles.editButton}>
                    <Text style={styles.editText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteButton}>
                    <Text style={styles.deleteText}>×</Text>
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* カード編集モーダル */}
      <Modal visible={editingCard !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{t('card.edit')}</Text>
            <Text style={styles.inputLabel}>{t('card.backTranslation')}</Text>
            <TextInput
              style={styles.textInput}
              value={editBack}
              onChangeText={setEditBack}
              multiline
            />
            <Text style={styles.inputLabel}>{t('card.frontTranslation')}</Text>
            <TextInput
              style={styles.textInput}
              value={editFront}
              onChangeText={setEditFront}
              multiline
            />
            <Text style={styles.inputLabel}>{t('card.memo')}</Text>
            <TextInput
              style={[styles.textInput, styles.memoInput]}
              value={editMemo}
              onChangeText={setEditMemo}
              multiline
              placeholder={t('card.memoPlaceholder')}
              placeholderTextColor="#CBD5E1"
            />
            <Text style={styles.inputLabel}>{t('card.tags')}</Text>
            <View style={styles.editTagInputRow}>
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                value={editTagInput}
                onChangeText={setEditTagInput}
                placeholder={t('card.tagsPlaceholder')}
                placeholderTextColor="#CBD5E1"
                onSubmitEditing={() => {
                  const trimmed = editTagInput.trim();
                  if (trimmed && !editTags.includes(trimmed)) setEditTags([...editTags, trimmed]);
                  setEditTagInput('');
                }}
                returnKeyType="done"
              />
              <TouchableOpacity
                style={styles.editTagAddButton}
                onPress={() => {
                  const trimmed = editTagInput.trim();
                  if (trimmed && !editTags.includes(trimmed)) setEditTags([...editTags, trimmed]);
                  setEditTagInput('');
                }}
              >
                <Text style={styles.editTagAddButtonText}>+</Text>
              </TouchableOpacity>
            </View>
            {(() => {
              // 全タグ候補（デフォルト先頭・使用頻度順）から設定済みを除いたもの
              const presetTags = sortedTagNames().filter((t2) => !editTags.includes(t2));
              if (editTags.length === 0 && presetTags.length === 0) return null;
              return (
                <View style={styles.editTagChips}>
                  {editTags.map((tag) => (
                    <TouchableOpacity
                      key={`set-${tag}`}
                      style={styles.editTagChip}
                      onPress={() => setEditTags(editTags.filter((t2) => t2 !== tag))}
                    >
                      <Text style={styles.editTagChipText}>{getTagDisplayName(tag, appLanguage)} ×</Text>
                    </TouchableOpacity>
                  ))}
                  {presetTags.map((tag) => (
                    <TouchableOpacity
                      key={`preset-${tag}`}
                      style={styles.editTagPresetChip}
                      onPress={() => setEditTags([...editTags, tag])}
                    >
                      <Text style={styles.editTagPresetChipText}>{getTagDisplayName(tag, appLanguage)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              );
            })()}
            {/* テキスト入力回答トグル */}
            <View style={styles.toggleRow}>
              <Text style={styles.inputLabel}>{t('card.textInputAnswer')}</Text>
              <Switch
                value={editTextInputAnswer}
                onValueChange={setEditTextInputAnswer}
                trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                thumbColor={editTextInputAnswer ? '#4F46E5' : '#FFFFFF'}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingCard(null)}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveEdit}>
                <Text style={styles.modalSaveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* デッキ設定モーダル（7項目）*/}
      <Modal visible={showDeckSettings} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.settingsScroll}
            contentContainerStyle={styles.settingsScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>{t('deck.settings')}</Text>

            {/* 1. デッキ名 */}
            <Text style={styles.inputLabel}>{t('deck.deckName')}</Text>
            <TextInput
              style={styles.textInput}
              value={settingName}
              onChangeText={setSettingName}
              placeholder={t('deck.deckName')}
              placeholderTextColor="#CBD5E1"
            />

            {/* 2. 説明文 */}
            <Text style={styles.inputLabel}>{t('deck.description')}</Text>
            <TextInput
              style={[styles.textInput, styles.memoInput]}
              value={settingDesc}
              onChangeText={setSettingDesc}
              placeholder={t('deck.description')}
              placeholderTextColor="#CBD5E1"
              multiline
              textAlignVertical="top"
            />

            {/* 3. 学習言語 */}
            <Text style={styles.inputLabel}>{t('deck.targetLang')}</Text>
            <LangPicker
              value={settingTargetLang}
              onChange={setSettingTargetLang}
              appLanguage={appLanguage}
              notSetLabel={t('deck.langNotSet')}
            />

            {/* 4. 母語 */}
            <Text style={styles.inputLabel}>{t('deck.sourceLang')}</Text>
            <LangPicker
              value={settingSourceLang}
              onChange={setSettingSourceLang}
              appLanguage={appLanguage}
              notSetLabel={t('deck.langNotSet')}
            />

            {/* 5. 表の音声言語 */}
            <Text style={styles.inputLabel}>{t('deck.frontSpeechLang')}</Text>
            <LangPicker
              value={settingFrontSpeechLang}
              onChange={setSettingFrontSpeechLang}
              appLanguage={appLanguage}
              notSetLabel={t('deck.langNotSet')}
            />

            {/* 6. 裏の音声言語 */}
            <Text style={styles.inputLabel}>{t('deck.backSpeechLang')}</Text>
            <LangPicker
              value={settingBackSpeechLang}
              onChange={setSettingBackSpeechLang}
              appLanguage={appLanguage}
              notSetLabel={t('deck.langNotSet')}
            />

            {/* 7. 1日の学習上限 */}
            <Text style={styles.inputLabel}>{t('deck.dailyLimit')}</Text>
            <TextInput
              style={styles.textInput}
              value={settingDailyLimit}
              onChangeText={setSettingDailyLimit}
              placeholder={t('deck.dailyLimitPlaceholder')}
              placeholderTextColor="#CBD5E1"
              keyboardType="numeric"
            />

            {/* 8. 復習カードを上限に含める（Mode B トグル） */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabelBlock}>
                <Text style={styles.inputLabel}>{t('deck.includeReviewInLimit')}</Text>
                <Text style={styles.toggleHint}>
                  {settingIncludeReview
                    ? t('deck.includeReviewHintOn')
                    : t('deck.includeReviewHintOff')}
                </Text>
              </View>
              <Switch
                value={settingIncludeReview}
                onValueChange={setSettingIncludeReview}
                trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                thumbColor={settingIncludeReview ? '#4F46E5' : '#FFFFFF'}
              />
            </View>

            {/* 9. 復習割合スライダー（Mode B のみ表示） */}
            {settingIncludeReview && (
              <View style={styles.sliderBlock}>
                <Text style={styles.inputLabel}>
                  {t('deck.reviewRatio')}: {settingReviewRatio}%
                </Text>
                {Platform.OS === 'web' ? (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={settingReviewRatio}
                    onChange={(e) => setSettingReviewRatio(Number(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: '#4F46E5',
                      height: 20,
                      cursor: 'pointer',
                    }}
                  />
                ) : (
                  // ネイティブ向けフォールバック（将来は @react-native-community/slider 等に差し替え）
                  <View style={styles.sliderFallback}>
                    <TouchableOpacity
                      style={styles.sliderStepBtn}
                      onPress={() => setSettingReviewRatio(Math.max(0, settingReviewRatio - 5))}
                    >
                      <Text style={styles.sliderStepText}>−</Text>
                    </TouchableOpacity>
                    <Text style={styles.sliderFallbackValue}>{settingReviewRatio}%</Text>
                    <TouchableOpacity
                      style={styles.sliderStepBtn}
                      onPress={() => setSettingReviewRatio(Math.min(100, settingReviewRatio + 5))}
                    >
                      <Text style={styles.sliderStepText}>+</Text>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabelText}>
                    {t('deck.sliderReviewLabel')}: {settingReviewRatio}%
                  </Text>
                  <Text style={styles.sliderLabelText}>
                    {t('deck.sliderNewLabel')}: {100 - settingReviewRatio}%
                  </Text>
                </View>
              </View>
            )}

            {/* 10. テキスト入力回答 */}
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabelBlock}>
                <Text style={styles.inputLabel}>{t('deck.textInputAnswer')}</Text>
                <Text style={styles.toggleHint}>{t('deck.textInputAnswerHint')}</Text>
              </View>
              <Switch
                value={settingTextInputAnswer}
                onValueChange={(val) => {
                  if (val && !settingTextInputAnswer) {
                    // OFF → ON: 警告ダイアログを表示
                    setTextInputWarningVisible(true);
                  } else {
                    // ON → OFF: 警告なしで切り替え
                    setSettingTextInputAnswer(false);
                  }
                }}
                trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                thumbColor={settingTextInputAnswer ? '#4F46E5' : '#FFFFFF'}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowDeckSettings(false)}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSaveBtn, !settingName.trim() && styles.btnDisabled]}
                onPress={handleSaveDeckSettings}
                disabled={!settingName.trim()}
              >
                <Text style={styles.modalSaveText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* テキスト入力回答 ON 警告ダイアログ */}
      <Modal visible={textInputWarningVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>⚠️ {t('deck.textInputAnswerWarningTitle')}</Text>
            <Text style={styles.alertMsg}>{t('deck.textInputAnswerWarningMsg')}</Text>
            <View style={styles.alertActions}>
              <TouchableOpacity
                style={styles.alertCancelBtn}
                onPress={() => setTextInputWarningVisible(false)}
              >
                <Text style={styles.alertCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertConfirmBtn}
                onPress={() => {
                  setSettingTextInputAnswer(true);
                  setTextInputWarningVisible(false);
                }}
              >
                <Text style={styles.alertConfirmText}>{t('deck.textInputAnswerWarningConfirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 選択モード アクションバー ────────────────────────────────────────── */}
      {selectMode && (
        <View style={styles.actionBar}>
          <View style={styles.actionBarTop}>
            <TouchableOpacity style={styles.selectAllBtn} onPress={handleToggleSelectAll}>
              <Text style={styles.selectAllBtnText}>
                {allVisibleSelected ? t('deck.deselectAll') : t('deck.selectAll')}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectedCountText}>
              {t('deck.selectedCount', { count: selectedIds.size })}
            </Text>
          </View>
          {selectedIds.size > 0 && (
            <View style={styles.actionBarButtons}>
              <TouchableOpacity
                style={[styles.actionBarBtn, styles.actionBarBtnPrimary]}
                onPress={handleOpenBulkEdit}
              >
                <Text style={[styles.actionBarBtnText, styles.actionBarBtnPrimaryText]}>
                  {t('deck.bulkEdit')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBarBtn, styles.actionBarBtnDanger]}
                onPress={() => setBulkDeleteVisible(true)}
              >
                <Text style={[styles.actionBarBtnText, styles.actionBarBtnDangerText]}>
                  {t('common.delete')}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* ── 一括編集モーダル（統合）─────────────────────────────────────────────── */}
      <Modal visible={bulkEditVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <ScrollView
            style={styles.settingsScroll}
            contentContainerStyle={styles.settingsScrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.modalTitle}>{t('deck.bulkEdit')} ({selectedIds.size})</Text>

            {/* メモ */}
            <View style={styles.bulkSection}>
              <Text style={styles.inputLabel}>{t('card.memo')}</Text>
              <TextInput
                style={[styles.textInput, styles.memoInput]}
                value={bulkEditMemoText}
                onChangeText={setBulkEditMemoText}
                placeholder={t('card.memoPlaceholder')}
                placeholderTextColor="#CBD5E1"
                multiline
                textAlignVertical="top"
              />
              <TouchableOpacity style={styles.bulkDangerBtn} onPress={handleBulkClearMemo}>
                <Text style={styles.bulkDangerBtnText}>{t('deck.clearMemo')}</Text>
              </TouchableOpacity>
            </View>

            {/* タグ */}
            <View style={styles.bulkSection}>
              <Text style={styles.inputLabel}>{t('card.tags')}</Text>
              <View style={styles.editTagInputRow}>
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={bulkEditTagInput}
                  onChangeText={setBulkEditTagInput}
                  placeholder={t('card.tagsPlaceholder')}
                  placeholderTextColor="#CBD5E1"
                  onSubmitEditing={() => {
                    const trimmed = bulkEditTagInput.trim();
                    if (trimmed && !bulkEditPendingTags.includes(trimmed)) {
                      setBulkEditPendingTags([...bulkEditPendingTags, trimmed]);
                    }
                    setBulkEditTagInput('');
                  }}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.editTagAddButton}
                  onPress={() => {
                    const trimmed = bulkEditTagInput.trim();
                    if (trimmed && !bulkEditPendingTags.includes(trimmed)) {
                      setBulkEditPendingTags([...bulkEditPendingTags, trimmed]);
                    }
                    setBulkEditTagInput('');
                  }}
                >
                  <Text style={styles.editTagAddButtonText}>+</Text>
                </TouchableOpacity>
              </View>
              {(() => {
                const presetTags = sortedTagNames().filter((n) => !bulkEditPendingTags.includes(n));
                if (bulkEditPendingTags.length === 0 && presetTags.length === 0) return null;
                return (
                  <View style={styles.editTagChips}>
                    {bulkEditPendingTags.map((tag) => (
                      <TouchableOpacity
                        key={`pending-${tag}`}
                        style={styles.editTagChip}
                        onPress={() => setBulkEditPendingTags(bulkEditPendingTags.filter((n) => n !== tag))}
                      >
                        <Text style={styles.editTagChipText}>{getTagDisplayName(tag, appLanguage)} ×</Text>
                      </TouchableOpacity>
                    ))}
                    {presetTags.map((tag) => (
                      <TouchableOpacity
                        key={`preset-${tag}`}
                        style={styles.editTagPresetChip}
                        onPress={() => setBulkEditPendingTags([...bulkEditPendingTags, tag])}
                      >
                        <Text style={styles.editTagPresetChipText}>{getTagDisplayName(tag, appLanguage)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                );
              })()}
              <TouchableOpacity style={styles.bulkDangerBtn} onPress={handleBulkClearTags}>
                <Text style={styles.bulkDangerBtnText}>{t('deck.clearTags')}</Text>
              </TouchableOpacity>
            </View>

            {/* テキスト入力回答 */}
            <View style={styles.toggleRow}>
              <Text style={styles.inputLabel}>{t('deck.textInputAnswer')}</Text>
              <Switch
                value={bulkEditTextInput}
                onValueChange={handleBulkTextInputToggle}
                trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                thumbColor={bulkEditTextInput ? '#4F46E5' : '#FFFFFF'}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setBulkEditVisible(false);
                  setBulkEditMemoText('');
                  setBulkEditPendingTags([]);
                  setBulkEditTagInput('');
                }}
              >
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleBulkEditDone}>
                <Text style={styles.modalSaveText}>{t('common.done')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* ── 一括削除確認モーダル ─────────────────────────────────────────────── */}
      <Modal visible={bulkDeleteVisible} transparent animationType="fade">
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>{t('common.confirm')}</Text>
            <Text style={styles.alertMsg}>
              {t('deck.bulkDeleteConfirm', { count: selectedIds.size })}
            </Text>
            <View style={styles.alertActions}>
              <TouchableOpacity style={styles.alertCancelBtn} onPress={() => setBulkDeleteVisible(false)}>
                <Text style={styles.alertCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.alertDeleteBtn} onPress={handleBulkDeleteConfirm}>
                <Text style={styles.alertDeleteText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── LangPicker コンポーネント ───────────────────────────────────────────────────

/** 言語選択チップ（「未設定」オプション付き）*/
const LangPicker: React.FC<{
  value:        string | null;
  onChange:     (v: string | null) => void;
  appLanguage:  AppLanguage;
  notSetLabel:  string;
}> = ({ value, onChange, appLanguage, notSetLabel }) => (
  <View style={styles.langPicker}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      {/* 未設定チップ */}
      <TouchableOpacity
        style={[styles.langChip, value === null && styles.langChipActive]}
        onPress={() => onChange(null)}
      >
        <Text style={[styles.langChipText, value === null && styles.langChipTextActive]}>
          {notSetLabel}
        </Text>
      </TouchableOpacity>
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

// ── スタイル ────────────────────────────────────────────────────────────────────

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
  listScroll: { flex: 1 },
  list: { padding: 12, gap: 8 },
  cardRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  cardTexts: { flex: 1, gap: 4 },
  textRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  targetText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1E293B' },
  sourceText: { flex: 1, fontSize: 13, color: '#64748B' },
  cardActions: { flexDirection: 'column', alignItems: 'center', gap: 2 },
  editButton: { padding: 4 },
  editText: { fontSize: 14 },
  deleteButton: { padding: 4 },
  deleteText: { fontSize: 18, color: '#CBD5E1' },
  emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 60, fontSize: 14 },
  memoPreview: { fontSize: 11, color: '#94A3B8', fontStyle: 'italic', marginTop: 2 },
  cardTagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  cardTag: { backgroundColor: '#EEF2FF', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  cardTagText: { fontSize: 10, color: '#4F46E5', fontWeight: '500' },
  tagFilterBar: { paddingHorizontal: 12, paddingVertical: 6, maxHeight: 38, backgroundColor: '#F8FAFC', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tagFilterChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#F1F5F9', marginRight: 6 },
  tagFilterChipActive: { backgroundColor: '#EEF2FF' },
  tagFilterText: { fontSize: 11, color: '#64748B' },
  tagFilterTextActive: { color: '#4F46E5', fontWeight: '600' },

  // カード編集モーダル
  editTagInputRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  editTagAddButton: { backgroundColor: '#4F46E5', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  editTagAddButtonText: { color: '#FFFFFF', fontSize: 18, lineHeight: 20 },
  editTagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  editTagChip: { backgroundColor: '#EEF2FF', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#C7D2FE' },
  editTagChipText: { fontSize: 12, color: '#4F46E5', fontWeight: '500' },
  editTagPresetChip: { backgroundColor: 'transparent', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#CBD5E1' },
  editTagPresetChipText: { fontSize: 12, color: '#64748B' },

  // モーダル共通
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 12,
  },
  // デッキ設定モーダル: スクロール対応
  settingsScroll: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '92%',
  },
  settingsScrollContent: {
    padding: 24, gap: 10, paddingBottom: 32,
  },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
  inputLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  textInput: {
    borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#1E293B', minHeight: 44,
  },
  memoInput: { minHeight: 72, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  modalCancelText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  modalSaveBtn: {
    flex: 1, backgroundColor: '#4F46E5', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  modalSaveText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  btnDisabled: { opacity: 0.5 },

  // 今日のカード数バー
  todayCountBar: {
    backgroundColor: '#F0F9FF',
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#E0F2FE',
  },
  todayCountText: { fontSize: 12, color: '#0369A1', fontWeight: '500' },

  // toggle 行
  toggleRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: 8,
    paddingVertical: 4,
  },
  toggleLabelBlock: { flex: 1, gap: 2 },
  toggleHint: { fontSize: 11, color: '#94A3B8' },

  // スライダーブロック
  sliderBlock: { gap: 8 },
  sliderFallback: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 16,
  },
  sliderStepBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center',
  },
  sliderStepText: { fontSize: 20, color: '#4F46E5', fontWeight: '700', lineHeight: 24 },
  sliderFallbackValue: { fontSize: 18, fontWeight: '700', color: '#1E293B', minWidth: 52, textAlign: 'center' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  sliderLabelText: { fontSize: 11, color: '#64748B' },

  // 言語選択チップ
  langPicker: { height: 40 },
  langChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14,
    backgroundColor: '#F1F5F9', marginRight: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  langChipActive:     { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  langChipText:       { fontSize: 12, color: '#64748B' },
  langChipTextActive: { color: '#4F46E5', fontWeight: '600' },

  // ── ヘッダー右側エリア ──────────────────────────────────────────────────────
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  selectModeBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  selectModeBtnActive: { backgroundColor: '#EEF2FF' },
  selectModeBtnText: { fontSize: 16, color: '#64748B' },
  selectModeBtnTextActive: { color: '#4F46E5', fontWeight: '700' },

  // ── カード行（選択状態）──────────────────────────────────────────────────────
  cardRowSelected: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', borderWidth: 1 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 2, borderColor: '#CBD5E1',
    alignItems: 'center', justifyContent: 'center',
    marginRight: 4, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  checkboxMark: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

  // ── 選択モード アクションバー ────────────────────────────────────────────────
  actionBar: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#E2E8F0',
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  actionBarTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectAllBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#EEF2FF', borderRadius: 8,
  },
  selectAllBtnText: { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
  selectedCountText: { fontSize: 13, color: '#64748B' },
  actionBarButtons: { flexDirection: 'row', gap: 6 },
  actionBarBtn: {
    flex: 1, paddingVertical: 8, alignItems: 'center',
    backgroundColor: '#F1F5F9', borderRadius: 8,
  },
  actionBarBtnText: { fontSize: 11, color: '#475569', fontWeight: '600' },
  actionBarBtnPrimary: { backgroundColor: '#EEF2FF' },
  actionBarBtnPrimaryText: { color: '#4F46E5' },
  actionBarBtnDanger: { backgroundColor: '#FEE2E2' },
  actionBarBtnDangerText: { color: '#DC2626' },

  // ── アラート・確認ダイアログ ─────────────────────────────────────────────────
  alertOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  alertBox: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 24, width: '85%', gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  alertTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  alertMsg: { fontSize: 13, color: '#475569', lineHeight: 19 },
  alertActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  alertCancelBtn: {
    flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  alertCancelText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
  alertConfirmBtn: {
    flex: 1, backgroundColor: '#4F46E5', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  alertConfirmText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },
  alertDeleteBtn: {
    flex: 1, backgroundColor: '#DC2626', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  alertDeleteText: { color: '#FFFFFF', fontWeight: '600', fontSize: 14 },

  // ── 一括編集モーダル（統合）──────────────────────────────────────────────────
  bulkSection: { gap: 8 },
  bulkDangerBtn: {
    paddingVertical: 8, paddingHorizontal: 12,
    borderRadius: 8, borderWidth: 1, borderColor: '#FCA5A5',
    alignItems: 'center',
  },
  bulkDangerBtnText: { fontSize: 13, color: '#DC2626', fontWeight: '600' },
});
