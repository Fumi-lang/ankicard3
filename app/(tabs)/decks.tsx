import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDeck } from '../../src/hooks/useDeck';
import { DeckCard } from '../../src/components/DeckCard';
import { getDueCards } from '../../src/services/database';
import { selectTodayCards } from '../../src/services/cardSelector';
import { exportSelectedDecks } from '../../src/services/deckExporter';
import {
  readMemoryFlowFile,
  importDeckFromExport,
  importMultiDeckFromExport,
  importFromAnki,
} from '../../src/services/deckImporter';
import { parseAnkiFile } from '../../src/services/ankiImporter';
import { SUPPORTED_LANGUAGES } from '../../src/utils/speechLocale';
import type { Deck, AppLanguage } from '../../src/types';
import { useSettingsStore } from '../../src/stores/settingsStore';

// ── モード型 ────────────────────────────────────────────────────────────────────

type ScreenMode = 'normal' | 'export';

// ── インポートプレビュー ──────────────────────────────────────────────────────────

interface ImportPreviewDeck {
  name:      string;
  cardCount: number;
}

interface ImportPreview {
  type:       'memoryflow' | 'anki';
  decks:      ImportPreviewDeck[];
  /** Anki 専用: 警告メッセージ */
  warnings?:  string[];
  /** 解析済みデータ（インポート実行時に使用）*/
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData:    any;
}

// ── メインコンポーネント ────────────────────────────────────────────────────────

