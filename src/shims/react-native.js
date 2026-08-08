'use strict';

/**
 * App-level react-native shim:
 * - خط Cairo فقط
 * - محاذاة النص حسب اتجاه التطبيق (يمين للعربية / يسار للإنجليزية)
 *   لا نفرض textAlign:'left' — ذلك كان يكسر RTL عندما I18nManager غير متزامن
 *
 * Uses a Proxy so FlatList/StyleSheet keep working.
 */
const React = require('react');
const RN = require('react-native');
const { getAppRTL } = require('../theme/app-direction');

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

/**
 * في هذه القاعدة: left/right في الستايلات تعني بداية/نهاية السطر (start/end)،
 * لأن أغلب الشاشات كُتبت كذلك. المحاذاة الفيزيائية تُحسب من اتجاه التطبيق.
 * AppText يمرّر محاذاة فيزيائية صحيحة — نحترمها عبر props.physicalAlign
 * أو عندما يمرّر المكوّن rtl/ltr صراحة.
 */
function resolveTextAlign(flatAlign, forceLtr, physicalAlign) {
  if (forceLtr) return flatAlign || 'left';
  if (flatAlign === 'center') return 'center';
  if (flatAlign === 'justify') return 'justify';

  const isRTL = getAppRTL();

  if (physicalAlign) {
    if (flatAlign === 'left' || flatAlign === 'right') return flatAlign;
    return isRTL ? 'right' : 'left';
  }

  // left / auto / undefined = بداية السطر · right = نهايته
  if (flatAlign === 'right') return isRTL ? 'left' : 'right';
  return isRTL ? 'right' : 'left';
}

function withAppTextStyle(style, props) {
  const flat = StyleSheet.flatten(style) || {};
  const family = isCairoFamily(flat.fontFamily)
    ? flat.fontFamily
    : cairoForWeight(flat.fontWeight);

  const forceLtr = props?.ltr === true || props?.rtl === false;
  const physicalAlign = props?.physicalAlign === true;
  const isRTL = forceLtr ? false : getAppRTL();
  const textAlign = resolveTextAlign(flat.textAlign, forceLtr, physicalAlign);

  return [
    style,
    {
      fontFamily: family,
      fontWeight: 'normal',
      ...(RN.Platform.OS === 'android'
        ? { includeFontPadding: false }
        : null),
    },
    {
      textAlign,
      writingDirection: isRTL ? 'rtl' : 'ltr',
    },
  ];
}

function Text(props) {
  const { ltr, rtl, physicalAlign, style, ...rest } = props;
  return React.createElement(OriginalText, {
    ...rest,
    style: withAppTextStyle(style, { ltr, rtl, physicalAlign }),
  });
}
Text.displayName = 'Text';

const TextInput = React.forwardRef(function AppTextInput(props, ref) {
  const { ltr, rtl, physicalAlign, style, ...rest } = props;
  return React.createElement(OriginalTextInput, {
    ...rest,
    ref,
    style: withAppTextStyle(style, { ltr, rtl, physicalAlign }),
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
