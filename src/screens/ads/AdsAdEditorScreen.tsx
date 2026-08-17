import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { Screen } from '@/components/layout/Screen';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import { Button, Chip, Input, Muted, Subtitle, Title } from '@/components/ui';
import { resolvePublicMediaUrl, cloudWriteErrorMessage } from '@/services/cloud-write';
import { isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';
import {
  listCampaignAds,
  saveAdvertisement,
  type DbAdvertisement,
} from '@/services/advertiser-platform';
import type { NativeAdPlacement } from '@/services/native-ads';
import {
  MEDIA_SPECS,
  NATIVE_AD_VIDEO_MAX_SEC,
  NATIVE_AD_VIDEO_MIN_SEC,
  validatePickerAsset,
  videoDurationSecFromPicker,
} from '@/utils/media-limits';

const PLACEMENTS: NativeAdPlacement[] = ['general', 'unique', 'highlights'];

export default function AdsAdEditorScreen() {
  const { id, campaignId } = useLocalSearchParams<{ id: string; campaignId: string }>();
  const isNew = id === 'new';
  const { currentUser } = useTournament();
  const { t } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();

  const [advertiserName, setAdvertiserName] = useState('');
  const [advertiserHandle, setAdvertiserHandle] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [hookText, setHookText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [ctaLabel, setCtaLabel] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [durationSec, setDurationSec] = useState(String(NATIVE_AD_VIDEO_MAX_SEC));
  const [insertEveryN, setInsertEveryN] = useState('4');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [targetCountry, setTargetCountry] = useState('');
  const [targetRegion, setTargetRegion] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [status, setStatus] = useState<'draft' | 'active' | 'paused'>('draft');
  const [placements, setPlacements] = useState<NativeAdPlacement[]>(['general']);
  const [pickingVideo, setPickingVideo] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew || !id || !campaignId) return;
    void (async () => {
      const rows = await listCampaignAds(String(campaignId));
      const ad = rows.find((a) => a.id === id);
      if (!ad) return;
      fillFromDb(ad);
    })();
  }, [campaignId, id, isNew]);

  const fillFromDb = (ad: DbAdvertisement) => {
    setAdvertiserName(ad.advertiser_name);
    setAdvertiserHandle(ad.advertiser_handle || '');
    setTitle(ad.title || '');
    setText(ad.body_text || '');
    setHookText(ad.hook_text || '');
    setVideoUrl(ad.video_url);
    setPosterUrl(ad.poster_url || '');
    setCtaLabel(ad.cta_label || '');
    setCtaUrl(ad.cta_url || '');
    setDurationSec(String(ad.duration_sec));
    setInsertEveryN(String(ad.insert_every_n));
    setStartAt(ad.start_at ? ad.start_at.slice(0, 10) : '');
    setEndAt(ad.end_at ? ad.end_at.slice(0, 10) : '');
    setTargetCountry(ad.target_country || '');
    setTargetRegion(ad.target_region || '');
    setTargetCity(ad.target_city || '');
    setStatus(ad.status);
    setPlacements(
      (ad.placements || ['general']).filter((p): p is NativeAdPlacement =>
        PLACEMENTS.includes(p as NativeAdPlacement)
      )
    );
  };

  const togglePlacement = (p: NativeAdPlacement) => {
    setPlacements((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const pickVideo = useCallback(async () => {
    try {
      setPickingVideo(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        quality: 0.85,
        videoMaxDuration: NATIVE_AD_VIDEO_MAX_SEC,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const asset = result.assets[0];
      const check = validatePickerAsset('nativeAdVideo', {
        uri: asset.uri,
        duration: asset.duration,
        fileSize: asset.fileSize,
      });
      const dur = videoDurationSecFromPicker(asset.duration);
      if (!check.ok || !currentUser || !isUuid(currentUser.id) || !isSupabaseConfigured()) {
        toast({ variant: 'destructive', title: t('adsPortal.uploadFailed') });
        return;
      }
      const resolved = await resolvePublicMediaUrl({
        uri: asset.uri,
        kind: 'video',
        folder: 'native-ads',
        userId: currentUser.id,
        requireCloud: true,
      });
      if (!resolved.url) {
        toast({
          variant: 'destructive',
          title: t('adsPortal.uploadFailed'),
          description: cloudWriteErrorMessage(resolved.error),
        });
        return;
      }
      setVideoUrl(resolved.url);
      if (dur) {
        setDurationSec(
          String(Math.min(NATIVE_AD_VIDEO_MAX_SEC, Math.max(NATIVE_AD_VIDEO_MIN_SEC, Math.round(dur))))
        );
      }
      toast({ variant: 'success', title: t('adsPortal.videoReady') });
    } finally {
      setPickingVideo(false);
    }
  }, [currentUser, t, toast]);

  const save = useCallback(async () => {
    if (!campaignId || !advertiserName.trim() || !videoUrl) return;
    setSaving(true);
    try {
      const saved = await saveAdvertisement({
        id: isNew ? undefined : String(id),
        campaignId: String(campaignId),
        status,
        advertiserName: advertiserName.trim(),
        advertiserHandle: advertiserHandle.trim() || undefined,
        title: title.trim() || undefined,
        text: text.trim() || undefined,
        hookText: hookText.trim() || undefined,
        videoUrl,
        posterUrl: posterUrl.trim() || undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        ctaUrl: ctaUrl.trim() || undefined,
        durationSec: Number(durationSec) || NATIVE_AD_VIDEO_MAX_SEC,
        placements: placements.length ? placements : ['general'],
        insertEveryN: Number(insertEveryN) || 4,
        startAt: startAt ? `${startAt}T00:00:00.000Z` : undefined,
        endAt: endAt ? `${endAt}T23:59:59.000Z` : undefined,
        targetCountry: targetCountry.trim() || undefined,
        targetRegion: targetRegion.trim() || undefined,
        targetCity: targetCity.trim() || undefined,
      });
      if (!saved) {
        toast({ variant: 'destructive', title: t('adsPortal.saveFailed') });
        return;
      }
      toast({ variant: 'success', title: t('adsPortal.saved') });
      router.replace(`/ads/campaign/${campaignId}` as any);
    } finally {
      setSaving(false);
    }
  }, [
    advertiserHandle,
    advertiserName,
    campaignId,
    ctaLabel,
    ctaUrl,
    durationSec,
    endAt,
    hookText,
    id,
    insertEveryN,
    isNew,
    placements,
    posterUrl,
    router,
    startAt,
    status,
    t,
    text,
    title,
    toast,
    videoUrl,
    targetCity,
    targetCountry,
    targetRegion,
  ]);

  return (
    <Screen scroll keyboard contentStyle={styles.content}>
      <Title>{isNew ? t('adsPortal.newAd') : t('adsPortal.editAd')}</Title>
      <Muted>{t('adsPortal.adLimitsHint')}</Muted>
      <MediaUploadSpecs specKey="nativeAdVideo" />

      <Input label={t('adsPortal.advertiserName')} value={advertiserName} onChangeText={setAdvertiserName} maxLength={80} />
      <Input label={t('adsPortal.advertiserHandle')} value={advertiserHandle} onChangeText={setAdvertiserHandle} maxLength={40} />
      <Input label={t('adsPortal.adTitle')} value={title} onChangeText={setTitle} maxLength={80} />
      <Input label={t('adsPortal.hookText')} value={hookText} onChangeText={setHookText} maxLength={80} />
      <Input label={t('adsPortal.bodyText')} value={text} onChangeText={setText} multiline maxLength={240} />
      <Input label={t('adsPortal.ctaLabel')} value={ctaLabel} onChangeText={setCtaLabel} maxLength={32} />
      <Input label={t('adsPortal.ctaUrl')} value={ctaUrl} onChangeText={setCtaUrl} autoCapitalize="none" />

      <Subtitle>{t('adsPortal.appearanceRegion')}</Subtitle>
      <Input label={t('adsPortal.targetCountry')} value={targetCountry} onChangeText={setTargetCountry} maxLength={80} />
      <Input label={t('adsPortal.targetRegion')} value={targetRegion} onChangeText={setTargetRegion} maxLength={80} />
      <Input label={t('adsPortal.targetCity')} value={targetCity} onChangeText={setTargetCity} maxLength={80} />
      <Muted>{t('adsPortal.targetRegionHint')}</Muted>

      <Subtitle>{t('adsPortal.feedPlacements')}</Subtitle>
      <View style={styles.chips}>
        {PLACEMENTS.map((p) => (
          <Chip
            key={p}
            label={t(`adsPortal.placement.${p}`)}
            active={placements.includes(p)}
            onPress={() => togglePlacement(p)}
          />
        ))}
      </View>

      <Input label={t('adsPortal.startDate')} value={startAt} onChangeText={setStartAt} placeholder="YYYY-MM-DD" />
      <Input label={t('adsPortal.endDate')} value={endAt} onChangeText={setEndAt} placeholder="YYYY-MM-DD" />
      <Input label={t('adsPortal.durationSec')} value={durationSec} onChangeText={setDurationSec} keyboardType="number-pad" />
      <Input label={t('adsPortal.insertEveryN')} value={insertEveryN} onChangeText={setInsertEveryN} keyboardType="number-pad" />

      <Button
        label={pickingVideo ? t('adsPortal.uploading') : t('adsPortal.pickVideo')}
        variant="outline"
        onPress={() => void pickVideo()}
        disabled={pickingVideo}
      />
      {videoUrl ? <Muted>{t('adsPortal.videoAttached')}</Muted> : null}

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 10, paddingTop: 16, paddingBottom: 48 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
});
