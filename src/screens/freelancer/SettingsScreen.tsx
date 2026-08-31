import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Screen } from '@/components/layout/Screen';
import { PlayerMediaSection } from '@/components/media/PlayerMediaSection';
import {
  Button,
  Card,
  Input,
  ListRow,
  Muted,
  Subtitle,
  Title,
} from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { RolePathCard } from '@/components/account/RolePathCard';
import { LanguageCard } from '@/components/account/LanguageCard';
import { AdminEntryButton } from '@/components/account/AdminEntryButton';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import { AvatarPickerCard } from '@/components/account/AvatarPickerCard';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { useTranslation } from '@/providers/LanguageProvider';

export default function SettingsScreen() {
  const {
    currentUser,
    loading,
    logout,
    updateUser,
    changePassword,
    routeForRole,
    addUserMedia,
    removeUserMedia,
    setUserAvatar,
    toggleMediaLike,
  } = useTournament();
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState(currentUser?.name ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'freelancer') {
    return <Redirect href={routeForRole(active) as any} />;
  }

  const photos = currentUser.media?.photos || [];
  const videos = currentUser.media?.videos || [];

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
          {t('settings.handle')}: {currentUser.handle}
        </Muted>
        <Muted>
          {t('settings.regId')}: {currentUser.visibleId}
        </Muted>
        <Muted>
          {t('settings.email')}: {currentUser.email}
        </Muted>
        <Input label={t('settings.name')} value={name} onChangeText={setName} />
        <Input
          label={t('account.bio')}
          value={bio}
          onChangeText={setBio}
          multiline
        />
        <Button
          label={t('common.save')}
          onPress={() =>
            updateUser(
              {
                ...currentUser,
                name: name.trim() || currentUser.name,
                bio: bio.trim(),
              },
              t('account.profileUpdated')
            )
          }
        />
        <ListRow
          title={t('freelancer.myProfile')}
          subtitle={t('freelancer.myProfileSub')}
          icon="person-outline"
          onPress={() => router.push('/(freelancer)/profile' as any)}
        />
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('freelancer.settings.mediaSection')}</Subtitle>
        <Muted>{t('freelancer.settings.mediaSectionHint')}</Muted>
        <PlayerMediaSection
          photos={photos}
          videos={videos}
          editable
          currentUserId={currentUser.id}
          onAddPhoto={(url) =>
            addUserMedia('photos', url, t('freelancer.settings.photoAddedToAccount'))
          }
          onAddVideo={(url) =>
            addUserMedia('videos', url, t('freelancer.settings.videoAddedToAccount'))
          }
          onRemovePhoto={(mediaId) =>
            removeUserMedia('photos', mediaId, t('freelancer.settings.photoRemovedFromAccount'))
          }
          onRemoveVideo={(mediaId) =>
            removeUserMedia('videos', mediaId, t('freelancer.settings.videoRemovedFromAccount'))
          }
          onSetAvatar={(url) =>
            setUserAvatar(url, t('freelancer.avatarSet'))
          }
          onTogglePhotoLike={(id) =>
            toggleMediaLike(currentUser.id, id, 'photo', 'user')
          }
          onToggleVideoLike={(id) =>
            toggleMediaLike(currentUser.id, id, 'video', 'user')
          }
        />
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
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <Button
          label={t('account.changePassword')}
          onPress={async () => {
            if (await changePassword(currentPassword, newPassword)) {
              setCurrentPassword('');
              setNewPassword('');
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
        label={t('notifications.title')}
        variant="outline"
        onPress={() => router.push('/notifications' as any)}
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
      <Button label={t('common.logout')} variant="outline" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 100 },
  card: { gap: 10 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeRow: { flexDirection: 'row', gap: 8 },
});
