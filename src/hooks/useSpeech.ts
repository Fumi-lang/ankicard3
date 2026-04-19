import { useState, useCallback } from 'react';
import { toSpeechLocale } from '../utils/speechLocale';
import { useSettingsStore } from '../stores/settingsStore';

interface UseSpeechReturn {
  speak: (text: string) => void;
  stop: () => void;
  isSpeaking: boolean;
  isSupported: boolean;
}

/** Web Speech API（SpeechSynthesis）を使った音声読み上げフック */
export function useSpeech(targetLang: string): UseSpeechReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speechRate = useSettingsStore((s) => s.speechRate);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const speak = useCallback(
    (text: string) => {
      if (!isSupported) return;
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = toSpeechLocale(targetLang);
      utterance.rate = speechRate;
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
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
