import { Platform, type ViewStyle } from 'react-native';

/** اتجاه تخطيطي متوافق مع native وweb */
export function layoutDirectionStyle(isRTL: boolean): ViewStyle {
  return {
    flex: 1,
    direction: isRTL ? 'rtl' : 'ltr',
  };
}

export function syncDocumentDirection(isRTL: boolean, lang: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}
