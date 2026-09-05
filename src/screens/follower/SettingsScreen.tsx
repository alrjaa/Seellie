import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useNotifications } from '@/providers/NotificationsProvider';
import { Screen } from '@/components/layout/Screen';
import { RolePathCard } from '@/components/account/RolePathCard';
import { LanguageCard } from '@/components/account/LanguageCard';
import { AdminEntryButton } from '@/components/account/AdminEntryButton';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import { AvatarPickerCard } from '@/components/account/AvatarPickerCard';
import { DeleteAccountSection } from '@/components/account/DeleteAccountSection';
import {
  Button,
  Card,
  ListRow,
  Muted,
  Subtitle,
} from '@/components/ui';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

export default function SettingsScreen() {
  const { currentUser, logout, messages, featureFlags } = useTournament();
  const { unreadCountFor } = useNotifications();
  const { preference, setPreference } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();

  const unreadMessages =
    currentUser
      ? messages.filter((m) => m.recipientId === currentUser.id && !m.read).length
      : 0;
  const unreadNotifs = unreadCountFor(currentUser?.id);

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.pathsWrap}>
        <RolePathCard />
      </View>

      <AvatarPickerCard />

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
        {featureFlags.commerceCreditsEnabled ? (
          <ListRow
            title={t('commerce.balance')}
            subtitle={t('commerce.balanceMenuSub')}
            icon="wallet-outline"
            onPress={() => router.push('/(follower)/wallet' as any)}
          />
        ) : null}
      </Card>

      <Card style={styles.card}>
        <Subtitle style={styles.cardTitle}>{t('settings.appearance')}</Subtitle>
        <View style={styles.row}>
          <Muted style={styles.meta}>
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

      <AdminEntryButton />
      <ListRow
        title={t('home.messages')}
        subtitle={
          unreadMessages > 0
            ? t('home.messagesSubUnread', { count: unreadMessages })
            : t('home.messagesSub')
        }
        icon="mail-outline"
        badge={unreadMessages}
        onPress={() => router.push('/(follower)/messages' as any)}
      />
      <ListRow
        title={t('settings.createPost')}
        subtitle={t('settings.createPostSub')}
        icon="create-outline"
        onPress={() => router.push('/(follower)/content/create' as any)}
      />
      <ListRow
        title={t('shareCards.menu')}
        subtitle={t('shareCards.subtitle')}
        icon="share-outline"
        onPress={() => router.push('/share-cards' as any)}
      />
      <ListRow
        title={t('notifications.title')}
        subtitle={
          unreadNotifs > 0
            ? t('notifications.unreadCount', { count: unreadNotifs })
            : t('notifications.emptyDesc')
        }
        icon="notifications-outline"
        badge={unreadNotifs}
        onPress={() => router.push('/notifications' as any)}
      />
      <ListRow
        title={t('settings.adsTitle')}
        subtitle={t('settings.adsMenuSub')}
        icon="megaphone-outline"
        onPress={() => router.push('/(follower)/settings/ads' as any)}
      />
      <ListRow
        title={t('legal.openAbout')}
        subtitle={t('legal.aboutSubtitle')}
        icon="book-outline"
        onPress={() => router.push('/about' as any)}
      />
      <ListRow
        title={t('legal.openPrivacy')}
        subtitle={t('legal.privacyTitle')}
        icon="shield-checkmark-outline"
        onPress={() => router.push('/privacy' as any)}
      />
      <ListRow
        title={t('legal.openTerms')}
        subtitle={t('legal.termsTitle')}
        icon="document-text-outline"
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