/** デッキ一覧画面 */
export default function DecksScreen() {
  const { t } = useTranslation();
  const { decks, isLoading, fetchDecks, createDeck, deleteDeck } = useDeck();
  const { appLanguage } = useSettingsStore();

  // ── due カウント ────────────────────────────────────────────────────────────
  const [dueCounts,   setDueCounts]   = useState<Record<string, number>>({});
  /** 今日出題予定枚数（selectTodayCards による上限 / Mode A/B 適用後）*/
  const [todayCounts, setTodayCounts] = useState<Record<string, number>>({});

  // ── 画面モード ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<ScreenMode>('normal');
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());

  // ── アクションシート ────────────────────────────────────────────────────────
  const [showActionSheet, setShowActionSheet] = useState(false);

  // ── エクスポート確認モーダル ────────────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState(false);

  // ── デッキ作成モーダル ──────────────────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [deckName, setDeckName] = useState('');
  const [description, setDescription] = useState('');
  // 言語はデフォルト「未設定」: ユーザーが明示的に選んだ場合のみ設定
  const [sourceLang, setSourceLang] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<string | null>(null);
  const [dailyLimitInput, setDailyLimitInput] = useState('');

  // ── インポートプレビューモーダル ────────────────────────────────────────────
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // ── ファイル入力 ref ────────────────────────────────────────────────────────
  const jsonInputRef  = useRef<HTMLInputElement | null>(null);
  const ankiInputRef  = useRef<HTMLInputElement | null>(null);

  // ── 初期化 ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchDecks().then(loadDueCounts);
    // Web 用 hidden file input を DOM に追加
    if (typeof document !== 'undefined') {
      const json = document.createElement('input');
      json.type   = 'file';
      json.accept = '.json';
      json.style.display = 'none';
      json.onchange = (e) => handleJsonFileChosen((e.target as HTMLInputElement).files?.[0] ?? null);
      document.body.appendChild(json);
      jsonInputRef.current = json;

      const anki = document.createElement('input');
      anki.type   = 'file';
      anki.accept = '.apkg,.colpkg';
      anki.style.display = 'none';
      anki.onchange = (e) => handleAnkiFileChosen((e.target as HTMLInputElement).files?.[0] ?? null);
      document.body.appendChild(anki);
      ankiInputRef.current = anki;

      return () => {
        document.body.removeChild(json);
        document.body.removeChild(anki);
      };
    }
  }, []);

  const loadDueCounts = async () => {
    const dueCounts:   Record<string, number> = {};
    const todayCounts: Record<string, number> = {};

    // getDueCards(undefined) で全件取得 → deckId でグループ化して各デッキに配布
    // これにより N 回の DB クエリが 1 回に削減される
    const allDue = await getDueCards();
    const dueByDeck: Record<string, typeof allDue> = {};
    for (const card of allDue) {
      (dueByDeck[card.deckId] ??= []).push(card);
    }

    for (const deck of decks) {
      const cards = dueByDeck[deck.id] ?? [];
      dueCounts[deck.id]   = cards.length;
      todayCounts[deck.id] = selectTodayCards(deck, cards).ordered.length;
    }

    setDueCounts(dueCounts);
    setTodayCounts(todayCounts);
  };

  useEffect(() => {
    if (decks.length > 0) loadDueCounts();
  }, [decks]);

  // ── デッキ作成 ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!deckName.trim()) return;
    const dailyLimit = dailyLimitInput.trim()
      ? (parseInt(dailyLimitInput.trim(), 10) || null)
      : null;
    await createDeck({ name: deckName.trim(), description, sourceLang, targetLang, dailyLimit });
    setDeckName('');
    setDescription('');
    setDailyLimitInput('');
    setShowCreateModal(false);
  };

  // ── デッキ削除 ─────────────────────────────────────────────────────────────
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

  // ── エクスポートモード ─────────────────────────────────────────────────────
  const enterExportMode = () => {
    setMode('export');
    setSelectedDeckIds(new Set());
    setShowActionSheet(false);
  };

  const exitExportMode = () => {
    setMode('normal');
    setSelectedDeckIds(new Set());
  };

  const toggleDeckSelect = (deckId: string) => {
    setSelectedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) next.delete(deckId);
      else next.add(deckId);
      return next;
    });
  };

  const handleExport = (includeProgress: boolean) => {
    const ids = Array.from(selectedDeckIds);
    if (ids.length === 0) return;
    exportSelectedDecks(ids, includeProgress)
      .then(() => exitExportMode())
      .catch((e: unknown) => Alert.alert('エラー', String(e)));
  };

  const showExportOptions = () => {
    if (selectedDeckIds.size === 0) return;
    setShowExportModal(true);
  };

  // ── MemoryFlow インポート ───────────────────────────────────────────────────
  const openJsonFilePicker = () => {
    setShowActionSheet(false);
    if (jsonInputRef.current) {
      jsonInputRef.current.value = '';
      jsonInputRef.current.click();
    }
  };

  const handleJsonFileChosen = async (file: File | null) => {
    if (!file) return;
    const result = await readMemoryFlowFile(file);
    if (!result) {
      Alert.alert(t('deck.importFailed'), t('deck.importInvalidFile'));
      return;
    }
    let decksPreview: ImportPreviewDeck[];
    if (result.format === 'v1') {
      decksPreview = [{ name: result.data.deck.name, cardCount: result.data.cards.length }];
    } else {
      decksPreview = result.data.decks.map((d) => ({
        name:      d.deck.name,
        cardCount: d.cards.length,
      }));
    }
    setImportPreview({ type: 'memoryflow', decks: decksPreview, rawData: result });
  };

  // ── Anki インポート ────────────────────────────────────────────────────────
  const openAnkiFilePicker = () => {
    setShowActionSheet(false);
    if (ankiInputRef.current) {
      ankiInputRef.current.value = '';
      ankiInputRef.current.click();
    }
  };

  const handleAnkiFileChosen = async (file: File | null) => {
    if (!file) return;
    setIsImporting(true);
    try {
      const result = await parseAnkiFile(file);
      const decksPreview: ImportPreviewDeck[] = result.decks.map((d) => ({
        name:      d.name,
        cardCount: d.cards.length,
      }));
      setImportPreview({
        type:     'anki',
        decks:    decksPreview,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
        rawData:  result,
      });
    } catch (e: unknown) {
      Alert.alert(t('deck.importFailed'), String(e));
    } finally {
      setIsImporting(false);
    }
  };

  // ── インポート実行 ─────────────────────────────────────────────────────────
  const handleImportConfirm = async () => {
    if (!importPreview) return;
    setIsImporting(true);
    try {
      if (importPreview.type === 'memoryflow') {
        const fileData = importPreview.rawData;
        if (fileData.format === 'v1') {
          await importDeckFromExport(fileData.data, 'add_new');
        } else {
          await importMultiDeckFromExport(fileData.data, 'add_new');
        }
      } else {
        // Anki: 言語は null で作成（インポート後にデッキ設定で個別設定）
        await importFromAnki(importPreview.rawData);
      }
      setImportPreview(null);
      await fetchDecks();
      Alert.alert(t('deck.importSuccess'), '');
    } catch (e: unknown) {
      Alert.alert(t('deck.importFailed'), String(e));
    } finally {
      setIsImporting(false);
    }
  };

  // ── レンダリング ───────────────────────────────────────────────────────────
  const isExportMode = mode === 'export';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      {/* ヘッダー */}
      <View style={styles.header}>
        {isExportMode ? (
          <>
            <TouchableOpacity onPress={exitExportMode} style={styles.headerBtn}>
              <Text style={styles.headerBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <Text style={styles.title}>{t('deck.exportSelectMode')}</Text>
            <View style={styles.headerBtn} />
          </>
        ) : (
          <>
            <Text style={styles.title}>{t('tabs.decks')}</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => setShowActionSheet(true)}
              >
                <Text style={styles.iconButtonText}>⇅</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setShowCreateModal(true)}
              >
                <Text style={styles.addButtonText}>+</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* デッキ一覧 */}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {decks.length === 0 && !isLoading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t('deck.noDecks')}</Text>
          </View>
        ) : (
          decks.map((deck) => (
            <View key={deck.id} style={styles.deckRow}>
              {isExportMode && (
                <TouchableOpacity
                  style={styles.checkbox}
                  onPress={() => toggleDeckSelect(deck.id)}
                >
                  <View style={[
                    styles.checkboxInner,
                    selectedDeckIds.has(deck.id) && styles.checkboxChecked,
                  ]}>
                    {selectedDeckIds.has(deck.id) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              )}
              <View style={styles.deckCardWrap}>
                <DeckCard
                  deck={deck}
                  dueCount={dueCounts[deck.id] ?? 0}
                  todayCount={todayCounts[deck.id] ?? null}
                  onPress={() => isExportMode
                    ? toggleDeckSelect(deck.id)
                    : router.push(`/deck/${deck.id}`)
                  }
                  onStudy={() => router.push(`/deck/study/${deck.id}`)}
                  onDelete={() => handleDelete(deck)}
                />
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* エクスポートモード: 下部ボタン */}
      {isExportMode && (
        <View style={styles.exportFooter}>
          <TouchableOpacity
            style={[
              styles.exportConfirmButton,
              selectedDeckIds.size === 0 && styles.disabled,
            ]}
            onPress={showExportOptions}
            disabled={selectedDeckIds.size === 0}
          >
            <Text style={styles.exportConfirmText}>
              {t('deck.exportSelectedCount', { count: selectedDeckIds.size })}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ローディングオーバーレイ（Anki 解析中）*/}
      {isImporting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      )}

      {/* アクションシート */}
      {showActionSheet && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setShowActionSheet(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.actionSheet}
            onPress={(e) => e.stopPropagation()}
          >
            <TouchableOpacity style={styles.actionItem} onPress={enterExportMode}>
              <Text style={styles.actionItemText}>📤 {t('deck.export')}</Text>
            </TouchableOpacity>
            <View style={styles.actionSeparator} />
            <TouchableOpacity style={styles.actionItem} onPress={openJsonFilePicker}>
              <Text style={styles.actionItemText}>{t('deck.importMemoryFlow')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionItem} onPress={openAnkiFilePicker}>
              <Text style={styles.actionItemText}>{t('deck.importAnki')}</Text>
            </TouchableOpacity>
            <View style={styles.actionSeparator} />
            <TouchableOpacity
              style={styles.actionCancelItem}
              onPress={() => setShowActionSheet(false)}
            >
              <Text style={styles.actionCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* エクスポート確認モーダル */}
      <Modal
        visible={showExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowExportModal(false)}
      >
        {/* 背景タップでは閉じない（onPress なし）*/}
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>📦 {t('deck.export')}</Text>
            <Text style={styles.alertMsg}>
              {appLanguage === 'en'
                ? 'Include study progress in export?'
                : '学習進捗を含めてエクスポートしますか？'}
            </Text>
            <View style={styles.alertActions}>
              <TouchableOpacity
                style={styles.alertSecondaryBtn}
                onPress={() => { setShowExportModal(false); handleExport(false); }}
              >
                <Text style={styles.alertSecondaryText}>{t('deck.exportWithoutProgress')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertPrimaryBtn}
                onPress={() => { setShowExportModal(false); handleExport(true); }}
              >
                <Text style={styles.alertPrimaryText}>{t('deck.exportWithProgress')}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.alertCancelBtn}
              onPress={() => setShowExportModal(false)}
            >
              <Text style={styles.alertCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* インポートプレビューモーダル */}
      <Modal
        visible={importPreview !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setImportPreview(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{t('deck.importPreviewTitle')}</Text>

            {/* デッキリスト */}
            <ScrollView style={styles.previewDeckList} showsVerticalScrollIndicator={false}>
              {importPreview?.decks.map((d, i) => (
                <View key={i} style={styles.previewDeckRow}>
                  <Text style={styles.previewDeckName} numberOfLines={1}>{d.name}</Text>
                  <Text style={styles.previewDeckCount}>
                    {t('deck.importCardsFound', { count: d.cardCount })}
                  </Text>
                </View>
              ))}
            </ScrollView>

            {/* Anki インポート: 言語は null で作成（インポート後にデッキ設定で個別設定）*/}
            {importPreview?.type === 'anki' && (
              <View style={styles.ankiNote}>
                <Text style={styles.ankiNoteText}>
                  {appLanguage === 'en'
                    ? '⚙️ Language settings can be configured per deck after import.'
                    : '⚙️ 言語設定はインポート後、各デッキの設定画面で個別に行えます。'}
                </Text>
              </View>
            )}

            {/* 警告 */}
            {importPreview?.warnings && importPreview.warnings.length > 0 && (
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>
                  ⚠️ {t('deck.importAnkiWarnings')}
                </Text>
                {importPreview.warnings.slice(0, 3).map((w, i) => (
                  <Text key={i} style={styles.warningText}>{w}</Text>
                ))}
              </View>
            )}

            {/* ボタン */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setImportPreview(null)}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.importButton}
                onPress={handleImportConfirm}
                disabled={isImporting}
              >
                {isImporting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <Text style={styles.importButtonText}>{t('deck.doImport')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

            <Text style={styles.inputLabel}>{t('deck.targetLang')}</Text>
            <LangPicker value={targetLang} onChange={setTargetLang} appLanguage={appLanguage} />

            <Text style={styles.inputLabel}>{t('deck.sourceLang')}</Text>
            <LangPicker value={sourceLang} onChange={setSourceLang} appLanguage={appLanguage} />

            <Text style={styles.inputLabel}>{t('deck.dailyLimit')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('deck.dailyLimitPlaceholder')}
              value={dailyLimitInput}
              onChangeText={setDailyLimitInput}
              keyboardType="numeric"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => { setShowCreateModal(false); setDeckName(''); }}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.importButton, !deckName.trim() && styles.disabled]}
                onPress={handleCreate}
                disabled={!deckName.trim()}
              >
                <Text style={styles.importButtonText}>{t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── LangPicker コンポーネント ───────────────────────────────────────────────────

/** 言語選択チップ。「未設定」選択肢付き（null を選択可能）*/
const LangPicker: React.FC<{
  value:       string | null;
  onChange:    (v: string | null) => void;
  appLanguage: AppLanguage;
}> = ({ value, onChange, appLanguage }) => {
  const notSetLabel = appLanguage === 'en' ? 'Not set' : '未設定';
  return (
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
};

// ── スタイル ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: '#F8FAFC' },
  header:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  headerBtn: { minWidth: 60 },
  headerBtnText: { fontSize: 15, color: '#4F46E5' },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  title:   { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  iconButton: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center',
  },
  iconButtonText: { fontSize: 18, color: '#4F46E5' },
  addButton: {
    backgroundColor: '#4F46E5', width: 36, height: 36,
    borderRadius: 18, alignItems: 'center', justifyContent: 'center',
  },
  addButtonText: { color: '#FFFFFF', fontSize: 22, lineHeight: 26 },
  container: { flex: 1 },
  content:   { padding: 16, gap: 12, paddingBottom: 80 },
  empty:     { paddingVertical: 60, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  // デッキ行
  deckRow:     { flexDirection: 'row', alignItems: 'center' },
  checkbox:    { padding: 4, marginRight: 8 },
  checkboxInner: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  checkmark: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  deckCardWrap: { flex: 1 },

  // エクスポートフッター
  exportFooter: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: '#FFFFFF',
    borderTopWidth: 1, borderTopColor: '#F1F5F9',
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 6,
  },
  exportConfirmButton: {
    backgroundColor: '#4F46E5', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  exportConfirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  // ローディングオーバーレイ
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center', gap: 12,
    zIndex: 100,
  },
  loadingText: { fontSize: 14, color: '#64748B' },

  // アクションシート
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  actionSheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 8, paddingBottom: 24,
  },
  actionItem: { padding: 16 },
  actionItemText: { fontSize: 15, color: '#1E293B', fontWeight: '500' },
  actionSeparator: { height: 1, backgroundColor: '#F1F5F9', marginHorizontal: 8 },
  actionCancelItem: { padding: 16, alignItems: 'center' },
  actionCancelText: { fontSize: 15, color: '#94A3B8' },

  // モーダル共通
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, gap: 12, maxHeight: '90%',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  input: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    padding: 12, fontSize: 14, color: '#1E293B',
  },
  inputLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: {
    flex: 1, borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  cancelText: { color: '#64748B', fontSize: 15 },
  importButton: {
    flex: 1, backgroundColor: '#4F46E5', borderRadius: 10,
    padding: 14, alignItems: 'center',
  },
  importButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },

  // インポートプレビュー
  previewDeckList: { maxHeight: 180 },
  previewDeckRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  previewDeckName:  { fontSize: 14, color: '#1E293B', flex: 1, marginRight: 8 },
  previewDeckCount: { fontSize: 12, color: '#64748B' },

  // Anki インポート注記
  ankiNote: {
    backgroundColor: '#F0F9FF', borderRadius: 8, padding: 10,
    borderLeftWidth: 3, borderLeftColor: '#0EA5E9',
  },
  ankiNoteText: { fontSize: 12, color: '#0369A1' },
  langPicker: { height: 40 },
  langChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#F1F5F9', marginRight: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  langChipActive:     { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  langChipText:       { fontSize: 12, color: '#64748B' },
  langChipTextActive: { color: '#4F46E5', fontWeight: '600' },

  // エクスポート確認モーダル（中央配置アラートスタイル）
  alertOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  alertBox: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    padding: 24, width: '85%', maxWidth: 360, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  alertTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  alertMsg: { fontSize: 14, color: '#475569', lineHeight: 20 },
  alertActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  alertSecondaryBtn: {
    flex: 1, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  alertSecondaryText: { color: '#64748B', fontWeight: '600', fontSize: 13 },
  alertPrimaryBtn: {
    flex: 1, backgroundColor: '#4F46E5', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center',
  },
  alertPrimaryText: { color: '#FFFFFF', fontWeight: '600', fontSize: 13 },
  alertCancelBtn: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10,
    paddingVertical: 11, alignItems: 'center', backgroundColor: '#FFFFFF',
  },
  alertCancelText: { color: '#94A3B8', fontWeight: '500', fontSize: 13 },

  // 警告ボックス
  warningBox: {
    backgroundColor: '#FFF7ED', borderRadius: 10, padding: 12,
    borderLeftWidth: 3, borderLeftColor: '#F97316', gap: 4,
  },
  warningTitle: { fontSize: 13, fontWeight: '700', color: '#9A3412' },
  warningText:  { fontSize: 11, color: '#7C2D12' },
});
