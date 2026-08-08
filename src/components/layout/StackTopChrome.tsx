import React, { memo, useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderBackButton } from '@/components/layout/HeaderBackButton';
import { useFloatingVisibility } from '@/hooks/useFloatingVisibility';
import { useLanguage } from '@/providers/LanguageProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { HEADER_BELOW_STATUS_GAP } from '@/theme/navigation';

type Props = {
  /** أزرار إضافية بجانب الرجوع (فلاتر أيقونية…) */
  children?: ReactNode;
};

/**
 * شريط علوي بأسلوب Unique: رجوع + أدوات، يختفي عند التمرير.
 */
function StackTopChromeComponent({ children }: Props) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { isRTL } = useLanguage();
  const { visible } = useFloatingVisibility(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const height = insets.top + HEADER_BELOW_STATUS_GAP + 40;

  useEffect(() => {
    if (visible) {
      opacity.setValue(1);
      translateY.setValue(0);
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: visible ? 180 : 120,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : -Math.min(height, 28),
        duration: visible ? 180 : 120,
        useNativeDriver: true,
      }),
    ]).start();
  }, [height, opacity, translateY, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.bar,
        {
          paddingTop: insets.top + HEADER_BELOW_STATUS_GAP,
          backgroundColor: theme.colors.background,
          borderBottomColor: theme.colors.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View
        style={[
          styles.row,
          {
            flexDirection: 'row',
            direction: isRTL ? 'rtl' : 'ltr',
          },
        ]}
      >
        <HeaderBackButton />
        {children}
      </View>
    </Animated.View>
  );
}

export const StackTopChrome = memo(StackTopChromeComponent);

/** ارتفاع تقريبي للمحتوى تحت الشريط */
export function stackTopChromePad(topInset: number) {
  return topInset + HEADER_BELOW_STATUS_GAP + 46;
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    elevation: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 6,
    paddingHorizontal: 8,
  },
  row: {
    minHeight: 40,
    alignItems: 'center',
    gap: 6,
  },
});
