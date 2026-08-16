import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTheme, useAppTheme } from '@/providers/ThemeProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageCard } from '@/components/account/LanguageCard';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import { useTranslation } from '@/providers/LanguageProvider';
import { isValidEmail, normalizeEmail } from '@/utils';
import { hashPassword } from '@/utils/password';
import { isUuid } from '@/services/supabase-messages';
import {
  supabaseUpdatePassword,
  updateProfileAdminCloud,
} from '@/services/supabase-auth';
import { isSupabaseConfigured } from '@/services/supabase';
import type { AppFeatureFlags } from '@/services/supabase-app-blobs';

export default function SettingsScreen() {
  const {
    appName,
    appLogo,
    setAppName,
    setAppLogo,
    currentUser,
    users,
    updateUser,
    logout,
    featureFlags,
    updateAppFeatureFlags,
  } = useTournament();
  const { toast } = useToast();
  const { preference, setPreference } = useTheme();
  const theme = useAppTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState(appName);
  const [logo, setLogo] = useState(appLogo);
  const [accountName, setAccountName] = useState(currentUser?.name || '');
  const [accountEmail, setAccountEmail] = useState(currentUser?.email || '');
  const [accountPassword, setAccountPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [savingFlags, setSavingFlags] = useState(false);

  const isLocalDemoAdmin = !!currentUser && !isUuid(currentUser.id);

  const onToggleFlag = async (
    key: keyof AppFeatureFlags,
    value: boolean
  ) => {
    setSavingFlags(true);
    try {
      const ok = await updateAppFeatureFlags({ [key]: value });
      if (!ok) {
        toast({
          variant: 'destructive',
          title: t('forums.cloudSyncFailed'),
        });
      }
    } finally {
      setSavingFlags(false);
    }
  };

  const saveAdminAccount = async () => {
    if (!currentUser) return;

    if (isLocalDemoAdmin) {
      toast({
        variant: 'destructive',
        title: t('superadmin.settings.localDemoTitle'),
        description: t('superadmin.settings.localDemoToastDesc'),
      });
      return;
    }

    const email = normalizeEmail(accountEmail);
    if (!isValidEmail(email)) {
      toast({
        variant: 'destructive',
        title: t('toasts.t004_8fdbe1'),
        description: t('auth.invalidEmail'),
      });
      return;
    }
    const nextPassword = accountPassword.trim();
    if (nextPassword && nextPassword.length < 6) {
      toast({
        variant: 'destructive',
        title: t('toasts.t004_8fdbe1'),
        description: t('toasts.t076_91bef0'),
      });
      return;
    }

    setSaving(true);
    try {
      if (nextPassword && isSupabaseConfigured() && isUuid(currentUser.id)) {
        const cloud = await supabaseUpdatePassword(nextPassword);
        if (!cloud.ok) {
          toast({
            variant: 'destructive',
            title: t('superadmin.settings.passwordUpdateFailedTitle'),
            description:
              cloud.error || t('superadmin.settings.passwordUpdateFailedDesc'),
          });
          return;
        }
      }

      const updated = {
        ...currentUser,
        name: accountName.trim() || currentUser.name,
        email,
        ...(nextPassword
          ? {
              passwordHash: isUuid(currentUser.id)
                ? 'supabase'
                : hashPassword(nextPassword),
            }
          : {}),
      };
      updateUser(updated, t('superadmin.settings.accountSaved'));
      if (isSupabaseConfigured() && isUuid(currentUser.id)) {
        void updateProfileAdminCloud({
          id: currentUser.id,
          email,
          name: updated.name,
        });
      }
      setAccountPassword('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{t('settings.title')}</Title>
      <Muted>{t('settings.subtitle')}</Muted>

      <LanguageCard />

      <Card style={styles.card}>
        <Subtitle>{t('superadmin.settings.editAccount')}</Subtitle>
        <Muted>{t('superadmin.settings.editAccountHint')}</Muted>
        {!isUuid(currentUser?.id) ? (
          <Muted>{t('superadmin.settings.localDemoHint')}</Muted>
        ) : (
          <Muted>
            {t('superadmin.settings.cloudAccountBadge', {
              email: currentUser?.email || '',
            })}
          </Muted>
        )}
        <Muted>
          {t('settings.handle')}: {currentUser?.handle}
        </Muted>
        <Muted>
          {t('settings.regId')}: {currentUser?.visibleId}
        </Muted>
        <Input
          label={t('settings.name')}
          value={accountName}
          onChangeText={setAccountName}
        />
        <Input
          label={t('settings.email')}
          value={accountEmail}
          onChangeText={setAccountEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          ltr
          editable={!isLocalDemoAdmin}
        />
        <Input
          label={t('superadmin.settings.newPassword')}
          value={accountPassword}
          onChangeText={setAccountPassword}
          secureTextEntry
          placeholder={t('superadmin.settings.newPasswordHint')}
          ltr
          editable={!isLocalDemoAdmin}
        />
        <Button
          label={t('superadmin.settings.saveAccount')}
          onPress={() => void saveAdminAccount()}
          disabled={isLocalDemoAdmin || saving}
          loading={saving}
        />
        <Button
          label={t('superadmin.settings.reloginCloud')}
          variant="outline"
          onPress={() => logout()}
        />
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
        <Subtitle>{t('appreciation.features.title')}</Subtitle>
        <Muted>{t('appreciation.features.subtitle')}</Muted>
        {(
          [
            {
              key: 'appreciationEnabled' as const,
              title: t('appreciation.features.appreciation'),
              desc: t('appreciation.features.appreciationDesc'),
            },
            {
              key: 'commentComposerEnabled' as const,
              title: t('appreciation.features.commentComposer'),
              desc: t('appreciation.features.commentComposerDesc'),
            },
            {
              key: 'postComposerEnabled' as const,
              title: t('appreciation.features.postComposer'),
              desc: t('appreciation.features.postComposerDesc'),
            },
            {
              key: 'arenaComposerEnabled' as const,
              title: t('appreciation.features.arenaComposer'),
              desc: t('appreciation.features.arenaComposerDesc'),
            },
          ] as const
        ).map((row) => (
          <View key={row.key} style={styles.flagRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.flagTitle, { color: theme.colors.text }]}>
                {row.title}
              </Text>
              <Muted>{row.desc}</Muted>
              <Muted>
                {featureFlags[row.key]
                  ? t('appreciation.features.enabled')
                  : t('appreciation.features.disabled')}
              </Muted>
            </View>
            <Switch
              value={featureFlags[row.key]}
              onValueChange={(v) => void onToggleFlag(row.key, v)}
              disabled={savingFlags}
            />
          </View>
        ))}
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
  flagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  flagTitle: { fontWeight: '700', fontSize: 14, textAlign: 'left' },
});
