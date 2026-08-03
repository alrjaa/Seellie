import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTournament } from '@/providers/TournamentProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageCard } from '@/components/account/LanguageCard';
import { useTranslation } from '@/providers/LanguageProvider';

export default function SettingsScreen() {
  const { appName, appLogo, setAppName, setAppLogo, currentUser } =
    useTournament();
  const { toast } = useToast();
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation();
  const [name, setName] = useState(appName);
  const [logo, setLogo] = useState(appLogo);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('settings.title')}</Title>
      <Muted>{t('settings.subtitle')}</Muted>

      <LanguageCard />

      <Card style={styles.card}>
        <Subtitle>{t('settings.accountSettings')}</Subtitle>
        <Muted>
          {t('settings.name')}: {currentUser?.name}
        </Muted>
        <Muted>
          {t('settings.handle')}: {currentUser?.handle}
        </Muted>
        <Muted>
          {t('settings.regId')}: {currentUser?.visibleId}
        </Muted>
        <Muted>
          {t('settings.email')}: {currentUser?.email}
        </Muted>
        <Muted>
          {t('roles.superadmin')}
        </Muted>
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
        <Subtitle>{t('superadmin.settings.appIdentity')}</Subtitle>
        <Input
          label={t('superadmin.settings.appName')}
          value={name}
          onChangeText={setName}
        />
        <Input
          label={t('superadmin.settings.logoUrl')}
          value={logo}
          onChangeText={setLogo}
          ltr
          autoCapitalize="none"
        />
        <Button
          label={t('superadmin.settings.saveIdentity')}
          onPress={() => {
            setAppName(name.trim() || t('superadmin.settings.defaultAppName'));
            setAppLogo(logo.trim());
            toast({
              variant: 'success',
              title: t('superadmin.settings.savedTitle'),
              description: t('superadmin.settings.identitySavedDesc'),
            });
          }}
        />
        <Button
          label={t('superadmin.settings.restoreDefaultLogo')}
          variant="ghost"
          onPress={() => {
            setAppLogo('');
            setLogo('');
            toast({
              title: t('superadmin.settings.restoredTitle'),
              description: t('superadmin.settings.restoredDesc'),
            });
          }}
        />
      </Card>
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
