import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * اتجاه تدفق التخطيط.
 * على الويب: لا تُمرَّر style.direction (RN Web يرفضها ويُغرق الـ console).
 * الاتجاه الفعلي على الويب عبر document.documentElement.dir.
 */
export function flowDirection(isRTL: boolean): ViewStyle {
  if (Platform.OS === 'web') return {};
  return { direction: isRTL ? 'rtl' : 'ltr' };
}

/** اتجاه تخطيطي متوافق مع native وweb */
export function layoutDirectionStyle(isRTL: boolean): ViewStyle {
  return {
    flex: 1,
    ...flowDirection(isRTL),
  };
}

/** محاذاة بداية السطر حسب اللغة (قيمة فيزيائية للمكوّنات الواعية) */
export function startTextAlign(isRTL: boolean): 'left' | 'right' {
  return isRTL ? 'right' : 'left';
}

/**
 * ستايل نص كتلي للشاشات التي تستخدم Text الخام.
 * مهم: textAlign يبقى 'left' (= بداية منطقية) ليحوّله Text shim حسب اللغة.
 * لا تستخدم right هنا وإلا سيُعكس في وضع RTL.
 */
export function blockTextStyle(isRTL: boolean): TextStyle {
  return {
    width: '100%',
    textAlign: 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
  };
}

export function contentDirectionStyle(isRTL: boolean): ViewStyle {
  return flowDirection(isRTL);
}

export function syncDocumentDirection(isRTL: boolean, lang: string) {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
  document.documentElement.lang = lang;
}
