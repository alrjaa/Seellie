import React, { memo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { flowDirection } from '@/theme/direction';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

function CardComponent({ children, style, padded = true }: Props) {
  const theme = useAppTheme();
  const { isRTL } = useLanguage();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: padded ? theme.spacing.md : 0,
          ...flowDirection(isRTL),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export const Card = memo(CardComponent);

const styles = StyleSheet.create({
  card: {
    // لا نفرض width:100% — يكسر شبكات flexWrap على Android
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
