import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Subtitle } from '@/components/ui/Text';
import { useLanguage } from '@/providers/LanguageProvider';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

function SectionHeaderComponent({ title, actionLabel, onAction }: Props) {
  const { isRTL } = useLanguage();
  return (
    <View
      style={[
        styles.row,
        {
          direction: isRTL ? 'rtl' : 'ltr',
          flexDirection: 'row',
        },
      ]}
    >
      <Subtitle style={styles.title}>{title}</Subtitle>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="ghost" onPress={onAction} />
      ) : null}
    </View>
  );
}

export const SectionHeader = memo(SectionHeaderComponent);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
  },
  title: {
    flex: 1,
    width: '100%',
  },
});
