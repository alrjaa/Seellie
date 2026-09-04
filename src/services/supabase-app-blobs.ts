import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { requireCloudSession } from '@/services/cloud-write';
import { createKeyedChannelHub } from '@/services/app-blob-realtime-hub';

export type AppBlobKey =
  | 'referees'
  | 'offers'
  | 'support_levels'
  | 'gift_transactions'
  | 'app_branding'
  | 'native_ads'
  /** F09-P1-08: canonical key (matches set_profile_analyst SQL) */
  | 'settings'
  /** Legacy client key — read fallback only; do not write */
  | 'app_settings'
  | `announcements:${string}`
  | `competition-alerts:${string}`
  | `alerts-inbox:${string}`
  | `prizes:${string}`;

export type AppSettingsBlob = {
  autoApproveAnalystRequests?: boolean;
  /** نظام التقدير والتكريم (هدايا + شهادات) */
  appreciationEnabled?: boolean;
  /** نظام Credits + IAP + شهادات رقمية (F17) */
  commerceCreditsEnabled?: boolean;
  /** حقل كتابة التعليق فقط — القراءة تبقى */
  commentComposerEnabled?: boolean;
  /** حقل إنشاء المشاركة فقط — القراءة تبقى */
  postComposerEnabled?: boolean;
  /** حقل إنشاء الساحة فقط — التصفح يبقى */
  arenaComposerEnabled?: boolean;
};

export type AppFeatureFlags = {
  appreciationEnabled: boolean;
  commerceCreditsEnabled: boolean;
  commentComposerEnabled: boolean;
  postComposerEnabled: boolean;
  arenaComposerEnabled: boolean;
};

export const DEFAULT_APP_FEATURE_FLAGS: AppFeatureFlags = {
  appreciationEnabled: true,
  commerceCreditsEnabled: true,
  commentComposerEnabled: true,
  postComposerEnabled: true,
  arenaComposerEnabled: true,
};

/** Resolve feature flags from settings blob — missing keys default to enabled. */
export function resolveAppFeatureFlags(
  settings?: AppSettingsBlob | null
): AppFeatureFlags {
  return {
    appreciationEnabled:
      settings?.appreciationEnabled ?? DEFAULT_APP_FEATURE_FLAGS.appreciationEnabled,
    commerceCreditsEnabled:
      settings?.commerceCreditsEnabled ??
      DEFAULT_APP_FEATURE_FLAGS.commerceCreditsEnabled,
    commentComposerEnabled:
      settings?.commentComposerEnabled ??
      DEFAULT_APP_FEATURE_FLAGS.commentComposerEnabled,
    postComposerEnabled:
      settings?.postComposerEnabled ?? DEFAULT_APP_FEATURE_FLAGS.postComposerEnabled,
    arenaComposerEnabled:
      settings?.arenaComposerEnabled ??
      DEFAULT_APP_FEATURE_FLAGS.arenaComposerEnabled,
  };
}

/** Canonical blob key for analyst auto-approve config (server SQL reads this). */
export const APP_SETTINGS_CANONICAL_KEY = 'settings' as const;
/** Pre-F09-P1-08 client key — read-only fallback. */
export const APP_SETTINGS_LEGACY_KEY = 'app_settings' as const;

/**
 * F09-P1-08: resolve auto-approve flag.
 * Canonical `settings` wins when present; else legacy `app_settings`; else false.
 * Config only — never grants analyst / canCreateContent privilege.
 */
export function resolveAutoApproveAnalystRequests(opts: {
  settings?: AppSettingsBlob | null;
  app_settings?: AppSettingsBlob | null;
}): boolean {
  if (opts.settings != null) {
    return !!opts.settings.autoApproveAnalystRequests;
  }
  if (opts.app_settings != null) {
    return !!opts.app_settings.autoApproveAnalystRequests;
  }
  return false;
}

