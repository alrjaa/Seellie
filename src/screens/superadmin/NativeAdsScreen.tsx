import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTournament } from '@/providers/TournamentProvider';
import { useAppTheme } from '@/providers/ThemeProvider';
import { useToast } from '@/providers/ToastProvider';
import { useTranslation } from '@/providers/LanguageProvider';
import { Screen } from '@/components/layout/Screen';
import { EmptyState } from '@/components/feedback/EmptyState';
import {
  Button,
  Card,
  Chip,
  Input,
  Muted,
  SearchBar,
  Subtitle,
  Title,
} from '@/components/ui';
import { MediaUploadSpecs } from '@/components/media/MediaUploadSpecs';
import { AdPhonePreview } from '@/components/ads/AdPhonePreview';
import { createId } from '@/utils/id';
import { matchesSearchQuery } from '@/utils/search';
import { confirmDestructive } from '@/utils/confirm';
import { resolvePublicMediaUrl, cloudWriteErrorMessage } from '@/services/cloud-write';
import { isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';
import {
  adminModerateAdvertisement,
  adminSetAdvertisementStatus,
  listAdminAdvertisements,
  listPendingAdvertisements,
  type AdminModerateAction,
  type DbAdvertisement,
} from '@/services/advertiser-platform';
import {
  fetchAppBlob,
  upsertAppBlob,
} from '@/services/supabase-app-blobs';
import {
  NATIVE_ADS_BLOB_KEY,
  isNativeAdScheduleEnded,
  isNativeAdScheduleUpcoming,
  sanitizeNativeAd,
  sanitizeNativeAdsPayload,
  type NativeAdPlacement,
  type NativeAdStatus,
  type NativeInFeedAd,
} from '@/services/native-ads';
import {
  MEDIA_SPECS,
  NATIVE_AD_VIDEO_MAX_SEC,
  NATIVE_AD_VIDEO_MIN_SEC,
  validatePickerAsset,
  videoDurationSecFromPicker,
} from '@/utils/media-limits';

const PLACEMENTS: NativeAdPlacement[] = ['general', 'unique', 'highlights'];
const STATUSES: NativeAdStatus[] = ['draft', 'active', 'paused'];

type Draft = {
  id: string;
  advertiserName: string;
  advertiserHandle: string;
  title: string;
  text: string;
  hookText: string;
  videoUrl: string;
  posterUrl: string;
  ctaLabel: string;
  ctaUrl: string;
  durationSec: string;
  insertEveryN: string;
  startAt: string;
  endAt: string;
  status: NativeAdStatus;
  placements: NativeAdPlacement[];
};

function emptyDraft(): Draft {
  return {
    id: '',
    advertiserName: '',
    advertiserHandle: '',
    title: '',
    text: '',
    hookText: '',
    videoUrl: '',
    posterUrl: '',
    ctaLabel: '',
    ctaUrl: '',
    durationSec: String(NATIVE_AD_VIDEO_MAX_SEC),
    insertEveryN: '4',
    startAt: '',
    endAt: '',
    status: 'draft',
    placements: ['general'],
  };
}

function matchesDbAd(query: string, row: DbAdvertisement): boolean {
  return matchesSearchQuery(
    query,
    row.id,
    row.advertiser_id,
    row.campaign_id,
    row.advertiser_name,
    row.advertiser_handle,
    row.title,
    row.hook_text,
    row.body_text,
    row.owner_email,
    row.account_business_name,
    row.account_contact_name,
    row.status
  );
}

function matchesBlobAd(query: string, ad: NativeInFeedAd): boolean {
  return matchesSearchQuery(
    query,
    ad.id,
    ad.advertiserName,
    ad.advertiserHandle,
    ad.title,
    ad.hookText,
    ad.text,
    ad.status
  );
}

function adToDraft(ad: NativeInFeedAd): Draft {
  return {
    id: ad.id,
    advertiserName: ad.advertiserName,
    advertiserHandle: ad.advertiserHandle || '',
    title: ad.title || '',
    text: ad.text || '',
    hookText: ad.hookText || '',
    videoUrl: ad.videoUrl,
    posterUrl: ad.posterUrl || '',
    ctaLabel: ad.ctaLabel || '',
    ctaUrl: ad.ctaUrl || '',
    durationSec: String(ad.durationSec),
    insertEveryN: String(ad.insertEveryN),
    startAt: (ad.startAt || '').slice(0, 10),
    endAt: (ad.endAt || '').slice(0, 10),
    status: ad.status,
    placements: ad.placements.length ? ad.placements : ['general'],
  };
}

export default function NativeAdsScreen() {
  const theme = useAppTheme();
  const { toast } = useToast();
  const { t, isRTL } = useTranslation();
  const { currentUser } = useTournament();
  const [ads, setAds] = useState<NativeInFeedAd[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickingVideo, setPickingVideo] = useState(false);
  const [pickingPoster, setPickingPoster] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [pendingDb, setPendingDb] = useState<DbAdvertisement[]>([]);
  const [adminDb, setAdminDb] = useState<DbAdvertisement[]>([]);
  const [pendingDbError, setPendingDbError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [previewListId, setPreviewListId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  /** Force re-split of live vs ended when schedule windows expire. */
  const [scheduleTick, setScheduleTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setScheduleTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const liveBlobAds = useMemo(
    () =>
      ads.filter(
        (ad) =>
          !isNativeAdScheduleEnded(ad) &&
          !isNativeAdScheduleUpcoming(ad) &&
          matchesBlobAd(searchQuery, ad)
      ),
    [ads, scheduleTick, searchQuery]
  );

  const endedBlobAds = useMemo(
    () =>
      ads.filter(
        (ad) =>
          isNativeAdScheduleEnded(ad) && matchesBlobAd(searchQuery, ad)
      ),
    [ads, scheduleTick, searchQuery]
  );

  const liveAdminDb = useMemo(
    () =>
      adminDb.filter(
        (row) =>
          !isNativeAdScheduleEnded(row) &&
          !isNativeAdScheduleUpcoming(row) &&
          row.status !== 'blocked' &&
          row.status !== 'deleted' &&
          matchesDbAd(searchQuery, row)
      ),
    [adminDb, scheduleTick, searchQuery]
  );

  const endedAdminDb = useMemo(
    () =>
      adminDb.filter(
        (row) =>
          isNativeAdScheduleEnded(row) && matchesDbAd(searchQuery, row)
      ),
    [adminDb, scheduleTick, searchQuery]
  );

  const filteredPendingDb = useMemo(
    () => pendingDb.filter((row) => matchesDbAd(searchQuery, row)),
    [pendingDb, searchQuery]
  );

  const load = useCallback(async () => {
    const [res, pending, admin] = await Promise.all([
      fetchAppBlob<unknown>(NATIVE_ADS_BLOB_KEY),
      listPendingAdvertisements(),
      listAdminAdvertisements(),
    ]);
    setAds(sanitizeNativeAdsPayload(res.data));
    const adminRows = admin.data ?? [];
    if (admin.error && admin.error !== 'schema_missing') {
      setPendingDbError(admin.error);
    } else {
      setPendingDbError(pending.error ?? null);
    }
    setPendingDb(
      adminRows.length
        ? adminRows.filter((row) => row.status === 'pending_review')
        : pending.data ?? []
    );
    setAdminDb(adminRows.filter((row) => row.status !== 'pending_review'));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (next: NativeInFeedAd[]) => {
      const cleaned = sanitizeNativeAdsPayload(next);
      const res = await upsertAppBlob(NATIVE_ADS_BLOB_KEY, cleaned);
      if (!res.ok) {
        toast({
          variant: 'destructive',
          title: t('superadmin.ads.saveFailed'),
          description: res.error,
        });
        return false;
      }
      setAds(cleaned);
      return true;
    },
    [t, toast]
  );

  const resetForm = () => {
    setDraft(emptyDraft());
    setFormOpen(false);
  };

  const openAdd = () => {
    setDraft(emptyDraft());
    setFormOpen(true);
  };

  const openEdit = (ad: NativeInFeedAd) => {
    setDraft(adToDraft(ad));
    setFormOpen(true);
  };

  const pickVideo = useCallback(async () => {
    try {
      setPickingVideo(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast({
          variant: 'destructive',
          title: t('superadmin.ads.permissionTitle'),
          description: t('superadmin.ads.permissionDesc'),
        });
        return;
      }
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
      const durationSec = videoDurationSecFromPicker(asset.duration);
      if (!check.ok) {
        if (check.reason === 'size') {
          toast({
            variant: 'destructive',
            title: t('media.fileTooLarge'),
            description: t('media.fileTooLargeDesc', {
              mb: MEDIA_SPECS.nativeAdVideo.maxMb,
            }),
          });
        } else if (
          durationSec != null &&
          durationSec + 0.5 < NATIVE_AD_VIDEO_MIN_SEC
        ) {
          toast({
            variant: 'destructive',
            title: t('media.videoTooShort'),
            description: t('media.videoTooShortDesc', {
              sec: NATIVE_AD_VIDEO_MIN_SEC,
            }),
          });
        } else {
          toast({
            variant: 'destructive',
            title: t('media.videoTooLong'),
            description: t('media.videoTooLongDesc', {
              sec: NATIVE_AD_VIDEO_MAX_SEC,
            }),
          });
        }
        return;
      }
      if (
        !currentUser ||
        !isUuid(currentUser.id) ||
        !isSupabaseConfigured()
      ) {
        toast({
          variant: 'destructive',
          title: t('superadmin.ads.cloudRequired'),
        });
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
          title: t('superadmin.ads.uploadFailed'),
          description: cloudWriteErrorMessage(resolved.error),
        });
        return;
      }
      setDraft((prev) => ({
        ...prev,
        videoUrl: resolved.url!,
        durationSec: String(
          durationSec
            ? Math.min(
                NATIVE_AD_VIDEO_MAX_SEC,
                Math.max(NATIVE_AD_VIDEO_MIN_SEC, Math.round(durationSec))
              )
            : NATIVE_AD_VIDEO_MAX_SEC
        ),
      }));
      toast({
        variant: 'success',
        title: t('superadmin.ads.videoReady'),
      });
    } catch {
      toast({
        variant: 'destructive',
        title: t('superadmin.ads.uploadFailed'),
      });
    } finally {
      setPickingVideo(false);
    }
  }, [currentUser, t, toast]);

  const pickPoster = useCallback(async () => {
    try {
      setPickingPoster(true);
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        toast({
          variant: 'destructive',
          title: t('superadmin.ads.permissionTitle'),
          description: t('superadmin.ads.permissionDesc'),
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]?.uri) return;
      const asset = result.assets[0];
      if (
        !currentUser ||
        !isUuid(currentUser.id) ||
        !isSupabaseConfigured()
      ) {
        toast({
          variant: 'destructive',
          title: t('superadmin.ads.cloudRequired'),
        });
        return;
      }
      const resolved = await resolvePublicMediaUrl({
        uri: asset.uri,
        kind: 'photo',
        folder: 'native-ads',
        userId: currentUser.id,
        requireCloud: true,
      });
      if (!resolved.url) {
        toast({
          variant: 'destructive',
          title: t('superadmin.ads.uploadFailed'),
          description: cloudWriteErrorMessage(resolved.error),
        });
        return;
      }
      setDraft((prev) => ({ ...prev, posterUrl: resolved.url! }));
    } catch {
      toast({
        variant: 'destructive',
        title: t('superadmin.ads.uploadFailed'),
      });
    } finally {
      setPickingPoster(false);
    }
  }, [currentUser, t, toast]);

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const existing = ads.find((a) => a.id === draft.id);
      const candidate = sanitizeNativeAd({
        id: draft.id || createId('ad'),
        status: draft.status,
        advertiserName: draft.advertiserName,
        advertiserHandle: draft.advertiserHandle,
        title: draft.title,
        text: draft.text,
        hookText: draft.hookText,
        videoUrl: draft.videoUrl,
        posterUrl: draft.posterUrl,
        ctaLabel: draft.ctaLabel,
        ctaUrl: draft.ctaUrl,
        durationSec: draft.durationSec,
        insertEveryN: draft.insertEveryN,
        placements: draft.placements,
        startAt: draft.startAt || undefined,
        endAt: draft.endAt || undefined,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      });
      if (!candidate) {
        toast({
          variant: 'destructive',
          title: t('superadmin.ads.needBasics'),
        });
        return;
      }
      const next = existing
        ? ads.map((a) => (a.id === existing.id ? candidate : a))
        : [candidate, ...ads];
      const ok = await persist(next);
      if (ok) {
        toast({
          variant: 'success',
          title: t('superadmin.ads.savedTitle'),
          description: t('superadmin.ads.savedDesc'),
        });
        resetForm();
      }
    } finally {
      setSaving(false);
    }
  }, [ads, draft, persist, saving, t, toast]);

  const remove = useCallback(
    async (id: string) => {
      const target = ads.find((a) => a.id === id);
      const ok = await confirmDestructive({
        title: t('superadmin.ads.deleteTitle'),
        message: t('superadmin.ads.deleteConfirm', {
          name: target?.advertiserName || '',
        }),
        cancelLabel: t('common.cancel'),
        confirmLabel: t('common.delete'),
      });
      if (!ok) return;
      const persisted = await persist(ads.filter((a) => a.id !== id));
      if (persisted) {
        toast({ title: t('superadmin.ads.removed') });
        if (draft.id === id) resetForm();
      }
    },
    [ads, draft.id, persist, t, toast]
  );

  const togglePlacement = (key: NativeAdPlacement) => {
    setDraft((prev) => {
      const has = prev.placements.includes(key);
      const next = has
        ? prev.placements.filter((p) => p !== key)
        : [...prev.placements, key];
      return { ...prev, placements: next.length ? next : [key] };
    });
  };

  const reviewDbAd = useCallback(
    async (adId: string, next: 'active' | 'draft') => {
      let note = '';
      if (
        next === 'draft' &&
        Platform.OS === 'web' &&
        typeof window !== 'undefined'
      ) {
        note = String(
          window.prompt(t('superadmin.ads.rejectNoteHint')) || ''
        )
          .trim()
          .slice(0, 240);
      }
      setReviewingId(adId);
      try {
        const { data, error } = await adminSetAdvertisementStatus(
          adId,
          next,
          note
        );
        if (!data) {
          toast({
            variant: 'destructive',
            title: t('superadmin.ads.saveFailed'),
            description: error,
          });
          return;
        }
        toast({
          variant: 'success',
          title:
            next === 'active'
              ? t('superadmin.ads.pendingDbApproved')
              : t('superadmin.ads.pendingDbRejectedNotified'),
        });
        await load();
      } finally {
        setReviewingId(null);
      }
    },
    [load, t, toast]
  );

  const moderateDbAd = useCallback(
    async (row: DbAdvertisement, action: AdminModerateAction) => {
      const ok = await confirmDestructive({
        title:
          action === 'block'
            ? t('superadmin.ads.blockTitle')
            : t('superadmin.ads.deleteDbTitle'),
        message:
          action === 'block'
            ? t('superadmin.ads.blockConfirm', {
                name: row.advertiser_name,
              })
            : t('superadmin.ads.deleteDbConfirm', {
                name: row.advertiser_name,
              }),
        confirmLabel:
          action === 'block'
            ? t('superadmin.ads.block')
            : t('common.delete'),
      });
      if (!ok) return;
      let note = '';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        note = String(
          window.prompt(t('superadmin.ads.moderationNoteHint')) || ''
        )
          .trim()
          .slice(0, 240);
      }
      setReviewingId(row.id);
      try {
        const { data, error } = await adminModerateAdvertisement(
          row.id,
          action,
          note
        );
        if (!data) {
          toast({
            variant: 'destructive',
            title: t('superadmin.ads.saveFailed'),
            description: t(`adsPortal.saveError.${error || 'unknown'}`),
          });
          return;
        }
        toast({
          variant: 'success',
          title:
            action === 'block'
              ? t('superadmin.ads.blockedAndNotified')
              : t('superadmin.ads.deletedAndNotified'),
        });
        await load();
      } finally {
        setReviewingId(null);
      }
    },
    [load, t, toast]
  );

  const setBlobStatus = useCallback(
    async (id: string, status: NativeAdStatus) => {
      const target = ads.find((a) => a.id === id);
      if (!target) return;
      if (status === 'paused') {
        const ok = await confirmDestructive({
          title: t('superadmin.ads.blockTitle'),
          message: t('superadmin.ads.blockBlobConfirm', {
            name: target.advertiserName,
          }),
          confirmLabel: t('superadmin.ads.block'),
        });
        if (!ok) return;
      }
      const next = ads.map((a) =>
        a.id === id
          ? { ...a, status, updatedAt: new Date().toISOString() }
          : a
      );
      const persisted = await persist(next);
      if (persisted) {
        toast({
          title:
            status === 'paused'
              ? t('superadmin.ads.blockedBlob')
              : t('superadmin.ads.unblockedBlob'),
        });
      }
    },
    [ads, persist, t, toast]
  );

  const header = useMemo(
    () => (
      <View style={{ gap: 10, marginBottom: 8 }}>
        <Title>{t('superadmin.modules.ads.title')}</Title>
        <Muted>{t('superadmin.ads.subtitle')}</Muted>
        <Muted>{t('superadmin.ads.specHint')}</Muted>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder={t('superadmin.ads.searchPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Subtitle>{t('superadmin.ads.pendingDbTitle')}</Subtitle>
        {pendingDbError ? (
          <Muted>{t('superadmin.ads.pendingDbLoadFailed')}</Muted>
        ) : filteredPendingDb.length === 0 ? (
          <Muted>
            {searchQuery.trim()
              ? t('superadmin.noSearchResults')
              : t('superadmin.ads.pendingDbEmpty')}
          </Muted>
        ) : (
          filteredPendingDb.map((row) => (
            <Card key={row.id} style={{ gap: 8 }}>
              <Subtitle>{row.advertiser_name}</Subtitle>
              <Muted>
                {t('superadmin.ads.adIdLabel')}: {row.id}
              </Muted>
              {row.owner_email ? (
                <Muted>
                  {t('superadmin.ads.adEmailLabel')}: {row.owner_email}
                </Muted>
              ) : null}
              {(row.advertiser_handle || row.account_business_name) && (
                <Muted>
                  {[row.advertiser_handle, row.account_business_name]
                    .filter(Boolean)
                    .join(' · ')}
                </Muted>
              )}
              <Muted numberOfLines={2}>{row.title || row.video_url}</Muted>
              <View style={styles.phonePreviewBox}>
                <Subtitle>{t('superadmin.ads.phonePreviewTitle')}</Subtitle>
                <Muted>{t('superadmin.ads.phonePreviewHint')}</Muted>
                <AdPhonePreview
                  videoUri={row.video_url}
                  posterUri={row.poster_url || undefined}
                  advertiserName={row.advertiser_name}
                  hookText={row.hook_text || undefined}
                  title={row.title || undefined}
                  ctaLabel={row.cta_label || undefined}
                  isRTL={isRTL}
                  tapToUnmuteLabel={t('adsPortal.tapToHear')}
                />
              </View>
              <View style={styles.formActionsWrap}>
                <Button
                  label={t('superadmin.ads.pendingDbApprove')}
                  onPress={() => void reviewDbAd(row.id, 'active')}
                  loading={reviewingId === row.id}
                  disabled={!!reviewingId}
                  style={{ flexGrow: 1 }}
                />
                <Button
                  label={t('superadmin.ads.pendingDbReject')}
                  variant="outline"
                  onPress={() => void reviewDbAd(row.id, 'draft')}
                  loading={reviewingId === row.id}
                  disabled={!!reviewingId}
                  style={{ flexGrow: 1 }}
                />
                <Button
                  label={t('superadmin.ads.block')}
                  variant="outline"
                  onPress={() => void moderateDbAd(row, 'block')}
                  loading={reviewingId === row.id}
                  disabled={!!reviewingId}
                  style={{ flexGrow: 1 }}
                />
                <Button
                  label={t('superadmin.ads.deleteDb')}
                  variant="danger"
                  onPress={() => void moderateDbAd(row, 'delete')}
                  loading={reviewingId === row.id}
                  disabled={!!reviewingId}
                  style={{ flexGrow: 1 }}
                />
              </View>
            </Card>
          ))
        )}
        <Subtitle>{t('superadmin.ads.liveDbTitle')}</Subtitle>
        <Muted>{t('superadmin.ads.liveDbScheduleHint')}</Muted>
        {liveAdminDb.length === 0 ? (
          <Muted>
            {searchQuery.trim()
              ? t('superadmin.noSearchResults')
              : t('superadmin.ads.liveDbEmpty')}
          </Muted>
        ) : (
          liveAdminDb.map((row) => (
            <Card key={row.id} style={{ gap: 8 }}>
              <Subtitle>{row.advertiser_name}</Subtitle>
              <Muted>
                {t('superadmin.ads.adIdLabel')}: {row.id}
              </Muted>
              {row.owner_email ? (
                <Muted>
                  {t('superadmin.ads.adEmailLabel')}: {row.owner_email}
                </Muted>
              ) : null}
              <Muted>
                {t(`adsPortal.status.${row.status}`)} ·{' '}
                {row.title || row.video_url}
              </Muted>
              <Button
                label={
                  previewListId === row.id
                    ? t('superadmin.ads.hidePhonePreview')
                    : t('superadmin.ads.showPhonePreview')
                }
                variant="outline"
                onPress={() =>
                  setPreviewListId((cur) => (cur === row.id ? null : row.id))
                }
              />
              {previewListId === row.id ? (
                <View style={styles.phonePreviewBox}>
                  <Muted>{t('superadmin.ads.phonePreviewHint')}</Muted>
                  <AdPhonePreview
                    videoUri={row.video_url}
                    posterUri={row.poster_url || undefined}
                    advertiserName={row.advertiser_name}
                    hookText={row.hook_text || undefined}
                    title={row.title || undefined}
                    ctaLabel={row.cta_label || undefined}
                    isRTL={isRTL}
                    tapToUnmuteLabel={t('adsPortal.tapToHear')}
                  />
                </View>
              ) : null}
              <View style={styles.formActionsWrap}>
                {row.status === 'blocked' ? (
                  <Muted>{t('superadmin.ads.alreadyBlocked')}</Muted>
                ) : (
                  <Button
                    label={t('superadmin.ads.block')}
                    variant="outline"
                    onPress={() => void moderateDbAd(row, 'block')}
                    loading={reviewingId === row.id}
                    disabled={!!reviewingId}
                    style={{ flexGrow: 1 }}
                  />
                )}
                <Button
                  label={t('superadmin.ads.deleteDb')}
                  variant="danger"
                  onPress={() => void moderateDbAd(row, 'delete')}
                  loading={reviewingId === row.id}
                  disabled={!!reviewingId}
                  style={{ flexGrow: 1 }}
                />
              </View>
            </Card>
          ))
        )}
        {endedAdminDb.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Subtitle>{t('superadmin.ads.endedDbTitle')}</Subtitle>
            <Muted>{t('superadmin.ads.endedDbHint')}</Muted>
            {endedAdminDb.map((row) => (
              <Card key={`ended-${row.id}`} style={{ gap: 6 }}>
                <Subtitle>{row.advertiser_name}</Subtitle>
                <Muted>
                  {t('superadmin.ads.adIdLabel')}: {row.id}
                </Muted>
                {row.owner_email ? (
                  <Muted>
                    {t('superadmin.ads.adEmailLabel')}: {row.owner_email}
                  </Muted>
                ) : null}
                <Muted>
                  {t('superadmin.ads.endedBadge')} ·{' '}
                  {(row.end_at || '').slice(0, 10) || '—'} ·{' '}
                  {row.title || row.video_url}
                </Muted>
              </Card>
            ))}
          </View>
        ) : null}
        <Button label={t('superadmin.ads.add')} onPress={openAdd} />
        {formOpen ? (
          <Card style={{ gap: 10 }}>
            <Subtitle>
              {draft.id
                ? t('superadmin.actions.edit')
                : t('superadmin.ads.newAd')}
            </Subtitle>
            <View style={styles.formWithPreview}>
              <View style={styles.formFields}>
            <MediaUploadSpecs
              kind="nativeAdVideo"
              title={t('media.specs.nativeAdTitle')}
            />
            <Input
              label={t('superadmin.ads.advertiserName')}
              value={draft.advertiserName}
              onChangeText={(advertiserName) =>
                setDraft((p) => ({ ...p, advertiserName }))
              }
            />
            <Input
              label={t('superadmin.ads.advertiserHandle')}
              value={draft.advertiserHandle}
              onChangeText={(advertiserHandle) =>
                setDraft((p) => ({ ...p, advertiserHandle }))
              }
              ltr
              autoCapitalize="none"
            />
            <Input
              label={t('superadmin.ads.hookText')}
              value={draft.hookText}
              onChangeText={(hookText) => setDraft((p) => ({ ...p, hookText }))}
            />
            <Muted>{t('superadmin.ads.hookHint')}</Muted>
            <Input
              label={t('superadmin.ads.titleField')}
              value={draft.title}
              onChangeText={(title) => setDraft((p) => ({ ...p, title }))}
            />
            <Input
              label={t('superadmin.ads.textField')}
              value={draft.text}
              onChangeText={(text) => setDraft((p) => ({ ...p, text }))}
              multiline
            />
            <Button
              label={
                pickingVideo
                  ? t('superadmin.ads.pickingVideo')
                  : draft.videoUrl
                    ? t('superadmin.ads.changeVideo')
                    : t('superadmin.ads.pickVideo')
              }
              onPress={() => void pickVideo()}
              loading={pickingVideo}
              disabled={pickingVideo}
            />
            {draft.videoUrl ? (
              <Muted numberOfLines={2}>{draft.videoUrl}</Muted>
            ) : null}
            <Button
              label={
                pickingPoster
                  ? t('superadmin.ads.pickingPoster')
                  : t('superadmin.ads.pickPoster')
              }
              variant="outline"
              onPress={() => void pickPoster()}
              loading={pickingPoster}
              disabled={pickingPoster}
            />
            {draft.posterUrl ? (
              <Image
                source={{ uri: draft.posterUrl }}
                style={styles.poster}
                resizeMode="cover"
              />
            ) : null}
            <Input
              label={t('superadmin.ads.ctaLabel')}
              value={draft.ctaLabel}
              onChangeText={(ctaLabel) => setDraft((p) => ({ ...p, ctaLabel }))}
            />
            <Input
              label={t('superadmin.ads.ctaUrl')}
              value={draft.ctaUrl}
              onChangeText={(ctaUrl) => setDraft((p) => ({ ...p, ctaUrl }))}
              ltr
              autoCapitalize="none"
              keyboardType="url"
            />
            <Input
              label={t('superadmin.ads.insertEveryN')}
              value={draft.insertEveryN}
              onChangeText={(insertEveryN) =>
                setDraft((p) => ({ ...p, insertEveryN }))
              }
              keyboardType="number-pad"
              ltr
            />
            <Input
              label={t('superadmin.ads.startAt')}
              value={draft.startAt}
              onChangeText={(startAt) => setDraft((p) => ({ ...p, startAt }))}
              placeholder="YYYY-MM-DD"
              ltr
            />
            <Input
              label={t('superadmin.ads.endAt')}
              value={draft.endAt}
              onChangeText={(endAt) => setDraft((p) => ({ ...p, endAt }))}
              placeholder="YYYY-MM-DD"
              ltr
            />
            <Muted>{t('superadmin.ads.statusLabel')}</Muted>
            <View style={styles.chips}>
              {STATUSES.map((status) => (
                <Chip
                  key={status}
                  label={t(`superadmin.ads.status.${status}`)}
                  active={draft.status === status}
                  onPress={() => setDraft((p) => ({ ...p, status }))}
                />
              ))}
            </View>
            <Muted>{t('superadmin.ads.placementsLabel')}</Muted>
            <View style={styles.chips}>
              {PLACEMENTS.map((placement) => (
                <Chip
                  key={placement}
                  label={t(`superadmin.ads.placement.${placement}`)}
                  active={draft.placements.includes(placement)}
                  onPress={() => togglePlacement(placement)}
                />
              ))}
            </View>
            <View style={styles.formActions}>
              <Button
                label={t('common.save')}
                onPress={() => void save()}
                disabled={saving}
                loading={saving}
                style={{ flex: 1 }}
              />
              <Button
                label={t('common.cancel')}
                variant="ghost"
                onPress={resetForm}
                disabled={saving}
                style={{ flex: 1 }}
              />
            </View>
              </View>
              <View style={styles.phonePreviewBox}>
                <Subtitle>{t('superadmin.ads.phonePreviewTitle')}</Subtitle>
                <Muted>{t('superadmin.ads.phonePreviewHint')}</Muted>
                <AdPhonePreview
                  videoUri={draft.videoUrl || undefined}
                  posterUri={draft.posterUrl || undefined}
                  advertiserName={draft.advertiserName}
                  hookText={draft.hookText}
                  title={draft.title}
                  ctaLabel={draft.ctaLabel}
                  isRTL={isRTL}
                  tapToUnmuteLabel={t('adsPortal.tapToHear')}
                />
              </View>
            </View>
          </Card>
        ) : null}
      </View>
    ),
    [
      adminDb,
      draft,
      endedAdminDb,
      filteredPendingDb,
      formOpen,
      isRTL,
      liveAdminDb,
      pendingDbError,
      pickPoster,
      pickVideo,
      pickingPoster,
      pickingVideo,
      previewListId,
      moderateDbAd,
      reviewDbAd,
      reviewingId,
      save,
      saving,
      searchQuery,
      t,
    ]
  );

  return (
    <Screen>
      <FlatList
        data={liveBlobAds}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        ListFooterComponent={
          endedBlobAds.length > 0 ? (
            <View style={{ gap: 8, marginTop: 12 }}>
              <Subtitle>{t('superadmin.ads.endedBlobTitle')}</Subtitle>
              <Muted>{t('superadmin.ads.endedDbHint')}</Muted>
              {endedBlobAds.map((item) => (
                <Card key={`ended-blob-${item.id}`} style={{ gap: 6 }}>
                  <Text style={[styles.name, { color: theme.colors.text }]}>
                    {item.advertiserName}
                  </Text>
                  <Muted>
                    {t('superadmin.ads.endedBadge')} ·{' '}
                    {(item.endAt || '').slice(0, 10) || '—'}
                  </Muted>
                </Card>
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? (
            <Muted>{t('common.loading')}</Muted>
          ) : (
            <EmptyState
              title={t('superadmin.ads.empty')}
              description={t('superadmin.ads.emptyDesc')}
              icon="film-outline"
            />
          )
        }
        renderItem={({ item }) => (
          <Card style={styles.card}>
            <View style={styles.row}>
              {item.posterUrl ? (
                <Image
                  source={{ uri: item.posterUrl }}
                  style={styles.thumb}
                />
              ) : (
                <View
                  style={[
                    styles.thumb,
                    { backgroundColor: theme.colors.accentSoft },
                  ]}
                />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.name, { color: theme.colors.text }]}>
                  {item.advertiserName}
                </Text>
                <Muted>
                  {t('superadmin.ads.adIdLabel')}: {item.id}
                </Muted>
                <Muted>
                  {t(`superadmin.ads.status.${item.status}`)} · {item.durationSec}
                  {t('media.secondsAbbr')} · {item.placements.join(' · ')}
                </Muted>
                {item.hookText ? (
                  <Muted numberOfLines={1}>{item.hookText}</Muted>
                ) : null}
              </View>
            </View>
            <View style={styles.actions}>
              <Button
                label={
                  previewListId === item.id
                    ? t('superadmin.ads.hidePhonePreview')
                    : t('superadmin.ads.showPhonePreview')
                }
                variant="outline"
                onPress={() =>
                  setPreviewListId((cur) => (cur === item.id ? null : item.id))
                }
              />
              <Button
                label={t('superadmin.actions.edit')}
                variant="outline"
                onPress={() => openEdit(item)}
              />
              {item.status === 'paused' ? (
                <Button
                  label={t('superadmin.ads.unblock')}
                  variant="outline"
                  onPress={() => void setBlobStatus(item.id, 'active')}
                />
              ) : (
                <Button
                  label={t('superadmin.ads.block')}
                  variant="outline"
                  onPress={() => void setBlobStatus(item.id, 'paused')}
                />
              )}
              <Button
                label={t('superadmin.actions.delete')}
                variant="ghost"
                onPress={() => void remove(item.id)}
              />
            </View>
            {previewListId === item.id ? (
              <View style={styles.phonePreviewBox}>
                <Muted>{t('superadmin.ads.phonePreviewHint')}</Muted>
                <AdPhonePreview
                  videoUri={item.videoUrl}
                  posterUri={item.posterUrl || undefined}
                  advertiserName={item.advertiserName}
                  hookText={item.hookText}
                  title={item.title}
                  ctaLabel={item.ctaLabel}
                  isRTL={isRTL}
                  tapToUnmuteLabel={t('adsPortal.tapToHear')}
                />
              </View>
            ) : null}
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingTop: 8, gap: 10, paddingBottom: 40 },
  card: { gap: 10 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  name: { fontWeight: '800', textAlign: 'left' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  formActions: { flexDirection: 'row', gap: 8 },
  formActionsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  formWithPreview: {
    gap: 16,
    width: '100%',
    flexDirection: Platform.OS === 'web' ? 'row' : 'column',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  formFields: { flex: 1, gap: 10, minWidth: 280 },
  phonePreviewBox: {
    gap: 8,
    width: 300,
    alignSelf: 'center',
    alignItems: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  poster: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 220,
    borderRadius: 12,
    backgroundColor: '#111',
  },
  thumb: {
    width: 52,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#111',
  },
});
