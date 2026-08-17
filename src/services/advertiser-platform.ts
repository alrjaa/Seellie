import { getSupabase, isSupabaseConfigured } from '@/services/supabase';

export type AdvertiserAccount = {
  id: string;
  owner_user_id: string;
  business_name: string;
  contact_name: string;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  status: 'pending' | 'active' | 'suspended';
  created_at: string;
  updated_at: string;
};

export type AdCampaign = {
  id: string;
  advertiser_id: string;
  name: string;
  budget_cents?: number | null;
  status: 'draft' | 'active' | 'paused' | 'ended';
  start_at?: string | null;
  end_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type DbAdvertisement = {
  id: string;
  advertiser_id: string;
  campaign_id: string;
  status: 'draft' | 'active' | 'paused';
  advertiser_name: string;
  advertiser_handle?: string | null;
  title?: string | null;
  body_text?: string | null;
  hook_text?: string | null;
  video_url: string;
  poster_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  duration_sec: number;
  placements: string[];
  insert_every_n: number;
  start_at?: string | null;
  end_at?: string | null;
  target_country?: string | null;
  target_region?: string | null;
  target_city?: string | null;
  created_at: string;
  updated_at: string;
};

export type AdvertiserProfileInput = {
  businessName: string;
  contactName: string;
  country?: string;
  region?: string;
  city?: string;
};

export type CampaignInput = {
  id?: string;
  name: string;
  status?: AdCampaign['status'];
  budgetCents?: number | null;
  startAt?: string;
  endAt?: string;
};

export type AdvertisementInput = {
  id?: string;
  campaignId: string;
  status?: DbAdvertisement['status'];
  advertiserName: string;
  advertiserHandle?: string;
  title?: string;
  text?: string;
  hookText?: string;
  videoUrl: string;
  posterUrl?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  durationSec: number;
  placements: string[];
  insertEveryN?: number;
  startAt?: string;
  endAt?: string;
  targetCountry?: string;
  targetRegion?: string;
  targetCity?: string;
};

async function rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    console.warn(`[advertiser-platform] ${fn}`, error.message);
    return null;
  }
  return data as T;
}

export async function ensureAdvertiserAccount(
  profile: AdvertiserProfileInput
): Promise<AdvertiserAccount | null> {
  return rpc<AdvertiserAccount>('ensure_advertiser_account', {
    p_profile: {
      businessName: profile.businessName,
      contactName: profile.contactName,
      country: profile.country || '',
      region: profile.region || '',
      city: profile.city || '',
    },
  });
}

export async function fetchMyAdvertiserAccount(): Promise<AdvertiserAccount | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const { data: session } = await sb.auth.getSession();
  if (!session.session?.user?.id) return null;
  const { data, error } = await sb
    .from('advertiser_accounts')
    .select('*')
    .eq('owner_user_id', session.session.user.id)
    .maybeSingle();
  if (error) {
    console.warn('[advertiser-platform] fetch account', error.message);
    return null;
  }
  return data as AdvertiserAccount | null;
}

export async function listMyCampaigns(): Promise<AdCampaign[]> {
  const raw = await rpc<AdCampaign[]>('list_my_ad_campaigns');
  return Array.isArray(raw) ? raw : [];
}

export async function saveCampaign(input: CampaignInput): Promise<AdCampaign | null> {
  return rpc<AdCampaign>('save_ad_campaign', {
    p_campaign: {
      id: input.id || null,
      name: input.name,
      status: input.status || 'draft',
      budgetCents: input.budgetCents ?? null,
      startAt: input.startAt || null,
      endAt: input.endAt || null,
    },
  });
}

export async function listCampaignAds(campaignId: string): Promise<DbAdvertisement[]> {
  const raw = await rpc<DbAdvertisement[]>('list_campaign_advertisements', {
    p_campaign_id: campaignId,
  });
  return Array.isArray(raw) ? raw : [];
}

export async function saveAdvertisement(
  input: AdvertisementInput
): Promise<DbAdvertisement | null> {
  return rpc<DbAdvertisement>('save_advertisement', { p_ad: input });
}

export async function fetchPublicNativeAdsFromDb(): Promise<unknown> {
  return rpc<unknown>('get_public_native_ads');
}

export function dbAdToNativeShape(row: DbAdvertisement): Record<string, unknown> {
  return {
    id: `adv-${row.id}`,
    status: row.status,
    advertiserName: row.advertiser_name,
    advertiserHandle: row.advertiser_handle || undefined,
    title: row.title || undefined,
    text: row.body_text || undefined,
    hookText: row.hook_text || undefined,
    videoUrl: row.video_url,
    posterUrl: row.poster_url || undefined,
    ctaLabel: row.cta_label || undefined,
    ctaUrl: row.cta_url || undefined,
    durationSec: row.duration_sec,
    placements: row.placements,
    insertEveryN: row.insert_every_n,
    startAt: row.start_at || undefined,
    endAt: row.end_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
