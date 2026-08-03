import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTournament, type User } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Chip, Input, Muted, Subtitle, Title } from '@/components/ui';

const STATUS_OPTIONS: User['status'][] = ['active', 'suspended', 'warned'];

export default function OrganizerEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { users, updateUser, loading } = useTournament();
  const { t } = useTranslation();
  const user = users.find((u) => u.id === id && u.role === 'organizer');

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState<User['status']>('active');

  useEffect(() => {
    if (user) {
      setName(user.name);
      setBio(user.bio ?? '');
      setStatus(user.status);
    }
  }, [user]);

  if (loading) return <LoadingState />;
  if (!user) {
    return (
      <Screen contentStyle={styles.content}>
        <EmptyState title={t('superadmin.organizerEdit.notFound')} icon="person-outline" />
        <Button label={t('common.back')} variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (user.role !== 'organizer') {
    return <Redirect href="/(superadmin)/users" />;
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('superadmin.organizerEdit.title')}</Title>
      <Muted>{user.email}</Muted>

      <Card style={styles.card}>
        <Subtitle>{t('superadmin.organizerEdit.basicData')}</Subtitle>
        <Input label={t('settings.name')} value={name} onChangeText={setName} />
        <Input label={t('account.bio')} value={bio} onChangeText={setBio} multiline />
      </Card>

      <Card style={styles.card}>
        <Subtitle>{t('superadmin.organizerEdit.accountStatus')}</Subtitle>
        <View style={styles.chips}>
          {STATUS_OPTIONS.map((s) => (
            <Chip
              key={s}
              label={t(`status.${s}`)}
              active={status === s}
              onPress={() => setStatus(s)}
            />
          ))}
        </View>
      </Card>

      <Button
        label={t('account.saveChanges')}
        onPress={() => {
          updateUser(
            { ...user, name: name.trim() || user.name, bio: bio.trim(), status },
            t('superadmin.organizerEdit.updated')
          );
          router.back();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  card: { gap: 10 },
  chips: { flexDirection: 'row', gap: 8 },
});
