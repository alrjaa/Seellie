import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { RolePathCard } from '@/components/account/RolePathCard';
import { LanguageCard } from '@/components/account/LanguageCard';
import { useTranslation } from '@/providers/LanguageProvider';

export default function OrganizerSettingsScreen() {
  const { currentUser, updateUser, changePassword, logout } = useTournament();
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation();
  const [name, setName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');

  const saveAccount = () => {
    if (!currentUser) return;
    updateUser(
      { ...currentUser, name: name.trim() || currentUser.name, bio: bio.trim() },
      t('organizer.settings.accountUpdated')
    );
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('settings.title')}</Title>
      <Muted>{t('settings.subtitle')}</Muted>

      <RolePathCard />
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
            {t('settings.currentTheme')}: {preference}
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
          onPress={() => {
            const ok = changePassword(currentPassword, nextPassword);
            if (ok) {
              setCurrentPassword('');
              setNextPassword('');
            }
          }}
        />
      </Card>

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
