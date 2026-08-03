import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/ui/Button';
import { Subtitle } from '@/components/ui/Text';

type Props = {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
};

function SectionHeaderComponent({ title, actionLabel, onAction }: Props) {
  return (
    <View style={styles.row}>
      <Subtitle>{title}</Subtitle>
      {actionLabel && onAction ? (
        <Button label={actionLabel} variant="ghost" onPress={onAction} />
      ) : null}
    </View>
  );
}

export const SectionHeader = memo(SectionHeaderComponent);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    width: '100%',
  },
});
