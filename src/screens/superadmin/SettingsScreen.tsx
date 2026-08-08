import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Card, Input, Muted, Subtitle, Title } from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { LanguageCard } from '@/components/account/LanguageCard';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import { useTranslation } from '@/providers/LanguageProvider';
import { isValidEmail, normalizeEmail } from '@/utils';
import { hashPassword } from '@/utils/password';
import { isUuid } from '@/services/supabase-messages';

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
  } = useTournament();
  const { toast } = useToast();
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState(appName);
  const [logo, setLogo] = useState(appLogo);
  const [accountName, setAccountName] = useState(currentUser?.name || '');
  const [accountEmail, setAccountEmail] = useState(currentUser?.email || '');
  const [accountPassword, setAccountPassword] = useState('');

  const isLocalDemoAdmin = !!currentUser && !isUuid(currentUser.id);

  const saveAdminAccount = () => {
    if (!currentUser) return;

    if (isLocalDemoAdmin) {
      toast({
        variant: 'destructive',
        title: 'حساب تجريبي محلي',
        description:
          'حسابك محلي وليست له صلاحية مشرف سحابية. اخرج وادخل من /admin بحساب Supabase مرقّى (promote-admin.sql أو set-admin-password.sql).',
      });
      return;
    }

    const email = normalizeEmail(accountEmail);
    if (!isValidEmail(email)) {
      toast({
        variant: 'destructive',
        title: t('superadmin.settings.invalidEmail'),
      });
      return;
    }
    const taken = users.some(
      (u) => u.id !== currentUser.id && normalizeEmail(u.email) === email
    );
    if (taken) {
      toast({
        variant: 'destructive',
        title: t('superadmin.settings.emailTaken'),
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
    updateUser(
      {
        ...currentUser,
        name: accountName.trim() || currentUser.name,
        email,
        ...(nextPassword
          ? { passwordHash: hashPassword(nextPassword) }
          : {}),
      },
      t('superadmin.settings.accountSaved')
    );
    setAccountPassword('');
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
          <Muted>
            حساب تجريبي محلي فقط (لا يعمل بين الأجهزة). لا تغيّر الإيميل هنا.
            للمشرف الحقيقي: اخرج → /admin → alrjaa.ns@gmail.com بعد SQL.
          </Muted>
        ) : (
          <Muted>حساب سحابي ✓ {currentUser?.email}</Muted>
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
          onPress={saveAdminAccount}
          disabled={isLocalDemoAdmin}
        />
        <Button
          label="خروج ثم دخول سحابي"
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
});
