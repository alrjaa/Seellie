import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button, Card, Muted, Subtitle, Title } from '@/components/ui';
import {
  listMyAdvertisements,
  type DbAdvertisement,
} from '@/services/advertiser-platform';
import {
  isNativeAdScheduleEnded,
  isNativeAdScheduleUpcoming,
} from '@/services/native-ads';

type HistoryTab = 'previous' | 'all';

function formatScheduleRange(
  ad: DbAdvertisement,
  emptyLabel: string
): string {
  const start = ad.start_at ? ad.start_at.slice(0, 10) : '';
  const end = ad.end_at ? ad.end_at.slice(0, 10) : '';
  if (start && end) return `${start} → ${end}`;
  if (start) return `${start} → …`;
  if (end) return `… → ${end}`;
  return emptyLabel;
}

function schedulePhase(
  ad: DbAdvertisement
): 'ended' | 'upcoming' | 'live' | 'none' {
  if (isNativeAdScheduleEnded(ad)) return 'ended';
  if (isNativeAdScheduleUpcoming(ad)) return 'upcoming';
  if (ad.start_at || ad.end_at) return 'live';
  return 'none';
}

export default function AdsHistoryScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [ads, setAds] = useState<DbAdvertisement[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<HistoryTab>('previous');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAds(await listMyAdvertisements());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const previousAds = useMemo(
    () =>
      ads.filter(
        (ad) =>
          isNativeAdScheduleEnded(ad) ||
          ad.status === 'paused' ||
          ad.status === 'blocked'
      ),
    [ads]
  );

  const visible = tab === 'previous' ? previousAds : ads;

  const openEdit = useCallback(
    (ad: DbAdvertisement) => {
      if (ad.status === 'blocked') {
        router.push(
          `/ads/ad/new?campaignId=${ad.campaign_id}&reuseFrom=${ad.id}` as any
        );
        return;
      }
      router.push(`/ads/ad/${ad.id}?campaignId=${ad.campaign_id}` as any);
    },
    [router]
  );

  const openReuse = useCallback(
    (ad: DbAdvertisement) => {
      router.push(
        `/ads/ad/new?campaignId=${ad.campaign_id}&reuseFrom=${ad.id}` as any
      );
    },
    [router]
  );

  if (loading) {
    return (
      <Screen>
        <LoadingState label={t('common.loading')} />
      </Screen>
    );
  }

  return (
    <Screen scroll density="dashboard" contentStyle={styles.content}>
      <Title>{t('adsPortal.historyTitle')}</Title>
      <Muted>{t('adsPortal.historyDesc')}</Muted>

      <View style={styles.tabs}>
        <Button
          label={t('adsPortal.historyTabPrevious')}
          variant={tab === 'previous' ? 'primary' : 'outline'}
          onPress={() => setTab('previous')}
          style={{ flex: 1 }}
        />
        <Button
          label={t('adsPortal.historyTabAll')}
          variant={tab === 'all' ? 'primary' : 'outline'}
          onPress={() => setTab('all')}
          style={{ flex: 1 }}
        />
      </View>

      {visible.length === 0 ? (
        <EmptyState
          title={
            tab === 'previous'
              ? t('adsPortal.historyEmptyPrevious')
              : t('adsPortal.historyEmptyAll')
          }
          description={t('adsPortal.historyEmptyDesc')}
          icon="time-outline"
        />
      ) : (
        visible.map((ad) => {
          const phase = schedulePhase(ad);
          const phaseLabel =
            phase === 'ended'
              ? t('adsPortal.schedulePhase.ended')
              : phase === 'upcoming'
                ? t('adsPortal.schedulePhase.upcoming')
                : phase === 'live'
                  ? t('adsPortal.schedulePhase.live')
                  : t('adsPortal.schedulePhase.none');
          return (
            <Card key={ad.id} style={styles.card}>
              <Subtitle>{ad.title || ad.advertiser_name}</Subtitle>
              <Muted>
                {t(`adsPortal.status.${ad.status}`)} · {phaseLabel}
              </Muted>
              <Muted>
                {t('adsPortal.historySchedule', {
                  range: formatScheduleRange(
                    ad,
                    t('adsPortal.historyNoSchedule')
                  ),
                })}
              </Muted>
              <View style={styles.actions}>
                {ad.status !== 'blocked' ? (
                  <Button
                    label={t('adsPortal.editAd')}
                    variant="outline"
                    onPress={() => openEdit(ad)}
                    style={{ flex: 1 }}
                  />
                ) : null}
                <Button
                  label={t('adsPortal.reuseAd')}
                  onPress={() => openReuse(ad)}
                  style={{ flex: 1 }}
                />
              </View>
              {phase === 'ended' || ad.status === 'blocked' ? (
                <Muted>{t('adsPortal.reuseHint')}</Muted>
              ) : null}
            </Card>
          );
        })
      )}

      <Button
        label={t('adsPortal.backToStudio')}
        variant="outline"
        onPress={() => router.push('/ads/home' as any)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingTop: 16, paddingBottom: 40 },
  tabs: { flexDirection: 'row', gap: 8 },
  card: { gap: 8 },
  actions: { flexDirection: 'row', gap: 8 },
});
