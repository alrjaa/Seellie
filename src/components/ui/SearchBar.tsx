import React, { memo } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';

type Props = TextInputProps & {
  onClear?: () => void;
};

function SearchBarComponent({ value, onChangeText, onClear, placeholder, ...rest }: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.inputBg,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <Ionicons name="search" size={18} color={theme.colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('common.searchPlaceholder')}
        placeholderTextColor={theme.colors.textMuted}
        style={[styles.input, { color: theme.colors.text }]}
        textAlign="right"
        {...rest}
      />
      {value ? (
        <Ionicons
          name="close-circle"
          size={18}
          color={theme.colors.textMuted}
          onPress={() => {
            onChangeText?.('');
            onClear?.();
          }}
        />
      ) : null}
    </View>
  );
}

export const SearchBar = memo(SearchBarComponent);

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: 8 },
});
