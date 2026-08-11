import { Audio } from 'expo-av';
import { AppState, Platform } from 'react-native';

let unlocked = Platform.OS !== 'web';
let unlockBound = false;
let lastPlayedAt = 0;

function bindWebUnlock() {
  if (Platform.OS !== 'web' || unlockBound || typeof window === 'undefined') {
    return;
  }
  unlockBound = true;
  const unlock = () => {
    unlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
}

bindWebUnlock();

/**
 * نغمة قصيرة لرسالة خاصة واردة.
 * على الويب تحتاج تفاعلاً سابقاً من المستخدم (قيود المتصفح).
 */
export async function playPrivateMessageTone(): Promise<void> {
  if (AppState.currentState !== 'active') return;
  if (Platform.OS === 'web' && !unlocked) return;

  const now = Date.now();
  if (now - lastPlayedAt < 1200) return;
  lastPlayedAt = now;

  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
    const { sound } = await Audio.Sound.createAsync(
      require('../../assets/sounds/private-message.wav'),
      { shouldPlay: true, volume: 0.85 }
    );
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        void sound.unloadAsync();
      }
    });
  } catch {
    // لا نكسر تدفق الرسائل إن فشل الصوت
  }
}
