import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { useSpeech } from '../hooks/useSpeech';
import { useTranslation } from 'react-i18next';

interface SpeechButtonProps {
  text: string;
  lang: string;
  size?: 'small' | 'medium';
}

/** 音声読み上げボタン（Web Speech API使用）*/
export const SpeechButton: React.FC<SpeechButtonProps> = ({ text, lang, size = 'medium' }) => {
  const { speak, stop, isSpeaking, isSupported } = useSpeech(lang);
  const { t } = useTranslation();

  const handlePress = () => {
    if (isSpeaking) {
      stop();
    } else {
      speak(text);
    }
  };

  if (!isSupported) {
    return (
      <View style={[styles.button, styles.disabled, size === 'small' && styles.small]}>
        <Text style={styles.disabledText} title={t('errors.speechNotSupported')}>
          🔇
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.button, isSpeaking && styles.active, size === 'small' && styles.small]}
      accessibilityLabel={isSpeaking ? '読み上げを停止' : 'テキストを読み上げる'}
    >
      <Text style={[styles.icon, isSpeaking && styles.iconActive]}>
        {isSpeaking ? '🔊' : '🔈'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  active: {
    backgroundColor: '#EEF2FF',
  },
  disabled: {
    opacity: 0.4,
  },
  small: {
    padding: 3,
  },
  icon: {
    fontSize: 18,
  },
  iconActive: {
    // Webではアニメーションを直接CSSで行う
  },
  disabledText: {
    fontSize: 16,
    opacity: 0.4,
  },
});
