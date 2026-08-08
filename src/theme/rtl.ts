/**
 * مساعدات تخطيط عربية — تعتمد على اتجاه اللغة (RTL).
 */
import type { FlexStyle, TextStyle, ViewStyle } from 'react-native';

/** بداية السطر وفق اتجاه الحاوية */
export const arabicTextStyle: TextStyle = {
  writingDirection: 'rtl',
};

export const arabicTitleStyle: TextStyle = {
  writingDirection: 'rtl',
};

export const arabicContainerStyle: ViewStyle = {
  alignItems: 'stretch',
  width: '100%',
};

export const arabicContentWindowStyle: ViewStyle = {
  width: '100%',
};

/** محاذاة نص لبداية السطر حسب اللغة */
export function rtlTextAlign(isRTL: boolean): 'left' | 'right' {
  return isRTL ? 'right' : 'left';
}

export function rtlWriting(isRTL: boolean): 'rtl' | 'ltr' {
  return isRTL ? 'rtl' : 'ltr';
}

/** صف أيقونة+نص يتبع اتجاه اللغة */
export function rtlRow(isRTL: boolean): FlexStyle['flexDirection'] {
  return isRTL ? 'row-reverse' : 'row';
}

export function rtlTextStyle(isRTL: boolean): TextStyle {
  return {
    textAlign: rtlTextAlign(isRTL),
    writingDirection: rtlWriting(isRTL),
  };
}

export function rtlAlignItems(isRTL: boolean): FlexStyle['alignItems'] {
  return isRTL ? 'flex-end' : 'flex-start';
}

export function rtlSelf(isRTL: boolean): FlexStyle['alignSelf'] {
  return isRTL ? 'flex-end' : 'flex-start';
}
