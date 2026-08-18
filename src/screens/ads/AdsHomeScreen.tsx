import React, { useCallback, useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import { LoadingState } from '@/components/feedback/LoadingState';
import { Button, Input, ListRow, Muted, Subtitle, Title } from '@/components/ui';
import { AdPhonePreview } from '@/components/ads/AdPhonePreview';
import {
  ensureAdvertiserAccount,
  fetchMyAdvertiserAccount,
  listMyCampaigns,
  saveCampaign,
  type AdCampaign,
  type AdvertiserAccount,
} from '@/services/advertiser-platform';

export default function AdsHomeScreen() {
  const { currentUser, logout } = useTournament();
  const { t, isRTL } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const [account, setAccount] = useState<AdvertiserAccount | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingStudio, setOpeningStudio] = useState(false);
  const [contactName, setContactName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [country, setCountry] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
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
    if (!currentUser) return;
    setContactName((prev) => prev || currentUser.name || '');
    setBusinessName((prev) => prev || currentUser.name || '');
  }, [currentUser]);

  const openStudio = useCallback(async () => {
    setOpeningStudio(true);
    try {
      let campaign = campaigns[0];
      if (!campaign) {
        const created = await saveCampaign({
          name: t('adsPortal.defaultCampaignName'),
          status: 'draft',
        });
        if (!created) {
          toast({
            variant: 'destructive',
            title: t('adsPortal.saveFailed'),
          });
          return;
        }
        campaign = created;
        setCampaigns([created]);
      }
      router.push(`/ads/ad/new?campaignId=${campaign.id}` as any);
    } finally {
      setOpeningStudio(false);
    }
  }, [campaigns, router, t, toast]);

  const saveProfile = useCallback(async () => {
    if (!contactName.trim() || !businessName.trim()) return;
    setSavingProfile(true);
    try {
      const saved = await ensureAdvertiserAccount({
        contactName: contactName.trim(),
        businessName: businessName.trim(),
        country: country.trim(),
        region: region.trim(),
        city: city.trim(),
      });
      if (!saved) {
        toast({
          variant: 'destructive',
          title: t('adsPortal.registerFailed'),
          description: t('adsPortal.registerFailedDesc'),
        });
        return;
      }
      setAccount(saved);
      toast({ variant: 'success', title: t('adsPortal.saved') });
      await load();
    } finally {
      setSavingProfile(false);
    }
  }, [businessName, city, contactName, country, load, region, t, toast]);

  if (loading) {
    return (
      <Screen>
        <LoadingState label={t('common.loading')} />
      </Screen>
    );
  }

  if (!account) {
    return (
      <Screen scroll keyboard density="form" contentStyle={styles.content}>
        <Title>{t('adsPortal.completeProfileTitle')}</Title>
        <Muted>{t('adsPortal.completeProfileDesc')}</Muted>
        <Input
          label={t('adsPortal.contactName')}
          value={contactName}
          onChangeText={setContactName}
          maxLength={80}
        />
        <Input
          label={t('adsPortal.businessName')}
          value={businessName}
          onChangeText={setBusinessName}
          maxLength={80}
        />
        <Input
          label={t('adsPortal.country')}
          value={country}
          onChangeText={setCountry}
          maxLength={80}
        />
        <Input
          label={t('adsPortal.region')}
          value={region}
          onChangeText={setRegion}
          maxLength={80}
        />
        <Input
          label={t('adsPortal.city')}
          value={city}
          onChangeText={setCity}
          maxLength={80}
        />
        <Muted>{t('adsPortal.registerRegionHint')}</Muted>
        <Button
          label={t('adsPortal.createAccount')}
          onPress={() => void saveProfile()}
          disabled={savingProfile}
        />
        <Button
          label={t('common.logout')}
          variant="outline"
          onPress={() => logout({ to: 'ads' })}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll density="dashboard" contentStyle={styles.content}>
      <Title>{t('adsPortal.studioHomeTitle')}</Title>
      <Muted>
        {t('adsPortal.dashboardWelcome', { name: account.business_name })}
      </Muted>
      <Muted>{t('adsPortal.studioIntro')}</Muted>
      {Platform.OS === 'web' ? (
        <Muted>{t('adsPortal.buildStamp', { version: '1.0.91' })}</Muted>
      ) : null}

      <View style={styles.hero}>
        <AdPhonePreview
          advertiserName={account.business_name}
          hookText={t('adsPortal.studioDemoHook')}
          title={t('adsPortal.studioDemoTitle')}
          ctaLabel={t('adsPortal.pickVideo')}
          showSafeZone
          isRTL={isRTL}
        />
        <Button
          label={t('adsPortal.openStudio')}
          onPress={() => void openStudio()}
          loading={openingStudio}
          disabled={openingStudio}
        />
      </View>

      <Button
        label={t('adsPortal.newCampaign')}
        variant="outline"
        onPress={() => router.push('/ads/campaign/new' as any)}
      />

      {campaigns.length === 0 ? (
        <EmptyState
          title={t('adsPortal.noCampaigns')}
          description={t('adsPortal.noCampaignsDesc')}
          icon="megaphone-outline"
        />
      ) : (
        <>
          <Subtitle>{t('adsPortal.campaignListTitle')}</Subtitle>
          {campaigns.map((item) => (
            <ListRow
              key={item.id}
              title={item.name}
              subtitle={t('adsPortal.campaignStatus', { status: item.status })}
              onPress={() => router.push(`/ads/campaign/${item.id}` as any)}
            />
          ))}
        </>
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
  hero: { gap: 14, alignItems: 'center', width: '100%' },
  footer: { gap: 10, marginTop: 20 },
});
