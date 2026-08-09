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
