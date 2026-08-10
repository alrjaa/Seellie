import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import { HomeHeader } from '@/components/layout/HomeHeader';
import { AccountSocialStats } from '@/components/account/AccountSocialStats';
import {
  Card,
  ListRow,
  Muted,
  StatusBadge,
  Subtitle,
} from '@/components/ui';
import { formatArabicDate } from '@/utils';

export default function FreelancerHomeScreen() {
  const { currentUser, loading, offers, shareCards, routeForRole } =
    useTournament();
  const theme = useAppTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const myOffers = useMemo(
    () =>
      currentUser
        ? offers.filter((o) => o.freelancerId === currentUser.id)
        : [],
    [offers, currentUser]
  );

  const recentOffers = useMemo(() => myOffers.slice(0, 3), [myOffers]);
  const pendingCount = useMemo(
    () => myOffers.filter((o) => o.status === 'pending').length,
    [myOffers]
  );
  const unreadShareCards = useMemo(
    () =>
      currentUser
        ? shareCards.filter((c) => c.recipientId === currentUser.id && !c.read)
            .length
        : 0,
    [shareCards, currentUser]
  );

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  const active = currentUser.activeRole || currentUser.role;
  if (active !== 'freelancer') {
    return <Redirect href={routeForRole(active) as any} />;
  }

  return (
    <Screen scroll contentStyle={styles.content} edges={['top', 'left', 'right']}>
      <HomeHeader
        accountHref="/(freelancer)/settings"
        pageSubtitle={currentUser.handle || t('freelancer.profileSubtitle')}
      />

      <Card style={styles.statsCard}>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.colors.accent }]}>
              {myOffers.length}
            </Text>
            <Muted>{t('freelancer.offers')}</Muted>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.colors.warning }]}>
              {pendingCount}
            </Text>
            <Muted>{t('freelancer.awaitingReply')}</Muted>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {currentUser.posts.length}
            </Text>
            <Muted>{t('screens.posts')}</Muted>
          </View>
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <Subtitle>{t('freelancer.shortcuts')}</Subtitle>
        <ListRow
          title={t('home.shareCards')}
          subtitle={
            unreadShareCards > 0
              ? t('home.shareCardsSubUnread', { count: unreadShareCards })
              : t('home.shareCardsSub')
          }
          icon="mail-unread-outline"
          badge={unreadShareCards}
          onPress={() => router.push('/share-cards' as any)}
        />
        <ListRow
          title={t('freelancer.myProfile')}
          subtitle={t('freelancer.myProfileSub')}
          icon="images-outline"
          onPress={() => router.push('/(freelancer)/profile' as any)}
        />
        <ListRow
          title={t('freelancer.incomingOffers')}
          subtitle={t('freelancer.offersCount', { count: myOffers.length })}
          icon="mail-outline"
          onPress={() => router.push('/(freelancer)/offers' as any)}
        />
        <ListRow
          title={t('nav.messages')}
          subtitle={t('freelancer.messagesSub')}
          icon="chatbubbles-outline"
          onPress={() => router.push('/(freelancer)/messages' as any)}
        />
        <ListRow
          title={t('nav.settings')}
          subtitle={t('freelancer.settingsSub')}
          icon="settings-outline"
          onPress={() => router.push('/(freelancer)/settings' as any)}
        />
      </Card>

      <Card style={{ gap: 10 }}>
        <Subtitle>{t('freelancer.recentOffers')}</Subtitle>
        {recentOffers.length === 0 ? (
          <EmptyState
            title={t('freelancer.noOffersTitle')}
            description={t('freelancer.noOffersDesc')}
            icon="mail-outline"
          />
        ) : (
          recentOffers.map((offer) => (
            <View
              key={offer.id}
              style={[styles.offer, { borderTopColor: theme.colors.border }]}
            >
              <View style={styles.offerHeader}>
                <StatusBadge status={offer.status} />
                <Muted>{formatArabicDate(offer.timestamp)}</Muted>
              </View>
              <Text style={[styles.offerText, { color: theme.colors.text }]}>
                {offer.organizerName} · {offer.teamName}
              </Text>
              <Muted numberOfLines={2}>{offer.message}</Muted>
            </View>
          ))
        )}
      </Card>

      <AccountSocialStats user={currentUser} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: 12, gap: 14, paddingBottom: 100 },
  statsCard: { paddingVertical: 12 },
  stats: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { fontWeight: '900', fontSize: 20 },
  offer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 4 },
  offerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerText: { fontWeight: '800', textAlign: 'left' },
});
