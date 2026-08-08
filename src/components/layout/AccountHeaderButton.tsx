import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { AccountMenuButton } from '@/components/layout/AccountMenuButton';
import { AdminEntryChip } from '@/components/account/AdminEntryChip';
import { useLanguage } from '@/providers/LanguageProvider';

type Props = {
  accountHref: string;
  settingsHref?: string;
  compact?: boolean;
};

/** معرّف الحساب + زر دخول المشرف الظاهر في الهيدر. */
function AccountHeaderButtonComponent({
  accountHref,
  settingsHref,
  compact,
}: Props) {
  const { isRTL } = useLanguage();
  return (
    <View
      style={[
        styles.row,
        { flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <AdminEntryChip compact={compact} />
      <AccountMenuButton
        accountHref={accountHref}
        settingsHref={settingsHref}
        variant="handle"
        compact={compact}
      />
    </View>
  );
}

export const AccountHeaderButton = memo(AccountHeaderButtonComponent);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 6,
  },
});
