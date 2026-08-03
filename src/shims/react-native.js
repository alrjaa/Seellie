'use strict';

/**
 * App-level react-native shim:
 * - خط Cairo فقط
 * - textAlign:'left' = بداية السطر في وضع RTL (اليمين في العربية)
 *   وفق وثائق Expo Localization — ليس محاذاة يمين ثابتة عبر الخط
 *
 * Uses a Proxy so FlatList/StyleSheet keep working.
 */
const React = require('react');
const RN = require('react-native');

const OriginalText = RN.Text;
const OriginalTextInput = RN.TextInput;
const StyleSheet = RN.StyleSheet;

const CAIRO = {
  regular: 'Cairo_400Regular',
  medium: 'Cairo_500Medium',
  semiBold: 'Cairo_600SemiBold',
  bold: 'Cairo_700Bold',
  extraBold: 'Cairo_800ExtraBold',
  black: 'Cairo_900Black',
};

function cairoForWeight(weight) {
  const w = String(weight ?? '400');
  if (w === '900' || w === 'black') return CAIRO.black;
  if (w === '800' || w === 'heavy') return CAIRO.extraBold;
  if (w === '700' || w === 'bold') return CAIRO.bold;
  if (w === '600' || w === 'semibold') return CAIRO.semiBold;
  if (w === '500' || w === 'medium') return CAIRO.medium;
  return CAIRO.regular;
}

function isCairoFamily(family) {
  return typeof family === 'string' && family.startsWith('Cairo_');
}

function withAppTextStyle(style, props) {
  const flat = StyleSheet.flatten(style) || {};
  const family = isCairoFamily(flat.fontFamily)
    ? flat.fontFamily
    : cairoForWeight(flat.fontWeight);

  const forceLtr = props?.ltr === true || props?.rtl === false;
  const keepCenter = flat.textAlign === 'center';

  return [
    style,
    {
      fontFamily: family,
      fontWeight: 'normal',
      ...(RN.Platform.OS === 'android'
        ? { includeFontPadding: false }
        : null),
    },
    forceLtr
      ? { textAlign: flat.textAlign || 'left' }
      : keepCenter
        ? { textAlign: 'center' }
        : {
            // في RTL: 'left' = بداية السطر = اليمين
            textAlign: 'left',
          },
  ];
}

function Text(props) {
  const { ltr, rtl, style, ...rest } = props;
  return React.createElement(OriginalText, {
    ...rest,
    style: withAppTextStyle(style, { ltr, rtl }),
  });
}
Text.displayName = 'Text';

const TextInput = React.forwardRef(function AppTextInput(props, ref) {
  const { ltr, rtl, style, ...rest } = props;
  return React.createElement(OriginalTextInput, {
    ...rest,
    ref,
    style: withAppTextStyle(style, { ltr, rtl }),
  });
});
TextInput.displayName = 'TextInput';
if (OriginalTextInput.State) {
  TextInput.State = OriginalTextInput.State;
}

module.exports = new Proxy(RN, {
  get(target, prop, receiver) {
    if (prop === 'Text') return Text;
    if (prop === 'TextInput') return TextInput;
    return Reflect.get(target, prop, receiver);
  },
  getOwnPropertyDescriptor(target, prop) {
    if (prop === 'Text') {
      return {
        configurable: true,
        enumerable: true,
        writable: false,
        value: Text,
      };
    }
    if (prop === 'TextInput') {
      return {
        configurable: true,
        enumerable: true,
        writable: false,
        value: TextInput,
      };
    }
    return Reflect.getOwnPropertyDescriptor(target, prop);
  },
  ownKeys(target) {
    return Reflect.ownKeys(target);
  },
  has(target, prop) {
    return prop === 'Text' || prop === 'TextInput' || Reflect.has(target, prop);
  },
});
