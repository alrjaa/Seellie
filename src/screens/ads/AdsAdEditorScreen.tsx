import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTournament } from '@/providers/TournamentProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { useToast } from '@/providers/ToastProvider';
import { useResponsive } from '@/hooks/useResponsive';
import { Screen } from '@/components/layout/Screen';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import { AdPhonePreview } from '@/components/ads/AdPhonePreview';
import { Button, Card, Chip, Input, Muted, Subtitle, Title } from '@/components/ui';
import { resolvePublicMediaUrl, cloudWriteErrorMessage } from '@/services/cloud-write';
import { isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';
import {
  listCampaignAds,
  saveAdvertisement,
  type DbAdvertisement,
} from '@/services/advertiser-platform';
import { loadAdStudioDraft, saveAdStudioDraft } from '@/services/ad-drafts';
import type { NativeAdPlacement } from '@/services/native-ads';
import {
  MEDIA_SPECS,
  NATIVE_AD_VIDEO_MAX_SEC,
  NATIVE_AD_VIDEO_MIN_SEC,
  validatePickerAsset,
  videoDurationSecFromPicker,
} from '@/utils/media-limits';
import {
  AD_CTA_PRESETS,
  appendUtmParams,
  clampAdTrimRange,
  ctaLabelForPreset,
  detectAdAspectRatio,
  inspectAdVideoAsset,
  reviewAdVideo,
  reviewStatusFromChecks,
  type AdCtaPresetId,
  type AdReviewReasonCode,
  type AdStudioCheck,
  type AdUtmParams,
  type AdVideoProbe,
} from '@/utils/ad-video-studio';

const PLACEMENTS: NativeAdPlacement[] = ['general', 'unique', 'highlights'];

async function probeHtmlVideo(
  uri: string
): Promise<Pick<AdVideoProbe, 'durationSec' | 'width' | 'height'>> {
  if (typeof document === 'undefined') {
    return { durationSec: null, width: null, height: null };
  }
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    el.src = uri;
    const finish = () => {
      resolve({
        durationSec: Number.isFinite(el.duration) ? el.duration : null,
        width: el.videoWidth || null,
        height: el.videoHeight || null,
      });
      el.removeAttribute('src');
      el.load();
    };
    el.onloadedmetadata = finish;
    el.onerror = () =>
      resolve({ durationSec: null, width: null, height: null });
  });
}

function captureHtmlFrame(uri: string, atSec: number): Promise<string | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.crossOrigin = 'anonymous';
    el.preload = 'auto';
    el.muted = true;
    el.src = uri;
    el.onloadeddata = () => {
      try {
        el.currentTime = Math.max(0, atSec);
      } catch {
        resolve(null);
      }
    };
    el.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = el.videoWidth || 1080;
        canvas.height = el.videoHeight || 1920;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.86));
      } catch {
        resolve(null);
      }
    };
    el.onerror = () => resolve(null);
  });
}

