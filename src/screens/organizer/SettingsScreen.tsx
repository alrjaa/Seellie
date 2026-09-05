import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { RolePathCard } from '@/components/account/RolePathCard';
import { LanguageCard } from '@/components/account/LanguageCard';
import { AdminEntryButton } from '@/components/account/AdminEntryButton';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import { AvatarPickerCard } from '@/components/account/AvatarPickerCard';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { useTranslation } from '@/providers/LanguageProvider';

export default function OrganizerSettingsScreen() {
  const { currentUser, updateUser, changePassword, logout } = useTournament();
  const { unreadCountFor } = useNotifications();
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const unreadNotifs = unreadCountFor(currentUser?.id);

  const saveAccount = () => {
    if (!currentUser) return;
    updateUser(
      { ...currentUser, name: name.trim() || currentUser.name, bio: bio.trim() },
      t('organizer.settings.accountUpdated')
    );
  };

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{t('settings.title')}</Title>
      <Muted>{t('settings.subtitle')}</Muted>

      <RolePathCard />
      <AvatarPickerCard />
      <LanguageCard />

      <Card style={styles.card}>
        <Subtitle>{t('settings.accountSettings')}</Subtitle>
        <Muted>
          {t('settings.handle')}: {currentUser?.handle}
        </Muted>
        <Muted>
          {t('settings.regId')}: {currentUser?.visibleId}
        </Muted>
        <Muted>
          {t('settings.email')}: {currentUser?.email}
        </Muted>
        <Input label={t('settings.name')} value={name} onChangeText={setName} />
        <Input
          label={t('account.bio')}
          value={bio}
          onChangeText={setBio}
          multiline
          placeholder={t('organizer.settings.bioPlaceholder')}
        />
        <Button label={t('common.save')} onPress={saveAccount} />
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('settings.appearance')}</Subtitle>
        <View style={styles.row}>
          <Muted>
            {t('settings.currentTheme')}: {t(`common.${preference}`)}
          </Muted>
          <ThemeToggle />
        </View>
        <View style={styles.themeRow}>
          <Button
            label={t('common.system')}
            variant={preference === 'system' ? 'primary' : 'outline'}
            onPress={() => setPreference('system')}
            style={{ flex: 1 }}
          />
          <Button
            label={t('common.dark')}
            variant={preference === 'dark' ? 'primary' : 'outline'}
            onPress={() => setPreference('dark')}
            style={{ flex: 1 }}
          />
          <Button
            label={t('common.light')}
            variant={preference === 'light' ? 'primary' : 'outline'}
            onPress={() => setPreference('light')}
            style={{ flex: 1 }}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('account.changePassword')}</Subtitle>
        <Input
          label={t('account.currentPassword')}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
        />
        <Input
          label={t('account.newPassword')}
          value={nextPassword}
          onChangeText={setNextPassword}
          secureTextEntry
        />
        <Button
          label={t('account.changePassword')}
          onPress={async () => {
            const ok = await changePassword(currentPassword, nextPassword);
            if (ok) {
              setCurrentPassword('');
              setNextPassword('');
            }
          }}
        />
      </Card>

      <AdminEntryButton />
      <Button
        label={t('shareCards.menu')}
        variant="outline"
        onPress={() => router.push('/share-cards' as any)}
      />
      <Button
        label={
          unreadNotifs > 0
            ? `${t('notifications.title')} (${unreadNotifs})`
            : t('notifications.title')
        }
        variant="outline"
        onPress={() => router.push('/notifications' as any)}
      />
      <Button
        label={t('legal.openAbout')}
        variant="ghost"
        onPress={() => router.push('/about' as any)}
      />
      <Button
        label={t('legal.openPrivacy')}
        variant="ghost"
        onPress={() => router.push('/privacy' as any)}
      />
      <Button
        label={t('legal.openTerms')}
        variant="ghost"
        onPress={() => router.push('/terms' as any)}
      />
      <AccountSocialStats user={currentUser} />
      <DeleteAccountSection />
      <Button label={t('common.logout')} variant="danger" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  card: { gap: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeRow: { flexDirection: 'row', gap: 8 },
});