/** Read settings with canonical-first, legacy fallback (no dual-write). */
export async function fetchAppSettingsBlob(): Promise<{
  data: AppSettingsBlob | null;
  error?: string;
  source?: typeof APP_SETTINGS_CANONICAL_KEY | typeof APP_SETTINGS_LEGACY_KEY;
}> {
  const primary = await fetchAppBlob<AppSettingsBlob>(APP_SETTINGS_CANONICAL_KEY);
  if (primary.data != null) {
    return { data: primary.data, source: APP_SETTINGS_CANONICAL_KEY };
  }
  const legacy = await fetchAppBlob<AppSettingsBlob>(APP_SETTINGS_LEGACY_KEY);
  if (legacy.data != null) {
    return {
      data: legacy.data,
      error: legacy.error,
      source: APP_SETTINGS_LEGACY_KEY,
    };
  }
  return {
    data: null,
    error: primary.error || legacy.error,
  };
}

/** Write auto-approve config to canonical key only. */
export async function upsertAppSettingsBlob(
  payload: AppSettingsBlob
): Promise<{ ok: boolean; error?: string }> {
  return upsertAppBlob(APP_SETTINGS_CANONICAL_KEY, payload);
}

export async function fetchAppBlob<T>(
  key: AppBlobKey
): Promise<{ data: T | null; error?: string }> {
  if (!isSupabaseConfigured()) return { data: null, error: 'not_configured' };
  const sb = getSupabase();
  if (!sb) return { data: null, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) return { data: null, error: 'no_session' };

  const { data, error } = await sb
    .from('app_blobs')
    .select('payload')
    .eq('key', key)
    .maybeSingle();
  if (error) {
    console.warn('[app-blobs] fetch', key, error.message);
    return { data: null, error: error.message };
  }
  return { data: (data?.payload as T) ?? null };
}

export async function upsertAppBlob(
  key: AppBlobKey,
  payload: unknown
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };
  const { session, error: sessionError } = await requireCloudSession();
  if (!session) return { ok: false, error: sessionError || 'no_session' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  // Shared mutable blobs: use scoped RPCs (PHASE2–4). Full replace = superadmin only.
  if (key === 'gift_transactions') {
    console.warn(
      '[app-blobs] refuse full upsert for gift_transactions — use appendGiftTransaction'
    );
    return { ok: false, error: 'use_append_gift_transaction' };
  }
  if (key === 'offers') {
    console.warn(
      '[app-blobs] refuse full upsert for offers — use upsertOfferInBlob / setOfferStatus'
    );
    return { ok: false, error: 'use_offer_rpcs' };
  }
  if (key === 'referees') {
    console.warn(
      '[app-blobs] refuse full upsert for referees — use upsertRefereeInBlob'
    );
    return { ok: false, error: 'use_upsert_referee_in_blob' };
  }

  const { error } = await sb.from('app_blobs').upsert(
    {
      key,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (error) {
    console.warn('[app-blobs] upsert', key, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * دمج حكم واحد في blob الحكام (SECURITY-PHASE3-REFEREES.sql).
 * يعمل للمنظّم حتى لو فشل الاستبدال الكامل سابقاً.
 */
export async function upsertRefereeInBlob(
  referee: unknown,
  options?: { competitionId?: string }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };
  const { session, error: sessionError } = await requireCloudSession();
  if (!session) return { ok: false, error: sessionError || 'no_session' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  // FIX-09 F09-S02: competitionId is authz context only (stripped server-side).
  const payload =
    options?.competitionId &&
    referee &&
    typeof referee === 'object' &&
    !Array.isArray(referee)
      ? { ...(referee as Record<string, unknown>), competitionId: options.competitionId }
      : referee;

  const { data, error } = await sb.rpc('upsert_referee_in_blob', {
    p_referee: payload,
  });
  if (error) {
    return { ok: false, error: error.message };
  }
  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    return {
      ok: false,
      error: (data as { error?: string }).error || 'rpc_failed',
    };
  }
  return { ok: true };
}

/** استبدال كامل لقائمة الحكام — مشرف فقط (حذف/إزالة المكرر) */
export async function replaceRefereesBlob(
  items: unknown[]
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };
  const { session, error: sessionError } = await requireCloudSession();
  if (!session) return { ok: false, error: sessionError || 'no_session' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  const { data, error } = await sb.rpc('replace_referees_blob', {
    p_items: items,
  });
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    return {
      ok: false,
      error: (data as { error?: string }).error || 'rpc_failed',
    };
  }
  return { ok: true };
}

/** حذف حكم من السحابة — مشرف فقط */
export async function deleteRefereeFromBlob(
  refereeId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };
  const { session, error: sessionError } = await requireCloudSession();
  if (!session) return { ok: false, error: sessionError || 'no_session' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  const { data, error } = await sb.rpc('delete_referee_from_blob', {
    p_id: refereeId,
  });
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    return {
      ok: false,
      error: (data as { error?: string }).error || 'rpc_failed',
    };
  }
  return { ok: true };
}

/** Organizer creates/updates own offer (SECURITY-PHASE4). */
export async function upsertOfferInBlob(
  offer: unknown
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };
  const { session, error: sessionError } = await requireCloudSession();
  if (!session) return { ok: false, error: sessionError || 'no_session' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  const { data, error } = await sb.rpc('upsert_offer_in_blob', {
    p_offer: offer,
  });
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    return {
      ok: false,
      error: (data as { error?: string }).error || 'rpc_failed',
    };
  }
  return { ok: true };
}

/** Freelancer/organizer updates offer status (SECURITY-PHASE4). */
export async function setOfferStatusRemote(
  offerId: string,
  status: 'accepted' | 'declined' | 'pending'
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };
  const { session, error: sessionError } = await requireCloudSession();
  if (!session) return { ok: false, error: sessionError || 'no_session' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  const { data, error } = await sb.rpc('set_offer_status', {
    p_offer_id: offerId,
    p_status: status,
  });
  if (error) return { ok: false, error: error.message };
  if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
    return {
      ok: false,
      error: (data as { error?: string }).error || 'rpc_failed',
    };
  }
  return { ok: true };
}

