import {
  MEDIA_SPECS,
  NATIVE_AD_VIDEO_MAX_SEC,
  NATIVE_AD_VIDEO_MIN_SEC,
  fileSizeMbFromPicker,
  videoDurationSecFromPicker,
  type PickerAssetLike,
} from '@/utils/media-limits';

export type AdAspectRatio = '9:16' | '1:1' | '16:9' | 'other';

export type AdCtaPresetId =
  | 'download'
  | 'offer'
  | 'shop'
  | 'subscribe'
  | 'learn'
  | 'open';

export const AD_CTA_PRESETS: { id: AdCtaPresetId; ar: string; en: string }[] = [
  { id: 'download', ar: 'تنزيل التطبيق', en: 'Download app' },
  { id: 'offer', ar: 'احصل على العرض', en: 'Get the offer' },
  { id: 'shop', ar: 'تسوق الآن', en: 'Shop now' },
  { id: 'subscribe', ar: 'اشترك', en: 'Subscribe' },
  { id: 'learn', ar: 'اعرف المزيد', en: 'Learn more' },
  { id: 'open', ar: 'افتح الرابط', en: 'Open link' },
];

export type AdReviewReasonCode =
  | 'duration_short'
  | 'duration_long'
  | 'file_too_large'
  | 'bad_format'
  | 'low_resolution'
  | 'bad_aspect'
  | 'missing_cta'
  | 'missing_video'
  | 'invalid_link'
  | 'website_not_video';

export type AdStudioCheck = {
  code: AdReviewReasonCode;
  level: 'block' | 'warn';
};

export type AdVideoProbe = {
  durationSec: number | null;
  width: number | null;
  height: number | null;
  sizeMb: number | null;
  mime?: string | null;
  fileName?: string | null;
};

export type AdUtmParams = {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
};

const SPEC = MEDIA_SPECS.nativeAdVideo;
const ASPECT_TOLERANCE = 0.14;

export function detectAdAspectRatio(
  width?: number | null,
  height?: number | null
): AdAspectRatio {
  if (!width || !height || width < 2 || height < 2) return 'other';
  const ratio = width / height;
  if (Math.abs(ratio - 9 / 16) <= ASPECT_TOLERANCE) return '9:16';
  if (Math.abs(ratio - 1) <= ASPECT_TOLERANCE) return '1:1';
  if (Math.abs(ratio - 16 / 9) <= ASPECT_TOLERANCE) return '16:9';
  return 'other';
}

