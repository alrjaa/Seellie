/**
 * Native / in-feed ads — blob `native_ads`.
 * Writes go through upsertAppBlob (RLS: is_app_superadmin).
 */
import {
  NATIVE_AD_VIDEO_MAX_SEC,
  NATIVE_AD_VIDEO_MIN_SEC,
} from '@/utils/media-limits';

export const NATIVE_ADS_BLOB_KEY = 'native_ads' as const;
/** First-3-seconds hook overlay on the feed slide. */
export const NATIVE_AD_HOOK_MS = 3000;

export type NativeAdPlacement = 'general' | 'unique' | 'highlights';

export type NativeAdStatus = 'draft' | 'active' | 'paused';

export type NativeInFeedAd = {
  id: string;
  status: NativeAdStatus;
  advertiserName: string;
  advertiserHandle?: string;
  advertiserAvatar?: string;
  title?: string;
  text?: string;
  hookText?: string;
  videoUrl: string;
  posterUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  durationSec: number;
  placements: NativeAdPlacement[];
  insertEveryN: number;
  startAt?: string;
  endAt?: string;
  createdAt: string;
  updatedAt: string;
};

/** Shape injected into FullScreenFeed — kept here so unit tests skip RN. */
export type NativeAdFeedItem = {
  id: string;
  kind: 'video';
  mediaUrl: string;
  posterUrl?: string;
  title?: string;
  text?: string;
  authorId: string;
  authorName: string;
  authorHandle?: string;
  authorAvatar?: string;
  likes: string[];
  liked: false;
  sponsored: true;
  hookText?: string;
  ctaLabel?: string;
  ctaUrl?: string;
};

const PLACEMENTS: NativeAdPlacement[] = ['general', 'unique', 'highlights'];

function clip(value: unknown, max: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim()
    .slice(0, max);
}

function httpsUrl(value: unknown): string {
  const raw = clip(value, 2000);
  if (!raw) return '';
  try {
    const u = new URL(raw);
    if (u.protocol !== 'https:') return '';
    return u.toString();
  } catch {
    return '';
  }
}

function clampDuration(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return NATIVE_AD_VIDEO_MAX_SEC;
  return Math.min(
    NATIVE_AD_VIDEO_MAX_SEC,
    Math.max(NATIVE_AD_VIDEO_MIN_SEC, Math.round(n))
  );
}

function clampEveryN(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 4;
  return Math.min(12, Math.max(2, Math.round(n)));
}

export function sanitizeNativeAd(raw: unknown): NativeInFeedAd | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const id = clip(row.id, 80);
  const videoUrl = httpsUrl(row.videoUrl);
  const advertiserName = clip(row.advertiserName, 80);
  if (!id || !videoUrl || !advertiserName) return null;
  const statusRaw = clip(row.status, 16);
  const status: NativeAdStatus =
    statusRaw === 'active' || statusRaw === 'paused' || statusRaw === 'draft'
      ? statusRaw
      : 'draft';
  const placements: NativeAdPlacement[] = Array.isArray(row.placements)
    ? row.placements.filter((p): p is NativeAdPlacement =>
        PLACEMENTS.includes(p as NativeAdPlacement)
      )
    : ['general'];
  return {
    id,
    status,
    advertiserName,
    advertiserHandle: clip(row.advertiserHandle, 40) || undefined,
    advertiserAvatar: httpsUrl(row.advertiserAvatar) || undefined,
    title: clip(row.title, 80) || undefined,
    text: clip(row.text, 240) || undefined,
    hookText: clip(row.hookText, 80) || undefined,
    videoUrl,
    posterUrl: httpsUrl(row.posterUrl) || undefined,
    ctaLabel: clip(row.ctaLabel, 32) || undefined,
    ctaUrl: httpsUrl(row.ctaUrl) || undefined,
    durationSec: clampDuration(row.durationSec),
    placements: placements.length ? placements : ['general'],
    insertEveryN: clampEveryN(row.insertEveryN),
    startAt: clip(row.startAt, 40) || undefined,
    endAt: clip(row.endAt, 40) || undefined,
    createdAt: clip(row.createdAt, 40) || new Date().toISOString(),
    updatedAt: clip(row.updatedAt, 40) || new Date().toISOString(),
  };
}

