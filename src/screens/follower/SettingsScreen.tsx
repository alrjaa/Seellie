import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { RolePathCard } from '@/components/account/RolePathCard';
import { LanguageCard } from '@/components/account/LanguageCard';
import {
  Button,
  Card,
  ListRow,
  Muted,
  Subtitle,
} from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function SettingsScreen() {
  const { currentUser, logout } = useTournament();
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.pathsWrap}>
        <RolePathCard />
      </View>

      <LanguageCard />

      <Card style={styles.card}>
        <Subtitle style={styles.cardTitle}>{t('settings.accountSettings')}</Subtitle>
        <Muted style={styles.meta}>
          {t('settings.name')}: {currentUser?.name}
        </Muted>
        <Muted style={styles.meta}>
          {t('settings.handle')}: {currentUser?.handle}
        </Muted>
        <Muted style={styles.meta}>
          {t('settings.regId')}: {currentUser?.visibleId}
        </Muted>
        <Muted style={styles.meta}>
          {t('settings.email')}: {currentUser?.email}
        </Muted>
        <ListRow
          title={t('settings.editProfile')}
          subtitle={t('settings.editProfileSub')}
          onPress={() => router.push('/(follower)/settings/account' as any)}
        />
      </Card>

      <Card style={styles.card}>
        <Subtitle style={styles.cardTitle}>{t('settings.appearance')}</Subtitle>
        <View style={styles.row}>
          <Muted style={styles.meta}>
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

      <Button label={t('common.logout')} variant="danger" onPress={logout} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 8, gap: 14, paddingBottom: 40 },
  pathsWrap: { marginTop: 64 },
  card: { gap: 8 },
  cardTitle: { fontSize: 14 },
  meta: { fontSize: 12 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  themeRow: { flexDirection: 'row', gap: 8 },
});
