import React, { memo } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useLanguage, useTranslation } from '@/providers/LanguageProvider';
import { cairoText } from '@/theme/fonts';

type Props = TextInputProps & {
  onClear?: () => void;
};

function SearchBarComponent({
  value,
  onChangeText,
  onClear,
  placeholder,
  ...rest
}: Props) {
  const theme = useAppTheme();
  const { t } = useTranslation();
  const { isRTL } = useLanguage();

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.inputBg,
          borderColor: theme.colors.border,
          // لا نعكس الصف يدوياً — I18nManager RTL يعكس row تلقائياً
          flexDirection: 'row',
        },
      ]}
    >
      <Ionicons name="search" size={18} color={theme.colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? t('common.searchPlaceholder')}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.input,
          cairoText('regular'),
          {
            color: theme.colors.text,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: isRTL ? 'rtl' : 'ltr',
          },
        ]}
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
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 44,
  },
  input: { flex: 1, fontSize: 14, paddingVertical: 8 },
});
