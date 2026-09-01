import { Platform, Vibration } from 'react-native';

/** ردّة لمس خفيفة عند الضغط — بدون تبعية إضافية (web = no-op). */
export function lightTapHaptic() {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate(10);
  } catch {
    // ignore
  }
}
