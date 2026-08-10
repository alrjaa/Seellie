import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { requireCloudSession } from '@/services/cloud-write';

export type AppBlobKey =
  | 'referees'
  | 'offers'
  | 'support_levels'
  | 'gift_transactions'
  | 'app_branding'
  | `announcements:${string}`
  | `prizes:${string}`;

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
  referee: unknown
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };
  const { session, error: sessionError } = await requireCloudSession();
  if (!session) return { ok: false, error: sessionError || 'no_session' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  const { data, error } = await sb.rpc('upsert_referee_in_blob', {
    p_referee: referee,
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

/** Append one gift (SECURITY-PHASE2). Caller must be gifterId. */
export async function appendGiftTransaction(
  gift: unknown
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: 'not_configured' };
  const { session, error: sessionError } = await requireCloudSession();
  if (!session) return { ok: false, error: sessionError || 'no_session' };
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  const { error } = await sb.rpc('append_gift_transaction', {
    p_gift: gift,
  });
  if (error) {
    console.warn('[app-blobs] append gift', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export function subscribeAppBlob(
  key: AppBlobKey,
  onChange: () => void
): (() => void) | null {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const channel = sb
    .channel(`app-blob-${key}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'app_blobs',
        filter: `key=eq.${key}`,
      },
      () => onChange()
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}
