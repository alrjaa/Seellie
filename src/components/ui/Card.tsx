import React, { memo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

function CardComponent({ children, style, padded = true }: Props) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: padded ? theme.spacing.md : 0,
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
