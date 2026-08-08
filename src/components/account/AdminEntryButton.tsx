import React, { memo, useCallback } from 'react';
import { StyleSheet } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Button } from '@/components/ui';

/**
 * زر واضح للخروج من المتابع/المنظم والانتقال لبوابة المشرف.
 */
function AdminEntryButtonComponent() {
  const { currentUser, logout } = useTournament();
  const { t } = useTranslation();

  const onPress = useCallback(() => {
    logout({ to: 'admin' });
  }, [logout]);

  if (!currentUser || currentUser.role === 'superadmin') return null;

  return (
    <Button
      label={t('menu.enterAdmin')}
      variant="outline"
      onPress={onPress}
      style={styles.btn}
    />
  );
}

export const AdminEntryButton = memo(AdminEntryButtonComponent);

const styles = StyleSheet.create({
  btn: { marginTop: 4 },
});
