import { useState, useCallback, useEffect } from 'react';
import { toSpeechLocale } from '../utils/speechLocale';
import { useSettingsStore } from '../stores/settingsStore';

interface UseSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

/**
 * アプリ起動時に一度だけエンジンを初期化する。
 * Chrome の初回無音バグ・長時間放置後のエンジン停止に対応。
 */
let engineInitialized = false;
function initSpeechEngine(): void {
  if (engineInitialized) return;
  engineInitialized = true;
  try {
    const dummy = new SpeechSynthesisUtterance('');
    dummy.volume = 0;
    window.speechSynthesis.speak(dummy);
    window.speechSynthesis.cancel();
  } catch {
    // 初期化失敗は無視
  }
}

/**
 * 対象ロケールから「自然音声」を優先選択する。
 *
 * macOS の音声リストには novelty（特殊効果）音声が多数混在しており、
 * 単純に voices.find() すると "Albert", "Bad News", "Bahh" 等が
 * アルファベット順で先頭にヒットしてしまう。
 *
 * 自然音声の見分け方:
 *   1. 名前に "(Language (Country))" が含まれる → macOS enhanced 音声（確実に自然）
 *      例: "Eddy (English (United States))", "Kyoko (Japanese (Japan))"
 *   2. 名前が "Google " で始まる → Google の自然音声
 *      例: "Google US English", "Google 日本語"
 *   3. その他の localService 音声（Samantha, Daniel 等）→ 自然なものが多いが novelty も混在
 *
 * 優先度: enhanced(1) > Google(2) > その他 localService(3) > フォールバック
 * 各優先度内で: 完全一致(locale) > 前方一致(langCode)
 */
function findNaturalVoice(
  voices: SpeechSynthesisVoice[],
  locale: string
): SpeechSynthesisVoice | null {
  const langPrefix = locale.split('-')[0];
  const isEnhanced = (v: SpeechSynthesisVoice) => /\(.+\)/.test(v.name);
  const isGoogle   = (v: SpeechSynthesisVoice) => v.name.startsWith('Google ');

  return (
    // 優先度1: enhanced 音声（完全一致）
    voices.find((v) => v.lang === locale && isEnhanced(v)) ??
    // 優先度2: Google 音声（完全一致）
    voices.find((v) => v.lang === locale && isGoogle(v)) ??
    // 優先度3: その他 localService（完全一致）
    voices.find((v) => v.lang === locale && v.localService) ??
    // 優先度4: 完全一致（非localService を含む全て）
    voices.find((v) => v.lang === locale) ??
    // 優先度5: enhanced 音声（前方一致）
    voices.find((v) => v.lang.startsWith(langPrefix) && isEnhanced(v)) ??
    // 優先度6: Google 音声（前方一致）
    voices.find((v) => v.lang.startsWith(langPrefix) && isGoogle(v)) ??
    // 優先度7: その他（前方一致）
    voices.find((v) => v.lang.startsWith(langPrefix)) ??
    null
  );
}

/** Web Speech API（SpeechSynthesis）を使った音声読み上げフック */
export function useSpeech(targetLang: string): UseSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRate = useSettingsStore((s) => s.speechRate);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (isSupported) initSpeechEngine();
  }, [isSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;

      const locale = toSpeechLocale(targetLang);

      // 前の発話を完全停止し、エンジンが安定するまで待つ
      window.speechSynthesis.cancel();

      setTimeout(() => {
        // utterance は毎回新規生成（再利用するとエンジンが汚染される）
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = locale;
        utterance.rate = speechRate;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
          // interrupted は連続押し時の正常動作なので無視
          if (e.error !== 'interrupted') {
            console.warn('[useSpeech] Speech error:', e.error);
          }
          setIsSpeaking(false);
        };

        const assignVoiceAndSpeak = () => {
          const voices = window.speechSynthesis.getVoices();
          const voice = findNaturalVoice(voices, locale);
          if (voice) utterance.voice = voice;
          window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length > 0) {
          assignVoiceAndSpeak();
        } else {
          // voices が非同期ロード中なら voiceschanged を一度だけ待つ
          window.speechSynthesis.onvoiceschanged = () => {
            window.speechSynthesis.onvoiceschanged = null;
            assignVoiceAndSpeak();
          };
        }
      }, 150);
    },
    [targetLang, speechRate, isSupported]
  );

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  return { speak, stop, isSpeaking, isSupported };
}
