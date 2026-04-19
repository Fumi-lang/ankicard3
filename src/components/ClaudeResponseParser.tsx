import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { parseClaudeResponse } from '../services/responseParser';
import type { ImportedCardData } from '../types';
import { ImportPreview } from './ImportPreview';

interface ClaudeResponseParserProps {
  onParsed: (cards: ImportedCardData[]) => void;
  targetLang: string;
  sourceLang: string;
  onSwitchToManual?: () => void;
}

/** Claude回答の貼り付け・解析UI */
export const ClaudeResponseParser: React.FC<ClaudeResponseParserProps> = ({
  onParsed,
  targetLang,
  sourceLang,
  onSwitchToManual,
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [parsedCards, setParsedCards] = useState<ImportedCardData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleAnalyze = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cards = parseClaudeResponse(text);
      setParsedCards(cards);
      onParsed(cards.filter((c) => c.isValid));
    } catch {
      setError(t('errors.jsonParseFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      setText(clipText);
    } catch {
      // クリップボード読み取り失敗時はテキストエリアへの手動貼り付けを案内
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('claude.step3')}</Text>

      {/* クリップボード貼り付けボタン */}
      {typeof navigator !== 'undefined' && 'clipboard' in navigator && (
        <TouchableOpacity style={styles.pasteButton} onPress={handlePaste}>
          <Text style={styles.pasteButtonText}>📋 クリップボードから貼り付け</Text>
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.textInput}
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={8}
        placeholder={t('claude.pasteHint')}
        textAlignVertical="top"
      />

      <Text style={styles.note}>{t('claude.clipboardNote')}</Text>

      <TouchableOpacity
        style={[styles.analyzeButton, !text && styles.disabled]}
        onPress={handleAnalyze}
        disabled={!text || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" size="small" />
        ) : (
          <Text style={styles.analyzeButtonText}>{t('claude.analyze')}</Text>
        )}
      </TouchableOpacity>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          {onSwitchToManual && (
            <TouchableOpacity onPress={onSwitchToManual}>
              <Text style={styles.switchLink}>{t('claude.switchToManual')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {parsedCards && parsedCards.length > 0 && (
        <View style={styles.previewContainer}>
          <Text style={styles.previewTitle}>{t('claude.previewTitle')}</Text>
          <ImportPreview cards={parsedCards} targetLang={targetLang} sourceLang={sourceLang} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  pasteButton: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  pasteButtonText: {
    color: '#166534',
    fontSize: 13,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    minHeight: 120,
    fontSize: 13,
    color: '#1E293B',
    backgroundColor: '#FAFAFA',
  },
  note: {
    fontSize: 11,
    color: '#F59E0B',
    backgroundColor: '#FFFBEB',
    padding: 8,
    borderRadius: 6,
  },
  analyzeButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  analyzeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  errorContainer: {
    backgroundColor: '#FFF1F2',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  errorText: {
    color: '#BE123C',
    fontSize: 13,
  },
  switchLink: {
    color: '#4F46E5',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  previewContainer: {
    gap: 8,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
});
