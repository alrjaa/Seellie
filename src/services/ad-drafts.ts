import { getJson, setJson } from '@/services/storage';
import type { NativeAdPlacement } from '@/services/native-ads';
import type { AdCtaPresetId, AdUtmParams } from '@/utils/ad-video-studio';

export type AdStudioDraft = {
  campaignId: string;
  adId: string;
  advertiserName: string;
  advertiserHandle: string;
  title: string;
  text: string;
  hookText: string;
  videoUrl: string;
  posterUrl: string;
  ctaPreset: AdCtaPresetId;
  ctaLabel: string;
  ctaUrl: string;
  durationSec: string;
  insertEveryN: string;
  startAt: string;
  endAt: string;
  targetCountry: string;
  targetRegion: string;
  targetCity: string;
  status: 'draft' | 'pending_review' | 'active' | 'paused';
  placements: NativeAdPlacement[];
  trimStart: number;
  trimEnd: number;
  muted: boolean;
  utm: AdUtmParams;
  savedAt: string;
};

const KEY_PREFIX = 'seellie_ad_studio_draft:';

function keyFor(campaignId: string, adId: string) {
  return `${KEY_PREFIX}${campaignId}:${adId}`;
}

export async function loadAdStudioDraft(
  campaignId: string,
  adId: string
): Promise<AdStudioDraft | null> {
  if (!campaignId) return null;
  return getJson<AdStudioDraft>(keyFor(campaignId, adId));
}

export async function saveAdStudioDraft(draft: AdStudioDraft): Promise<void> {
  if (!draft.campaignId) return;
  await setJson(keyFor(draft.campaignId, draft.adId), {
    ...draft,
    savedAt: new Date().toISOString(),
  });
}
