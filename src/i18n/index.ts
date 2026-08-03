import { I18n, type TranslateOptions } from 'i18n-js';
import { I18nManager } from 'react-native';
import { ar, type AppLanguage } from '@/i18n/locales/ar';
import { en } from '@/i18n/locales/en';

export type { AppLanguage } from '@/i18n/locales/ar';
export { LANGUAGE_STORAGE_KEY } from '@/i18n/locales/ar';

export const i18n = new I18n({ ar, en });
i18n.defaultLocale = 'ar';
i18n.locale = 'ar';
i18n.enableFallback = true;

export function setI18nLocale(lang: AppLanguage) {
  i18n.locale = lang;
}

export function t(key: string, options?: TranslateOptions): string {
  return i18n.t(key, options);
}

export function isArabicLocale(lang: AppLanguage = i18n.locale as AppLanguage) {
  return lang === 'ar';
}

export function shouldUseRTL(lang: AppLanguage) {
  return lang === 'ar';
}

/** هل اتجاه التخطيط الحالي يطابق اللغة المطلوبة؟ */
export function rtlMatchesLanguage(lang: AppLanguage) {
  return I18nManager.isRTL === shouldUseRTL(lang);
}
