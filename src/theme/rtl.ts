/**
 * مساعدات تخطيط عربية — تعتمد على I18nManager RTL للتطبيق.
 * لا تستخدم محاذاة يمين ثابتة عبر الخط.
 */
import type { TextStyle, ViewStyle } from 'react-native';

/** بداية السطر (يمين عند RTL) — وفق سلوك React Native مع swapLeftAndRight */
export const arabicTextStyle: TextStyle = {
  textAlign: 'left',
};

export const arabicTitleStyle: TextStyle = {
  textAlign: 'left',
};

export const arabicContainerStyle: ViewStyle = {
  alignItems: 'flex-start',
  width: '100%',
};

export const arabicContentWindowStyle: ViewStyle = {
  width: '100%',
};
