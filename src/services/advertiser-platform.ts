import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';
import {
  sanitizeAdvertiserNotification,
  sanitizeAdvertiserNotifications,
  type AdvertiserNotification,
} from '@/services/advertiser-inbox';

export type { AdvertiserNoticeKind, AdvertiserNotification } from '@/services/advertiser-inbox';
export {
  sanitizeAdvertiserNotification,
  sanitizeAdvertiserNotifications,
} from '@/services/advertiser-inbox';

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
  /**
   * Advertising campaign media-budget metadata (cents).
   * NOT Credits, wallet balance, store purchase, or certificate value.
   * Legacy API rows may still expose `budget_cents` until DB rename migration is applied.
   */
  media_budget_cents?: number | null;
  /** @deprecated legacy column alias — use media_budget_cents */
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
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'blocked' | 'deleted';
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
  /** Enriched by admin list RPC (optional until migration applied) */
  owner_email?: string | null;
  account_business_name?: string | null;
  account_contact_name?: string | null;
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
  /** Advertising media budget in cents — not Commerce Credits */
  mediaBudgetCents?: number | null;
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

async function unwrapRpcData<T>(data: unknown): Promise<T | null> {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }
  return data as T;
}

export type AdminModerateAction = 'block' | 'delete';

export type RpcResult<T> = { data: T | null; error?: string };

function mapAdvertiserError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('business and contact')) return 'advertiser_name';
  if (m.includes('could not find the function') || m.includes('does not exist')) {
    return 'schema_missing';
  }
  if (m.includes('not authenticated')) return 'not_authenticated';
  if (m.includes('advertiser account required')) return 'advertiser_required';
  if (m.includes('https video')) return 'https_video';
  if (m.includes('invalid campaign')) return 'invalid_campaign';
  if (m.includes('advertiser name')) return 'advertiser_name';
  if (m.includes('ad moderated')) return 'moderated';
  if (m.includes('forbidden')) return 'forbidden';
  if (m.includes('invalid action')) return 'invalid_action';
  if (m.includes('ad not found')) return 'not_found';
  if (m.includes('check') || m.includes('violates')) return 'constraint';
  return 'unknown';
}

