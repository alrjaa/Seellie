import React, { memo, useCallback, useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTournament, type Offer } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { LoadingState } from '@/components/feedback/LoadingState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Screen } from '@/components/layout/Screen';
import {
  Avatar,
  Button,
  Card,
  Muted,
  StatusBadge,
  Subtitle,
} from '@/components/ui';
import { formatArabicDate } from '@/utils';

const OfferRow = memo(function OfferRow({
  offer,
  onAccept,
  onDecline,
}: {
  offer: Offer;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const theme = useAppTheme();
  const { t } = useTranslation();

  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <Avatar uri={offer.organizerAvatar} name={offer.organizerName} size={44} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {offer.organizerName}
          </Text>
          <Muted>
            {offer.competitionName} · {offer.teamName}
          </Muted>
          <Text style={[styles.message, { color: theme.colors.text }]}>
            {offer.message}
          </Text>
          <View style={styles.meta}>
            <StatusBadge status={offer.status} />
            <Muted>{formatArabicDate(offer.timestamp)}</Muted>
          </View>
        </View>
      </View>
      {offer.status === 'pending' ? (
        <View style={styles.actions}>
          <Button
            label={t('common.accept')}
            onPress={onAccept}
            style={{ flex: 1 }}
          />
          <Button
            label={t('common.decline')}
            variant="outline"
            onPress={onDecline}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}
    </Card>
  );
});

export default function OffersScreen() {
  const { currentUser, loading, offers, updateOfferStatus, routeForRole } =
    useTournament();
  const { t } = useTranslation();

  const myOffers = useMemo(
    () =>
      currentUser
        ? offers.filter((o) => o.freelancerId === currentUser.id)
        : [],
    [offers, currentUser]
  );

  const onAccept = useCallback(
    (offerId: string) => {
      updateOfferStatus(offerId, 'accepted', t('freelancer.offerAccepted'));
    },
    [updateOfferStatus, t]
  );

  const onDecline = useCallback(
    (offerId: string) => {
      updateOfferStatus(offerId, 'declined', t('freelancer.offerDeclined'));
    },
    [updateOfferStatus, t]
  );

  if (loading) return <LoadingState />;
  if (!currentUser) return <Redirect href="/(auth)/login" />;
  if (currentUser.role !== 'freelancer') {
    return <Redirect href={routeForRole(currentUser.role) as any} />;
  }

  return (
    <Screen>
      <FlatList
        data={myOffers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 8 }}>
            <Subtitle>{t('freelancer.joinOffers')}</Subtitle>
            <Muted>{t('freelancer.joinOffersSub')}</Muted>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title={t('freelancer.noOffersEmpty')}
            description={t('freelancer.noOffersEmptyDesc')}
            icon="mail-outline"
          />
        }
        renderItem={({ item }) => (
          <OfferRow
            offer={item}
            onAccept={() => onAccept(item.id)}
            onDecline={() => onDecline(item.id)}
          />
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 100 },
  card: { gap: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  title: { fontWeight: '800', textAlign: 'left' },
  message: { textAlign: 'left', lineHeight: 20, fontSize: 13 },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  actions: { flexDirection: 'row', gap: 8 },
});
