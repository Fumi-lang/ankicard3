import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  SafeAreaView, Switch, Alert
} from 'react-native';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { SUPPORTED_LANGUAGES } from '../../src/utils/speechLocale';
import { exportAllDecks } from '../../src/services/deckExporter';
import { importDeckFromExport, readDeckExportFile } from '../../src/services/deckImporter';
import { pickFile } from '../../src/services/fileImporter';
import type { AppLanguage } from '../../src/types';

/** 設定画面 */
export default function SettingsScreen() {
  const { t } = useTranslation();
  const {
    appLanguage, setAppLanguage,
    defaultSourceLang, setDefaultSourceLang,
    defaultTargetLang, setDefaultTargetLang,
    autoPlaySpeech, setAutoPlaySpeech,
    speechRate, setSpeechRate,
  } = useSettingsStore();

  const [isExporting, setIsExporting] = useState(false);

  const handleSetLanguage = (lang: AppLanguage) => {
    setAppLanguage(lang);
    i18n.changeLanguage(lang);
  };

  const handleExportAll = async () => {
    setIsExporting(true);
    try {
      await exportAllDecks(true);
    } catch (e) {
      Alert.alert('エラー', String(e));
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportDeck = async () => {
    const file = await pickFile();
    if (!file) return;
    const deckExport = await readDeckExportFile(file);
    if (!deckExport) {
      Alert.alert('エラー', t('errors.invalidFile'));
      return;
    }
    Alert.alert(
      'インポート方法を選択',
      `デッキ「${deckExport.deck.name}」（${deckExport.cards.length}枚）`,
      [
        { text: '新規デッキとして追加', onPress: async () => {
          const result = await importDeckFromExport(deckExport, 'add_new');
          Alert.alert('インポート完了', `${result.cardCount}枚のカードをインポートしました`);
        }},
        { text: '既存デッキにマージ', onPress: async () => {
          const result = await importDeckFromExport(deckExport, 'merge');
          Alert.alert('インポート完了', `${result.cardCount}枚のカードをマージしました`);
        }},
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('tabs.settings')}</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>

        {/* アプリ言語 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.appLanguage')}</Text>
          <View style={styles.card}>
            <View style={styles.langButtons}>
              <TouchableOpacity
                style={[styles.langButton, appLanguage === 'ja' && styles.langButtonActive]}
                onPress={() => handleSetLanguage('ja')}
              >
                <Text style={[styles.langButtonText, appLanguage === 'ja' && styles.langButtonTextActive]}>
                  🇯🇵 {t('settings.japanese')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.langButton, appLanguage === 'en' && styles.langButtonActive]}
                onPress={() => handleSetLanguage('en')}
              >
                <Text style={[styles.langButtonText, appLanguage === 'en' && styles.langButtonTextActive]}>
                  🇺🇸 {t('settings.english')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 音声設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.speech')}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('settings.autoPlaySpeech')}</Text>
              <Switch value={autoPlaySpeech} onValueChange={setAutoPlaySpeech} />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('settings.speechRate')}</Text>
              <Text style={styles.rowValue}>{speechRate.toFixed(2)}</Text>
            </View>
            <View style={styles.sliderTrack}>
              {[0.5, 0.65, 0.85, 1.0, 1.2, 1.5].map((rate) => (
                <TouchableOpacity
                  key={rate}
                  style={[styles.rateButton, Math.abs(speechRate - rate) < 0.05 && styles.rateButtonActive]}
                  onPress={() => setSpeechRate(rate)}
                >
                  <Text style={[styles.rateText, Math.abs(speechRate - rate) < 0.05 && styles.rateTextActive]}>
                    {rate}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* 言語設定 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.langSettings')}</Text>
          <View style={styles.card}>
            <Text style={styles.rowLabel}>{t('settings.defaultSourceLang')}</Text>
            <LangPicker value={defaultSourceLang} onChange={setDefaultSourceLang} appLanguage={appLanguage} />
            <View style={styles.divider} />
            <Text style={styles.rowLabel}>{t('settings.defaultTargetLang')}</Text>
            <LangPicker value={defaultTargetLang} onChange={setDefaultTargetLang} appLanguage={appLanguage} />
          </View>
        </View>

        {/* データ管理 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.dataManagement')}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleExportAll}
              disabled={isExporting}
            >
              <Text style={styles.actionText}>{t('settings.exportAll')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleImportDeck}>
              <Text style={styles.actionText}>{t('settings.importDeck')}</Text>
            </TouchableOpacity>
            <Text style={styles.dataNote}>{t('settings.dataNote')}</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const LangPicker: React.FC<{
  value: string;
  onChange: (v: string) => void;
  appLanguage: AppLanguage;
}> = ({ value, onChange, appLanguage }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ height: 40, marginTop: 8 }}>
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
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#1E293B' },
  container: { flex: 1 },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, gap: 12,
  },
  langButtons: { flexDirection: 'row', gap: 8 },
  langButton: {
    flex: 1, padding: 12, borderRadius: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC',
  },
  langButtonActive: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  langButtonText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  langButtonTextActive: { color: '#4F46E5', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { fontSize: 14, color: '#1E293B', fontWeight: '500' },
  rowValue: { fontSize: 14, color: '#4F46E5', fontWeight: '600' },
  divider: { height: 1, backgroundColor: '#F1F5F9' },
  sliderTrack: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  rateButton: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, backgroundColor: '#F1F5F9',
    borderWidth: 1, borderColor: 'transparent',
  },
  rateButtonActive: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  rateText: { fontSize: 12, color: '#64748B' },
  rateTextActive: { color: '#4F46E5', fontWeight: '600' },
  actionButton: {
    backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
    borderRadius: 10, padding: 14, alignItems: 'center',
  },
  actionText: { fontSize: 14, color: '#4F46E5', fontWeight: '600' },
  dataNote: { fontSize: 11, color: '#F59E0B', lineHeight: 16 },
  langChip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
    backgroundColor: '#F1F5F9', marginRight: 6,
    borderWidth: 1, borderColor: 'transparent',
  },
  langChipActive: { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  langChipText: { fontSize: 12, color: '#64748B' },
  langChipTextActive: { color: '#4F46E5', fontWeight: '600' },
});
