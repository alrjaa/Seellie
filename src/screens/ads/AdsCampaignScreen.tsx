import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import { Button, Input, ListRow, Muted, Subtitle, Title } from '@/components/ui';
import {
  listCampaignAds,
  listMyCampaigns,
  saveCampaign,
  type AdCampaign,
  type DbAdvertisement,
} from '@/services/advertiser-platform';

export default function AdsCampaignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [status, setStatus] = useState<AdCampaign['status']>('draft');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [ads, setAds] = useState<DbAdvertisement[]>([]);
  const [campaignId, setCampaignId] = useState<string | null>(isNew ? null : id);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew || !id) return;
    void (async () => {
      const camps = await listMyCampaigns();
      const c = camps.find((x) => x.id === id);
      if (!c) return;
      setName(c.name);
      setBudget(c.budget_cents != null ? String(c.budget_cents / 100) : '');
      setStatus(c.status);
      setStartAt(c.start_at ? c.start_at.slice(0, 10) : '');
      setEndAt(c.end_at ? c.end_at.slice(0, 10) : '');
      setAds(await listCampaignAds(c.id));
    })();
  }, [id, isNew]);

  const save = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const budgetCents = budget.trim()
        ? Math.round(Number(budget) * 100)
        : null;
      const { data: saved, error } = await saveCampaign({
        id: campaignId || undefined,
        name: name.trim(),
        status,
        budgetCents: Number.isFinite(budgetCents as number) ? budgetCents : null,
        startAt: startAt ? `${startAt}T00:00:00.000Z` : undefined,
        endAt: endAt ? `${endAt}T23:59:59.000Z` : undefined,
      });
      if (!saved) {
        toast({
          variant: 'destructive',
          title: t('adsPortal.saveFailed'),
          description: t(`adsPortal.saveError.${error || 'unknown'}`),
        });
        return;
      }
      setCampaignId(saved.id);
      toast({ variant: 'success', title: t('adsPortal.saved') });
      if (isNew) {
        router.replace(`/ads/ad/new?campaignId=${saved.id}` as any);
        return;
      }
    } finally {
      setSaving(false);
    }
  }, [budget, campaignId, endAt, isNew, name, router, startAt, status, t, toast]);

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{isNew ? t('adsPortal.newCampaign') : t('adsPortal.editCampaign')}</Title>
      <Input label={t('adsPortal.campaignName')} value={name} onChangeText={setName} maxLength={80} />
      <Input
        label={t('adsPortal.budget')}
        value={budget}
        onChangeText={setBudget}
        keyboardType="decimal-pad"
      />
      <Input label={t('adsPortal.startDate')} value={startAt} onChangeText={setStartAt} placeholder="YYYY-MM-DD" />
      <Input label={t('adsPortal.endDate')} value={endAt} onChangeText={setEndAt} placeholder="YYYY-MM-DD" />
      <Muted>{t('adsPortal.campaignDatesHint')}</Muted>
      <View style={styles.row}>
        {(['draft', 'active', 'paused'] as const).map((s) => (
          <Button
            key={s}
            label={t(`adsPortal.status.${s}`)}
            variant={status === s ? 'primary' : 'outline'}
            onPress={() => setStatus(s)}
            style={{ flex: 1 }}
          />
        ))}
      </View>
      <Button label={t('common.save')} onPress={() => void save()} disabled={saving} />

      {campaignId ? (
        <>
          <Subtitle>{t('adsPortal.adsInCampaign')}</Subtitle>
          {ads.map((ad) => (
            <ListRow
              key={ad.id}
              title={ad.title || ad.advertiser_name}
              subtitle={ad.status}
              onPress={() =>
                router.push(`/ads/ad/${ad.id}?campaignId=${campaignId}` as any)
              }
            />
          ))}
          <Button
            label={t('adsPortal.newAd')}
            onPress={() =>
              router.push(`/ads/ad/new?campaignId=${campaignId}` as any)
            }
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingTop: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', gap: 8 },
});