export function isSupportedAdVideoFormat(
  uri: string,
  mime?: string | null,
  fileName?: string | null
): boolean {
  const hay = `${uri} ${mime || ''} ${fileName || ''}`.toLowerCase();
  if (hay.includes('video/mp4') || hay.includes('video/quicktime')) return true;
  if (/\.(mp4|mov|m4v)(?:\?|#|$|\s)/i.test(hay)) return true;
  if (hay.startsWith('blob:') || hay.startsWith('data:')) return true;
  return false;
}

/**
 * Page/site URL (e.g. https://www.seellie.com). Valid as a CTA button link,
 * never as the in-feed video file.
 */
export function looksLikeWebsiteNotVideo(uri: string): boolean {
  const raw = (uri || '').trim();
  if (!raw) return false;
  if (
    raw.startsWith('blob:') ||
    raw.startsWith('data:') ||
    raw.startsWith('file:')
  ) {
    return false;
  }
  if (isSupportedAdVideoFormat(raw)) return false;
  if (/\.(avi|mkv|webm|wmv|flv|mpeg|mpg|3gp)(?:\?|#|$)/i.test(raw)) {
    return false;
  }
  try {
    const u = new URL(ensureHttpsUrl(raw));
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function inspectAdVideoAsset(
  asset: PickerAssetLike & { mimeType?: string | null; fileName?: string | null }
): AdVideoProbe {
  return {
    durationSec: videoDurationSecFromPicker(asset.duration),
    width: asset.width ?? null,
    height: asset.height ?? null,
    sizeMb: fileSizeMbFromPicker(asset.fileSize ?? null),
    mime: asset.mimeType ?? null,
    fileName: asset.fileName ?? null,
  };
}

export function reviewAdVideo(input: {
  probe: AdVideoProbe;
  uri?: string;
  ctaUrl?: string;
  requireCta?: boolean;
}): AdStudioCheck[] {
  const checks: AdStudioCheck[] = [];
  const { probe, uri, ctaUrl, requireCta } = input;
  const specMaxMb = SPEC.maxMb;

  if (!uri) {
    checks.push({ code: 'missing_video', level: 'block' });
    return checks;
  }

  if (looksLikeWebsiteNotVideo(uri)) {
    checks.push({ code: 'website_not_video', level: 'block' });
  } else if (!isSupportedAdVideoFormat(uri, probe.mime, probe.fileName)) {
    checks.push({ code: 'bad_format', level: 'block' });
  }

  if (probe.durationSec != null) {
    if (probe.durationSec + 0.5 < NATIVE_AD_VIDEO_MIN_SEC) {
      checks.push({ code: 'duration_short', level: 'block' });
    } else if (probe.durationSec > NATIVE_AD_VIDEO_MAX_SEC + 0.5) {
      checks.push({ code: 'duration_long', level: 'block' });
    }
  }

  if (probe.sizeMb != null && probe.sizeMb > specMaxMb + 0.05) {
    checks.push({ code: 'file_too_large', level: 'block' });
  }

  const aspect = detectAdAspectRatio(probe.width, probe.height);
  if (probe.width && probe.height) {
    if (aspect === 'other') {
      checks.push({ code: 'bad_aspect', level: 'warn' });
    }
    const minEdge = Math.min(probe.width, probe.height);
    if (minEdge < 720) {
      checks.push({ code: 'low_resolution', level: 'warn' });
    }
  }

  const link = (ctaUrl || '').trim();
  if (requireCta && !link) {
    checks.push({ code: 'missing_cta', level: 'block' });
  } else if (link && !isValidAdCtaUrl(link)) {
    checks.push({ code: 'invalid_link', level: 'block' });
  }

  return checks;
}

export function isValidAdCtaUrl(raw: string): boolean {
  try {
    const u = new URL(ensureHttpsUrl(raw));
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** يحوّل seellie.com أو http://… إلى https:// حتى لا يرفض الخادم الحفظ */
export function ensureHttpsUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^http:\/\//i.test(trimmed)) return `https://${trimmed.slice(7)}`;
  if (/^\/\//.test(trimmed)) return `https:${trimmed}`;
  if (/^[\w.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

export function appendUtmParams(rawUrl: string, utm: AdUtmParams): string {
  const trimmed = rawUrl.trim();
  const httpsUrl = ensureHttpsUrl(trimmed);
  if (!httpsUrl || !isValidAdCtaUrl(httpsUrl)) return httpsUrl || trimmed;
  try {
    const u = new URL(httpsUrl);
    if (utm.source?.trim()) u.searchParams.set('utm_source', utm.source.trim());
    if (utm.medium?.trim()) u.searchParams.set('utm_medium', utm.medium.trim());
    if (utm.campaign?.trim()) {
      u.searchParams.set('utm_campaign', utm.campaign.trim());
    }
    if (utm.content?.trim()) u.searchParams.set('utm_content', utm.content.trim());
    return u.toString();
  } catch {
    return httpsUrl;
  }
}

export function clampAdTrimRange(
  startSec: number,
  endSec: number,
  durationSec: number
): { start: number; end: number } {
  const dur = Math.max(0, durationSec);
  let start = Number.isFinite(startSec) ? Math.max(0, startSec) : 0;
  let end = Number.isFinite(endSec) ? endSec : dur;
  if (end <= start) end = Math.min(dur, start + NATIVE_AD_VIDEO_MIN_SEC);
  const span = end - start;
  if (span < NATIVE_AD_VIDEO_MIN_SEC) {
    end = Math.min(dur, start + NATIVE_AD_VIDEO_MIN_SEC);
    if (end - start < NATIVE_AD_VIDEO_MIN_SEC) {
      start = Math.max(0, end - NATIVE_AD_VIDEO_MIN_SEC);
    }
  }
  if (end - start > NATIVE_AD_VIDEO_MAX_SEC) {
    end = start + NATIVE_AD_VIDEO_MAX_SEC;
  }
  return {
    start: Math.round(start * 10) / 10,
    end: Math.round(end * 10) / 10,
  };
}

export function ctaLabelForPreset(
  id: AdCtaPresetId,
  lang: 'ar' | 'en'
): string {
  const row = AD_CTA_PRESETS.find((p) => p.id === id);
  if (!row) return lang === 'ar' ? 'افتح الرابط' : 'Open link';
  return lang === 'ar' ? row.ar : row.en;
}

export function reviewStatusFromChecks(
  checks: AdStudioCheck[],
  persistedStatus: 'draft' | 'active' | 'paused' | 'pending_review',
  processing: boolean
): 'processing' | 'review' | 'approved' | 'rejected' | 'draft' | 'paused' | 'pending_review' {
  if (processing) return 'processing';
  const blocked = checks.some((c) => c.level === 'block');
  if (blocked) return 'rejected';
  if (persistedStatus === 'pending_review') return 'pending_review';
  if (persistedStatus === 'active') return 'approved';
  if (persistedStatus === 'paused') return 'paused';
  if (checks.length > 0) return 'review';
  return 'draft';
}
