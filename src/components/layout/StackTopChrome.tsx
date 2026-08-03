import React, { memo, useEffect, useRef, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeaderBackButton } from '@/components/layout/HeaderBackButton';
import { useFloatingChrome } from '@/providers/FloatingChromeProvider';
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
  const { visible } = useFloatingChrome();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const height = insets.top + HEADER_BELOW_STATUS_GAP + 40;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: visible ? 1 : 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: visible ? 0 : -height,
        duration: 180,
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
      <View style={styles.row}>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    direction: 'ltr',
  },
});
