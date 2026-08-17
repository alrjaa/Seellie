import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button, Card, ListRow, Muted, Title } from '@/components/ui';
import {
  fetchMyAdvertiserAccount,
  listMyCampaigns,
  type AdCampaign,
  type AdvertiserAccount,
} from '@/services/advertiser-platform';

export default function AdsHomeScreen() {
  const { currentUser, logout } = useTournament();
  const { t } = useTranslation();
  const router = useRouter();
  const [account, setAccount] = useState<AdvertiserAccount | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [acc, camps] = await Promise.all([
      fetchMyAdvertiserAccount(),
      listMyCampaigns(),
    ]);
    setAccount(acc);
    setCampaigns(camps);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!loading && !account) {
      router.replace('/ads/register' as any);
    }
  }, [account, loading, router]);

  return (
    <Screen scroll contentStyle={styles.content}>
      <Title>{t('adsPortal.dashboardTitle')}</Title>
      <Muted>
        {account
          ? t('adsPortal.dashboardWelcome', { name: account.business_name })
          : t('adsPortal.subtitle')}
      </Muted>

      <Button
        label={t('adsPortal.newCampaign')}
        onPress={() => router.push('/ads/campaign/new' as any)}
      />

      {loading ? null : campaigns.length === 0 ? (
        <EmptyState
          title={t('adsPortal.noCampaigns')}
          description={t('adsPortal.noCampaignsDesc')}
          icon="megaphone-outline"
        />
      ) : (
        <FlatList
          data={campaigns}
          keyExtractor={(c) => c.id}
          scrollEnabled={false}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <ListRow
              title={item.name}
              subtitle={t('adsPortal.campaignStatus', { status: item.status })}
              onPress={() =>
                router.push(`/ads/campaign/${item.id}` as any)
              }
            />
          )}
        />
      )}

      <View style={styles.footer}>
        <Muted>{currentUser?.email}</Muted>
        <Button
          label={t('common.logout')}
          variant="outline"
          onPress={() => logout({ to: 'ads' })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14, paddingTop: 24, paddingBottom: 40 },
  list: { gap: 8 },
  footer: { gap: 10, marginTop: 20 },
});
