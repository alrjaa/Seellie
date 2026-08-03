/**
 * إعداد RTL عند الإقلاع.
 * في Expo Go لا نفرض forceRTL (يسبب علوق/سلوك غير مستقر على Android).
 * الاتجاه الكامل يُطبَّق في الـ native builds عبر LanguageProvider.
 */
import { I18nManager } from 'react-native';
import Constants from 'expo-constants';

try {
  I18nManager.allowRTL(true);
  if (Constants.appOwnership !== 'expo') {
    if (typeof I18nManager.swapLeftAndRightInRTL === 'function') {
      I18nManager.swapLeftAndRightInRTL(true);
    }
  }
} catch {
  // ignore
}

export const isRTL = I18nManager.isRTL;