async function rpc<T>(
  fn: string,
  args: Record<string, unknown> = {}
): Promise<RpcResult<T>> {
  if (!isSupabaseConfigured()) {
    return { data: null, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'not_configured' };
  const { data, error } = await sb.rpc(fn, args);
  if (error) {
    console.warn(`[advertiser-platform] ${fn}`, error.message);
    return { data: null, error: mapAdvertiserError(error.message) };
  }
  return { data: await unwrapRpcData<T>(data) };
}

export async function ensureAdvertiserAccount(
  profile: AdvertiserProfileInput
): Promise<RpcResult<AdvertiserAccount>> {
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

async function parseRpcArray<T>(raw: unknown): Promise<T[]> {
  if (Array.isArray(raw)) return raw as T[];
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function listMyCampaigns(): Promise<AdCampaign[]> {
  const { data } = await rpc<unknown>('list_my_ad_campaigns');
  const rows = await parseRpcArray<AdCampaign>(data);
  return rows.map((c) => ({
    ...c,
    media_budget_cents:
      c.media_budget_cents ?? c.budget_cents ?? null,
  }));
}

export async function saveCampaign(
  input: CampaignInput
): Promise<RpcResult<AdCampaign>> {
  const mediaBudget =
    input.mediaBudgetCents == null
      ? ''
      : String(Math.round(input.mediaBudgetCents));
  const result = await rpc<AdCampaign>('save_ad_campaign', {
    p_campaign: {
      id: input.id || '',
      name: input.name,
      status: input.status || 'draft',
      // Prefer clear advertising name; keep legacy key for older RPCs until DB rename.
      mediaBudgetCents: mediaBudget,
      budgetCents: mediaBudget,
      startAt: input.startAt || '',
      endAt: input.endAt || '',
    },
  });
  if (result.data) {
    result.data = {
      ...result.data,
      media_budget_cents:
        result.data.media_budget_cents ?? result.data.budget_cents ?? null,
    };
  }
  return result;
}

export async function listCampaignAds(campaignId: string): Promise<DbAdvertisement[]> {
  const { data } = await rpc<unknown>('list_campaign_advertisements', {
    p_campaign_id: campaignId,
  });
  return await parseRpcArray<DbAdvertisement>(data);
}

/**
 * All non-deleted ads owned by the current advertiser across campaigns.
 * Uses existing campaign RPCs (no extra DB migration required).
 */
export async function listMyAdvertisements(): Promise<DbAdvertisement[]> {
  const camps = await listMyCampaigns();
  if (!camps.length) return [];
  const batches = await Promise.all(camps.map((c) => listCampaignAds(c.id)));
  const seen = new Set<string>();
  const rows: DbAdvertisement[] = [];
  for (const batch of batches) {
    for (const ad of batch) {
      if (!ad?.id || seen.has(ad.id)) continue;
      if (ad.status === 'deleted') continue;
      seen.add(ad.id);
      rows.push(ad);
    }
  }
  rows.sort((a, b) => {
    const tb = Date.parse(b.updated_at || b.created_at || '') || 0;
    const ta = Date.parse(a.updated_at || a.created_at || '') || 0;
    return tb - ta;
  });
  return rows;
}

export async function findMyAdvertisement(
  adId: string
): Promise<DbAdvertisement | null> {
  if (!adId.trim()) return null;
  const rows = await listMyAdvertisements();
  return rows.find((a) => a.id === adId) || null;
}

function httpsOnly(url?: string): string {
  const v = (url || '').trim();
  return /^https:\/\//i.test(v) ? v : '';
}

export async function saveAdvertisement(
  input: AdvertisementInput
): Promise<RpcResult<DbAdvertisement>> {
  const videoUrl = httpsOnly(input.videoUrl);
  if (!input.campaignId.trim()) {
    return { data: null, error: 'invalid_campaign' };
  }
  if (!videoUrl) {
    return { data: null, error: 'https_video' };
  }
  if (!input.advertiserName.trim()) {
    return { data: null, error: 'advertiser_name' };
  }
  return rpc<DbAdvertisement>('save_advertisement', {
    p_ad: {
      id: input.id || '',
      campaignId: input.campaignId,
      status: input.status || 'draft',
      advertiserName: input.advertiserName,
      advertiserHandle: input.advertiserHandle || '',
      title: input.title || '',
      text: input.text || '',
      hookText: input.hookText || '',
      videoUrl,
      posterUrl: httpsOnly(input.posterUrl),
      ctaLabel: input.ctaLabel || '',
      ctaUrl: httpsOnly(input.ctaUrl),
      durationSec: String(Math.round(input.durationSec) || 10),
      placements: input.placements,
      insertEveryN: String(Math.round(input.insertEveryN || 4)),
      startAt: input.startAt || '',
      endAt: input.endAt || '',
      targetCountry: input.targetCountry || '',
      targetRegion: input.targetRegion || '',
      targetCity: input.targetCity || '',
    },
  });
}

export async function fetchPublicNativeAdsFromDb(): Promise<unknown> {
  const { data } = await rpc<unknown>('get_public_native_ads');
  return data;
}

export async function listPendingAdvertisements(): Promise<
  RpcResult<DbAdvertisement[]>
> {
  const { data, error } = await rpc<unknown>('list_pending_advertisements');
  if (error) return { data: [], error };
  return { data: await parseRpcArray<DbAdvertisement>(data) };
}

export async function listAdminAdvertisements(
  query?: string
): Promise<RpcResult<DbAdvertisement[]>> {
  const q = (query || '').trim() || null;
  // Prefer text overload (enriched with owner_email). Fall back to zero-arg.
  let result = await rpc<unknown>('list_admin_advertisements', {
    p_query: q,
  });
  if (result.error === 'schema_missing' || result.error === 'unknown') {
    result = await rpc<unknown>('list_admin_advertisements');
  }
  if (result.error) return { data: [], error: result.error };
  return { data: await parseRpcArray<DbAdvertisement>(result.data) };
}

export async function adminModerateAdvertisement(
  adId: string,
  action: AdminModerateAction,
  note?: string
): Promise<RpcResult<DbAdvertisement>> {
  if (!isUuid(adId)) return { data: null, error: 'not_found' };
  if (action !== 'block' && action !== 'delete') {
    return { data: null, error: 'invalid_action' };
  }
  return rpc<DbAdvertisement>('admin_moderate_advertisement', {
    p_ad_id: adId,
    p_action: action,
    p_note: (note || '').trim().slice(0, 240),
  });
}

export async function listMyAdvertiserNotifications(): Promise<
  RpcResult<AdvertiserNotification[]>
> {
  const { data, error } = await rpc<unknown>('list_my_advertiser_notifications');
  if (error) return { data: [], error };
  return {
    data: sanitizeAdvertiserNotifications(await parseRpcArray(data)),
    error,
  };
}

export async function markAdvertiserNotificationRead(
  id: string
): Promise<RpcResult<AdvertiserNotification>> {
  if (!isUuid(id)) return { data: null, error: 'not_found' };
  const res = await rpc<unknown>('mark_advertiser_notification_read', {
    p_id: id,
  });
  if (res.error) return { data: null, error: res.error };
  const notice = sanitizeAdvertiserNotification(res.data);
  return notice ? { data: notice } : { data: null, error: 'unknown' };
}

export async function adminSetAdvertisementStatus(
  adId: string,
  status: DbAdvertisement['status']
): Promise<RpcResult<DbAdvertisement>> {
  return rpc<DbAdvertisement>('admin_set_advertisement_status', {
    p_ad_id: adId,
    p_status: status,
  });
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
