import React, { memo, forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useLanguage } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

type Props = TextInputProps & {
  label?: string;
  error?: string;
  ltr?: boolean;
};

export const Input = memo(
  forwardRef<TextInput, Props>(function Input(
    { label, error, ltr, style, multiline, ...props },
    ref
  ) {
    const theme = useAppTheme();
    const { isRTL } = useLanguage();
    const forceLtr = ltr || !isRTL;

    return (
      <View style={styles.wrap}>
        {label ? (
          <Text
            style={[
              styles.label,
              cairoText('semiBold'),
              {
                color: theme.colors.textMuted,
                fontSize: theme.fontSize.xs,
                writingDirection: forceLtr ? 'ltr' : 'rtl',
                textAlign: forceLtr ? 'left' : 'right',
              },
            ]}
            accessibilityRole="text"
          >
            {label}
          </Text>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={theme.colors.textMuted}
          accessibilityLabel={label || props.placeholder || 'input'}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...props}
          style={[
            styles.input,
            cairoText('regular'),
            {
              backgroundColor: theme.colors.inputBg,
              borderColor: error ? theme.colors.danger : theme.colors.border,
              color: theme.colors.text,
              borderRadius: theme.radius.sm,
              paddingHorizontal: theme.spacing.sm + 4,
              paddingVertical: multiline ? theme.spacing.sm : 10,
              minHeight: multiline ? 88 : 44,
              fontSize: theme.fontSize.sm + 1,
              textAlign: forceLtr ? 'left' : 'right',
              writingDirection: forceLtr ? 'ltr' : 'rtl',
              direction: forceLtr ? 'ltr' : 'rtl',
            },
            style,
          ]}
        />
        {error ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[
              styles.error,
              cairoText('regular'),
              {
                color: theme.colors.danger,
                fontSize: theme.fontSize.xs,
                writingDirection: forceLtr ? 'ltr' : 'rtl',
                textAlign: forceLtr ? 'left' : 'right',
              },
            ]}
          >
            {error}
          </Text>
        ) : null}
      </View>
    );
  })
);

const styles = StyleSheet.create({
  wrap: { gap: 6, width: '100%' },
  label: {},
  input: {
    borderWidth: 1,
    width: '100%',
  },
  error: {},
});