export function sanitizeNativeAdsPayload(raw: unknown): NativeInFeedAd[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: NativeInFeedAd[] = [];
  for (const item of raw) {
    const ad = sanitizeNativeAd(item);
    if (!ad || seen.has(ad.id)) continue;
    seen.add(ad.id);
    out.push(ad);
    if (out.length >= 40) break;
  }
  return out;
}

export function isNativeAdLive(
  ad: NativeInFeedAd,
  nowMs: number = Date.now()
): boolean {
  if (ad.status !== 'active') return false;
  if (!ad.videoUrl) return false;
  if (ad.startAt) {
    const start = Date.parse(ad.startAt);
    if (Number.isFinite(start) && nowMs < start) return false;
  }
  if (ad.endAt) {
    const end = Date.parse(ad.endAt);
    if (Number.isFinite(end) && nowMs > end) return false;
  }
  return true;
}

export function liveAdsForPlacement(
  ads: NativeInFeedAd[],
  placement: NativeAdPlacement,
  nowMs: number = Date.now()
): NativeInFeedAd[] {
  return ads.filter(
    (ad) => isNativeAdLive(ad, nowMs) && ad.placements.includes(placement)
  );
}

/** Feed slide id → canonical ad id (`native-ad-{id}` or `native-ad-{id}--{slot}`). */
export function extractNativeAdId(feedItemId: string): string | null {
  const match = /^native-ad-(.+?)(?:--\d+)?$/.exec(String(feedItemId ?? '').trim());
  return match?.[1]?.slice(0, 80) || null;
}

export function filterHiddenNativeAds(
  ads: NativeInFeedAd[],
  hiddenIds: Iterable<string>
): NativeInFeedAd[] {
  const hidden = new Set(
    [...hiddenIds].map((id) => String(id).trim()).filter(Boolean)
  );
  if (!hidden.size) return ads;
  return ads.filter((ad) => !hidden.has(ad.id));
}

export function nativeAdToFeedItem(ad: NativeInFeedAd): NativeAdFeedItem {
  const handle = ad.advertiserHandle
    ? ad.advertiserHandle.startsWith('@')
      ? ad.advertiserHandle
      : `@${ad.advertiserHandle}`
    : undefined;
  return {
    id: `native-ad-${ad.id}`,
    kind: 'video',
    mediaUrl: ad.videoUrl,
    posterUrl: ad.posterUrl,
    title: ad.title || ad.hookText,
    text: ad.text,
    authorId: `ad:${ad.id}`,
    authorName: ad.advertiserName,
    authorHandle: handle,
    authorAvatar: ad.advertiserAvatar,
    likes: [],
    liked: false,
    sponsored: true,
    hookText: ad.hookText,
    ctaLabel: ad.ctaLabel,
    ctaUrl: ad.ctaUrl,
  };
}

export function nativeAdsEqual(
  a: NativeInFeedAd[],
  b: NativeInFeedAd[]
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (
      left.id !== right.id ||
      left.status !== right.status ||
      left.updatedAt !== right.updatedAt ||
      left.videoUrl !== right.videoUrl ||
      left.hookText !== right.hookText ||
      left.insertEveryN !== right.insertEveryN
    ) {
      return false;
    }
  }
  return true;
}

function slotAd(slide: NativeAdFeedItem, slot: number): NativeAdFeedItem {
  return { ...slide, id: `${slide.id}--${slot}` };
}

export function injectNativeAds<T>(
  items: T[],
  ads: NativeInFeedAd[],
  placement: NativeAdPlacement
): Array<T | NativeAdFeedItem> {
  const live = liveAdsForPlacement(ads, placement);
  if (!live.length) return items;
  const slides = live.map(nativeAdToFeedItem);
  if (!items.length) return slides.slice(0, 2).map((slide, i) => slotAd(slide, i));
  const everyN = live[0]?.insertEveryN || 4;
  const out: Array<T | NativeAdFeedItem> = [];
  let ai = 0;
  items.forEach((item, index) => {
    out.push(item);
    if ((index + 1) % everyN === 0) {
      out.push(slotAd(slides[ai % slides.length], ai));
      ai += 1;
    }
  });
  return out;
}