/** Append one gift (FIX-08 + F09-P1-04). Server assigns id; clientRequestId for idempotency. */
export async function appendGiftTransaction(
  gift: unknown
): Promise<{
  ok: boolean;
  error?: string;
  gift?: Record<string, unknown>;
  idempotent?: boolean;
}> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };
  const { session, error: sessionError } = await requireCloudSession();
  if (!session) return { ok: false, error: sessionError || 'no_session' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  const { data, error } = await sb.rpc('append_gift_transaction', {
    p_gift: gift,
  });
  if (error) {
    console.warn('[app-blobs] append gift', error.message);
    return { ok: false, error: error.message };
  }
  // F09-P1-04 returns { ok, gift, idempotent, count }; older FIX-08 returned array
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const row = data as {
      ok?: boolean;
      gift?: Record<string, unknown>;
      idempotent?: boolean;
      error?: string;
    };
    if (row.ok === false) {
      return { ok: false, error: row.error || 'rpc_failed' };
    }
    return {
      ok: true,
      gift: row.gift,
      idempotent: !!row.idempotent,
    };
  }
  return { ok: true };
}

/**
 * Shared Realtime channel per blob key.
 * postgres_changes is attached once, before subscribe(); extra consumers
 * only add local callbacks. Last unsubscriber removes the channel.
 */
const appBlobChannelHub = createKeyedChannelHub<RealtimeChannel>({
  start(key, dispatch) {
    const sb = getSupabase();
    if (!sb) {
      throw new Error('subscribeAppBlob: no supabase client');
    }
    const channel = sb.channel(`app-blob-${key}`);
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_blobs',
        filter: `key=eq.${key}`,
      },
      () => dispatch()
    );
    channel.subscribe();
    return channel;
  },
  stop(_key, channel) {
    const sb = getSupabase();
    if (sb) void sb.removeChannel(channel);
  },
});

export function subscribeAppBlob(
  key: AppBlobKey,
  onChange: () => void
): (() => void) | null {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  return appBlobChannelHub.subscribe(key, onChange);
}