export default function AdsAdEditorScreen() {
  const { id, campaignId } = useLocalSearchParams<{ id: string; campaignId: string }>();
  const isNew = id === 'new';
  const adKey = isNew ? 'new' : String(id || 'new');
  const { currentUser } = useTournament();
  const { t, language, isRTL } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();
  const { desktop } = useResponsive();

  const [advertiserName, setAdvertiserName] = useState('');
  const [advertiserHandle, setAdvertiserHandle] = useState('');
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [hookText, setHookText] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [localPreviewUri, setLocalPreviewUri] = useState('');
  const [posterUrl, setPosterUrl] = useState('');
  const [ctaPreset, setCtaPreset] = useState<AdCtaPresetId>('open');
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
  const [pickingCover, setPickingCover] = useState(false);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showSafeZone, setShowSafeZone] = useState(true);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(NATIVE_AD_VIDEO_MAX_SEC);
  const [probe, setProbe] = useState<AdVideoProbe>({
    durationSec: null,
    width: null,
    height: null,
    sizeMb: null,
  });
  const [utm, setUtm] = useState<AdUtmParams>({
    source: 'seellie',
    medium: 'in_feed',
  });
  const [draftHint, setDraftHint] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fillFromDb = useCallback((ad: DbAdvertisement) => {
    setAdvertiserName(ad.advertiser_name);
    setAdvertiserHandle(ad.advertiser_handle || '');
    setTitle(ad.title || '');
    setText(ad.body_text || '');
    setHookText(ad.hook_text || '');
    setVideoUrl(ad.video_url);
    setLocalPreviewUri(ad.video_url);
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
    setTrimEnd(ad.duration_sec);
    setPlacements(
      (ad.placements || ['general']).filter((p): p is NativeAdPlacement =>
        PLACEMENTS.includes(p as NativeAdPlacement)
      )
    );
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    void (async () => {
      const local = await loadAdStudioDraft(String(campaignId), adKey);
      if (local && isNew) {
        setAdvertiserName(local.advertiserName);
        setAdvertiserHandle(local.advertiserHandle);
        setTitle(local.title);
        setText(local.text);
        setHookText(local.hookText);
        setVideoUrl(local.videoUrl);
        setLocalPreviewUri(local.videoUrl);
        setPosterUrl(local.posterUrl);
        setCtaPreset(local.ctaPreset);
        setCtaLabel(local.ctaLabel);
        setCtaUrl(local.ctaUrl);
        setDurationSec(local.durationSec);
        setInsertEveryN(local.insertEveryN);
        setStartAt(local.startAt);
        setEndAt(local.endAt);
        setTargetCountry(local.targetCountry);
        setTargetRegion(local.targetRegion);
        setTargetCity(local.targetCity);
        setStatus(local.status);
        setPlacements(local.placements);
        setTrimStart(local.trimStart);
        setTrimEnd(local.trimEnd);
        setMuted(false);
        setUtm(local.utm || {});
      }
      if (isNew || !id) return;
      const rows = await listCampaignAds(String(campaignId));
      const ad = rows.find((a) => a.id === id);
      if (ad) fillFromDb(ad);
    })();
  }, [adKey, campaignId, fillFromDb, id, isNew]);

  useEffect(() => {
    if (!campaignId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveAdStudioDraft({
        campaignId: String(campaignId),
        adId: adKey,
        advertiserName,
        advertiserHandle,
        title,
        text,
        hookText,
        videoUrl,
        posterUrl,
        ctaPreset,
        ctaLabel,
        ctaUrl,
        durationSec,
        insertEveryN,
        startAt,
        endAt,
        targetCountry,
        targetRegion,
        targetCity,
        status,
        placements,
        trimStart,
        trimEnd,
        muted,
        utm,
        savedAt: new Date().toISOString(),
      }).then(() => setDraftHint(true));
    }, 900);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    adKey,
    advertiserHandle,
    advertiserName,
    campaignId,
    ctaLabel,
    ctaPreset,
    ctaUrl,
    durationSec,
    endAt,
    hookText,
    insertEveryN,
    muted,
    placements,
    posterUrl,
    startAt,
    status,
    targetCity,
    targetCountry,
    targetRegion,
    text,
    title,
    trimEnd,
    trimStart,
    utm,
    videoUrl,
  ]);

  const previewUri = localPreviewUri || videoUrl;
  const lang = language === 'en' ? 'en' : 'ar';
  const resolvedCtaLabel =
    ctaLabel.trim() || ctaLabelForPreset(ctaPreset, lang);

  const checks = useMemo<AdStudioCheck[]>(
    () =>
      reviewAdVideo({
        probe,
        uri: previewUri || videoUrl,
        ctaUrl,
        requireCta: status === 'active',
      }),
    [ctaUrl, previewUri, probe, status, videoUrl]
  );

  const pipelineStatus = reviewStatusFromChecks(checks, status, processing);
  const aspect = detectAdAspectRatio(probe.width, probe.height);

  const reasonText = (code: AdReviewReasonCode) => t(`adsPortal.reviewReason.${code}`);

  const togglePlacement = (p: NativeAdPlacement) => {
    setPlacements((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const applyTrim = (start: number, end: number) => {
    const sourceDur = probe.durationSec || Number(durationSec) || NATIVE_AD_VIDEO_MAX_SEC;
    const next = clampAdTrimRange(start, end, sourceDur);
    setTrimStart(next.start);
    setTrimEnd(next.end);
    setDurationSec(String(Math.round(next.end - next.start)));
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
      const localUri = asset.uri;
      setLocalPreviewUri(localUri);
      setProcessing(true);

      let nextProbe = inspectAdVideoAsset({
        uri: localUri,
        width: asset.width,
        height: asset.height,
        fileSize: asset.fileSize,
        duration: asset.duration,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
      });
      if (Platform.OS === 'web' && (!nextProbe.width || !nextProbe.durationSec)) {
        const html = await probeHtmlVideo(localUri);
        nextProbe = {
          ...nextProbe,
          durationSec: nextProbe.durationSec ?? html.durationSec,
          width: nextProbe.width ?? html.width,
          height: nextProbe.height ?? html.height,
        };
      }
      setProbe(nextProbe);

      const check = validatePickerAsset('nativeAdVideo', {
        uri: localUri,
        duration: asset.duration,
        fileSize: asset.fileSize,
        width: nextProbe.width ?? undefined,
        height: nextProbe.height ?? undefined,
      });
      const dur = nextProbe.durationSec ?? videoDurationSecFromPicker(asset.duration);
      if (!check.ok) {
        setProcessing(false);
        toast({
          variant: 'destructive',
          title: t('adsPortal.uploadFailed'),
          description:
            check.reason === 'size'
              ? t('media.fileTooLargeDesc', { mb: MEDIA_SPECS.nativeAdVideo.maxMb })
              : t('adsPortal.reviewReason.duration_long'),
        });
        return;
      }
      const studio = reviewAdVideo({ probe: nextProbe, uri: localUri });
      const blocked = studio.find((c) => c.level === 'block');
      if (blocked) {
        setProcessing(false);
        toast({
          variant: 'destructive',
          title: t('adsPortal.rejected'),
          description: t(`adsPortal.reviewReason.${blocked.code}`),
        });
        return;
      }
      if (!currentUser || !isUuid(currentUser.id) || !isSupabaseConfigured()) {
        setProcessing(false);
        toast({ variant: 'destructive', title: t('adsPortal.uploadFailed') });
        return;
      }
      const resolved = await resolvePublicMediaUrl({
        uri: localUri,
        kind: 'video',
        folder: 'native-ads',
        userId: currentUser.id,
        requireCloud: true,
      });
      if (!resolved.url) {
        setProcessing(false);
        toast({
          variant: 'destructive',
          title: t('adsPortal.uploadFailed'),
          description: cloudWriteErrorMessage(resolved.error),
        });
        return;
      }
      setVideoUrl(resolved.url);
      if (dur) {
        const clamped = Math.min(
          NATIVE_AD_VIDEO_MAX_SEC,
          Math.max(NATIVE_AD_VIDEO_MIN_SEC, Math.round(dur))
        );
        setDurationSec(String(clamped));
        setTrimStart(0);
        setTrimEnd(clamped);
      }
      toast({ variant: 'success', title: t('adsPortal.videoReady') });
    } finally {
      setPickingVideo(false);
      setProcessing(false);
    }
  }, [currentUser, t, toast]);

  const pickCover = useCallback(async () => {
    try {
      setPickingCover(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.86,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      if (!currentUser || !isUuid(currentUser.id) || !isSupabaseConfigured()) return;
      const resolved = await resolvePublicMediaUrl({
        uri: result.assets[0].uri,
        kind: 'photo',
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
      setPosterUrl(resolved.url);
    } finally {
      setPickingCover(false);
    }
  }, [currentUser, t, toast]);

  const captureCover = useCallback(async () => {
    if (!previewUri) return;
    const dataUrl = await captureHtmlFrame(previewUri, trimStart || 0.4);
    if (!dataUrl || !currentUser || !isUuid(currentUser.id)) {
      toast({
        variant: 'destructive',
        title: t('adsPortal.coverCaptureFailed'),
      });
      return;
    }
    const resolved = await resolvePublicMediaUrl({
      uri: dataUrl,
      kind: 'photo',
      folder: 'native-ads',
      userId: currentUser.id,
      requireCloud: true,
    });
    if (!resolved.url) {
      toast({
        variant: 'destructive',
        title: t('adsPortal.coverCaptureFailed'),
      });
      return;
    }
    setPosterUrl(resolved.url);
    toast({ variant: 'success', title: t('adsPortal.coverReady') });
  }, [currentUser, previewUri, t, toast, trimStart]);

  const save = useCallback(async () => {
    if (!campaignId || !advertiserName.trim() || !videoUrl) {
      toast({
        variant: 'destructive',
        title: t('adsPortal.saveFailed'),
        description: t('adsPortal.reviewReason.missing_video'),
      });
      return;
    }
    const publishChecks = reviewAdVideo({
      probe,
      uri: videoUrl,
      ctaUrl,
      requireCta: status === 'active',
    });
    const blocked = publishChecks.find((c) => c.level === 'block');
    if (blocked) {
      toast({
        variant: 'destructive',
        title: t('adsPortal.rejected'),
        description: t(`adsPortal.reviewReason.${blocked.code}`),
      });
      return;
    }
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
        ctaLabel: resolvedCtaLabel,
        ctaUrl: appendUtmParams(ctaUrl.trim(), utm) || undefined,
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
    ctaUrl,
    durationSec,
    endAt,
    hookText,
    id,
    insertEveryN,
    isNew,
    placements,
    posterUrl,
    probe,
    resolvedCtaLabel,
    router,
    startAt,
    status,
    t,
    text,
    title,
    toast,
    utm,
    videoUrl,
    targetCity,
    targetCountry,
    targetRegion,
  ]);

  const form = (
    <View style={styles.formCol}>
      <Title>{isNew ? t('adsPortal.newAd') : t('adsPortal.editAd')}</Title>
      <Muted>{t('adsPortal.studioIntro')}</Muted>
      <MediaUploadSpecs
        kind="nativeAdVideo"
        title={t('media.specs.nativeAdTitle')}
      />

      <Card style={styles.statusCard}>
        <Subtitle>{t('adsPortal.pipelineTitle')}</Subtitle>
        <Muted>{t(`adsPortal.pipeline.${pipelineStatus}`)}</Muted>
        {draftHint ? <Muted>{t('adsPortal.autoSaved')}</Muted> : null}
        {checks.map((c) => (
          <Muted key={c.code}>
            {c.level === 'block' ? '• ' : '⚠ '}
            {reasonText(c.code)}
          </Muted>
        ))}
        {previewUri ? (
          <Muted>
            {t('adsPortal.detectedSpec', {
              aspect,
              w: probe.width || '—',
              h: probe.height || '—',
              sec: probe.durationSec
                ? Math.round(probe.durationSec * 10) / 10
                : durationSec,
              mb: probe.sizeMb ? Math.round(probe.sizeMb * 10) / 10 : '—',
            })}
          </Muted>
        ) : null}
        <Muted>{t('adsPortal.transcodeHint')}</Muted>
      </Card>

      <Button
        label={
          pickingVideo
            ? t('adsPortal.uploading')
            : previewUri
              ? t('adsPortal.changeVideo')
              : t('adsPortal.pickVideo')
        }
        onPress={() => void pickVideo()}
        loading={pickingVideo}
        disabled={pickingVideo}
      />

      {previewUri ? (
        <>
          <Subtitle>{t('adsPortal.trimmer')}</Subtitle>
          <Muted>{t('adsPortal.trimmerHint')}</Muted>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Input
                label={t('adsPortal.trimStart')}
                value={String(trimStart)}
                onChangeText={(v) => applyTrim(Number(v) || 0, trimEnd)}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label={t('adsPortal.trimEnd')}
                value={String(trimEnd)}
                onChangeText={(v) => applyTrim(trimStart, Number(v) || trimEnd)}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
          <View style={styles.chips}>
            <Chip
              label={muted ? t('adsPortal.audioMuted') : t('adsPortal.audioOn')}
              active={!muted}
              onPress={() => setMuted((v) => !v)}
            />
            <Chip
              label={t('adsPortal.safeZoneToggle')}
              active={showSafeZone}
              onPress={() => setShowSafeZone((v) => !v)}
            />
          </View>
          <View style={styles.row}>
            <Button
              label={pickingCover ? t('adsPortal.uploading') : t('adsPortal.pickCover')}
              variant="outline"
              onPress={() => void pickCover()}
              disabled={pickingCover}
              style={{ flex: 1 }}
            />
            {Platform.OS === 'web' ? (
              <Button
                label={t('adsPortal.captureCover')}
                variant="outline"
                onPress={() => void captureCover()}
                style={{ flex: 1 }}
              />
            ) : null}
          </View>
        </>
      ) : null}

      <Input
        label={t('adsPortal.advertiserName')}
        value={advertiserName}
        onChangeText={setAdvertiserName}
        maxLength={80}
      />
      <Input
        label={t('adsPortal.advertiserHandle')}
        value={advertiserHandle}
        onChangeText={setAdvertiserHandle}
        maxLength={40}
      />
      <Input label={t('adsPortal.adTitle')} value={title} onChangeText={setTitle} maxLength={80} />
      <Input
        label={t('adsPortal.hookText')}
        value={hookText}
        onChangeText={setHookText}
        maxLength={80}
      />
      <Input
        label={t('adsPortal.bodyText')}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={240}
      />

      <Subtitle>{t('adsPortal.ctaTitle')}</Subtitle>
      <View style={styles.chips}>
        {AD_CTA_PRESETS.map((p) => (
          <Chip
            key={p.id}
            label={lang === 'ar' ? p.ar : p.en}
            active={ctaPreset === p.id}
            onPress={() => {
              setCtaPreset(p.id);
              setCtaLabel(ctaLabelForPreset(p.id, lang));
            }}
          />
        ))}
      </View>
      <Input
        label={t('adsPortal.ctaLabel')}
        value={ctaLabel}
        onChangeText={setCtaLabel}
        maxLength={32}
      />
      <Input
        label={t('adsPortal.ctaUrl')}
        value={ctaUrl}
        onChangeText={setCtaUrl}
        autoCapitalize="none"
      />
      <Muted>{t('adsPortal.deepLinkHint')}</Muted>
      <Input
        label={t('adsPortal.utmSource')}
        value={utm.source || ''}
        onChangeText={(source) => setUtm((p) => ({ ...p, source }))}
      />
      <Input
        label={t('adsPortal.utmMedium')}
        value={utm.medium || ''}
        onChangeText={(medium) => setUtm((p) => ({ ...p, medium }))}
      />
      <Input
        label={t('adsPortal.utmCampaign')}
        value={utm.campaign || ''}
        onChangeText={(campaign) => setUtm((p) => ({ ...p, campaign }))}
      />
      <Input
        label={t('adsPortal.utmContent')}
        value={utm.content || ''}
        onChangeText={(content) => setUtm((p) => ({ ...p, content }))}
      />

      <Subtitle>{t('adsPortal.appearanceRegion')}</Subtitle>
      <Input
        label={t('adsPortal.targetCountry')}
        value={targetCountry}
        onChangeText={setTargetCountry}
        maxLength={80}
      />
      <Input
        label={t('adsPortal.targetRegion')}
        value={targetRegion}
        onChangeText={setTargetRegion}
        maxLength={80}
      />
      <Input
        label={t('adsPortal.targetCity')}
        value={targetCity}
        onChangeText={setTargetCity}
        maxLength={80}
      />
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

      <Input
        label={t('adsPortal.startDate')}
        value={startAt}
        onChangeText={setStartAt}
        placeholder="YYYY-MM-DD"
      />
      <Input
        label={t('adsPortal.endDate')}
        value={endAt}
        onChangeText={setEndAt}
        placeholder="YYYY-MM-DD"
      />
      <Input
        label={t('adsPortal.insertEveryN')}
        value={insertEveryN}
        onChangeText={setInsertEveryN}
        keyboardType="number-pad"
      />

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

      <Button
        label={t('common.save')}
        onPress={() => void save()}
        disabled={saving || processing}
        loading={saving}
      />
    </View>
  );

  return (
    <Screen scroll keyboard density="wide" contentStyle={styles.content}>
      <View style={[styles.layout, desktop && styles.layoutDesktop]}>
        {form}
        <View style={styles.previewCol}>
          <Subtitle>{t('adsPortal.livePreview')}</Subtitle>
          <Muted>{t('adsPortal.safeZoneHint')}</Muted>
          <AdPhonePreview
            videoUri={previewUri}
            posterUri={posterUrl}
            advertiserName={advertiserName}
            hookText={hookText}
            title={title}
            ctaLabel={resolvedCtaLabel}
            muted={muted}
            trimStart={trimStart}
            trimEnd={trimEnd}
            showSafeZone={showSafeZone}
            tapToUnmuteLabel={t('adsPortal.tapToHear')}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 12, paddingTop: 16, paddingBottom: 48 },
  layout: { gap: 20, width: '100%' },
  layoutDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  formCol: { flex: 1, gap: 10, minWidth: 280 },
  previewCol: { gap: 10, width: 300, alignSelf: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  statusCard: { gap: 6, padding: 12 },
});
