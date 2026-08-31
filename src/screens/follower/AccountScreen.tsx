import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import { AvatarPickerCard } from '@/components/account/AvatarPickerCard';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';

/** Profile editing only — account paths are in Settings via the dropdown menu */
export default function AccountScreen() {
  const { currentUser, updateUser, changePassword } = useTournament();
  const { t } = useTranslation();
  const router = useRouter();

  const [name, setName] = useState(currentUser?.name || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [country, setCountry] = useState(currentUser?.country || '');
  const [region, setRegion] = useState(currentUser?.region || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  if (!currentUser) return null;

  const saveProfile = () => {
    updateUser(
      {
        ...currentUser,
        name: name.trim() || currentUser.name,
        bio: bio.trim(),
        country: country.trim() || undefined,
        region: region.trim() || undefined,
        city: city.trim() || undefined,
      },
      t('account.profileUpdated')
    );
  };

  const savePassword = async () => {
    if (nextPassword !== confirmPassword) return;
    const ok = await changePassword(currentPassword, nextPassword);
    if (ok) {
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
    }
  };

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{t('settings.accountSettings')}</Title>
      <Muted>{t('account.subtitle')}</Muted>

      <AvatarPickerCard />

      <Card style={styles.card}>
        <Subtitle>{t('account.personalData')}</Subtitle>
        <Muted>
          {t('account.handleLine', { handle: currentUser.handle })}
        </Muted>
        <Muted>
          {t('account.regIdLine', { id: currentUser.visibleId })}
        </Muted>
        <Muted>
          {t('account.emailLine', { email: currentUser.email })}
        </Muted>
        <Input
          label={t('settings.name')}
          value={name}
          onChangeText={setName}
        />
        <Input
          label={t('account.bio')}
          value={bio}
          onChangeText={setBio}
          multiline
          style={{ minHeight: 80, maxHeight: 120 }}
        />
        <Button label={t('account.saveChanges')} onPress={saveProfile} />
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('account.addressTitle')}</Subtitle>
        <Muted>{t('account.addressDesc')}</Muted>
        <Input
          label={t('account.country')}
          value={country}
          onChangeText={setCountry}
        />
        <Input
          label={t('account.region')}
          value={region}
          onChangeText={setRegion}
        />
        <Input label={t('account.city')} value={city} onChangeText={setCity} />
        <Button label={t('account.saveAddress')} onPress={saveProfile} />
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
        <Input
          label={t('account.confirmPassword')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />
        <Button
          label={t('account.updatePassword')}
          variant="secondary"
          onPress={savePassword}
          disabled={
            !currentPassword ||
            !nextPassword ||
            nextPassword !== confirmPassword
          }
        />
      </Card>

      <Button
        label={t('menu.accountPaths')}
        variant="outline"
        onPress={() => router.push('/(follower)/settings' as any)}
      />
      <DeleteAccountSection />
      <AccountSocialStats user={currentUser} />
      <Button
        label={t('common.back')}
        variant="ghost"
        onPress={() => router.back()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  card: { gap: 10 },
});
