import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Button, Card, Muted, Subtitle } from '@/components/ui';
import { confirmDestructive } from '@/utils/confirm';

/** Self-service permanent account deletion — settings / account screens */
export function DeleteAccountSection() {
  const { currentUser, deleteOwnAccount } = useTournament();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  if (!currentUser) return null;
  if (
    currentUser.role === 'superadmin' ||
    currentUser.activeRole === 'superadmin'
  ) {
    return null;
  }

  const onDelete = async () => {
    const confirmed = await confirmDestructive({
      title: t('settings.deleteAccountConfirmTitle'),
      message: t('settings.deleteAccountConfirmMessage'),
      confirmLabel: t('settings.deleteAccountButton'),
      cancelLabel: t('common.cancel'),
    });
    if (!confirmed) return;

    setBusy(true);
    try {
      await deleteOwnAccount();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.card}>
      <Subtitle>{t('settings.deleteAccountTitle')}</Subtitle>
      <Muted>{t('settings.deleteAccountWarning')}</Muted>
      <Button
        label={t('settings.deleteAccountButton')}
        variant="danger"
        onPress={onDelete}
        disabled={busy}
        loading={busy}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
});
