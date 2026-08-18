import type { Competition } from '@/data/initial-data';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { mergeCompetitionsById } from '@/services/competition-sync-core';
import { isSeedCompetitionId } from '@/utils/seed-data';
import { shouldApplyCloudResult } from '@/services/cloud-result';

export { shouldApplyCloudResult as shouldApplyCompetitionsCloud } from '@/services/cloud-result';

type CompetitionCloudRow = {
  id: string;
  organizer_id: string;
  name: string;
  payload: Competition | Record<string, unknown>;
  updated_at: string;
};

function reviveCompetition(raw: Competition): Competition {
  return {
    ...raw,
    teams: raw.teams ?? [],
    matches: (raw.matches ?? []).map((match) => ({
      ...match,
      date:
        match.date != null
          ? new Date(match.date as Date | string)
          : new Date(),
    })),
  };
}

function rowToCompetition(row: CompetitionCloudRow): Competition | null {
  const payload = row.payload as Competition;
  if (!payload || typeof payload !== 'object') return null;
  return reviveCompetition({
    ...payload,
    id: row.id || payload.id,
    organizerId: row.organizer_id || payload.organizerId,
    name: row.name || payload.name,
  });
}

export async function fetchCompetitionsCloud(): Promise<{
  items: Competition[];
  /** true = query succeeded (empty array is a real empty catalog). */
  ok: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { items: [], ok: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { items: [], ok: false, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { items: [], ok: false, error: 'no_session' };
  }
  const { data, error } = await sb
    .from('app_competitions_catalog')
    .select('id, organizer_id, name, payload, updated_at')
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) {
    console.warn('[supabase] fetchCompetitions', error.message);
    return { items: [], ok: false, error: error.message };
  }
  const catalog = ((data || []) as CompetitionCloudRow[])
    .map(rowToCompetition)
    .filter((c): c is Competition => !!c);
  const { data: privileged } = await sb
    .from('app_competitions')
    .select('id, organizer_id, name, payload, updated_at')
    .limit(300);
  const full = ((privileged || []) as CompetitionCloudRow[])
    .map(rowToCompetition)
    .filter((c): c is Competition => !!c);
  if (!full.length) {
    return { items: catalog, ok: true };
  }
  const byId = new Map(catalog.map((c) => [c.id, c]));
  for (const item of full) byId.set(item.id, item);
  return { items: Array.from(byId.values()), ok: true };
}

export async function upsertCompetitionCloud(
  competition: Competition
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: 'no_session' };
  }
  // JSON صريح حتى تتحول التواريخ إلى ISO ولا يفشل jsonb
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(JSON.stringify(competition)) as Record<string, unknown>;
  } catch (e) {
    console.warn('[supabase] upsertCompetition serialize', e);
    return { ok: false, error: 'serialize_failed' };
  }
  const { error } = await sb.from('app_competitions').upsert(
    {
      id: competition.id,
      organizer_id: competition.organizerId,
      name: competition.name,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) {
    console.warn('[supabase] upsertCompetition', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function deleteCompetitionCloud(
  competitionId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: 'no_session' };
  }
  const { data, error } = await sb
    .from('app_competitions')
    .delete()
    .eq('id', competitionId)
    .select('id');
  if (error) {
    console.warn('[supabase] deleteCompetition', error.message);
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return {
      ok: false,
      error:
        'not_found_or_forbidden — نفّذ FIX-CLOUD-SYNC.sql أو تأكد من صلاحية الحذف',
    };
  }
  return { ok: true };
}

export function mergeCloudCompetitions(
  local: Competition[],
  cloud: Competition[]
): Competition[] {
  return mergeCompetitionsById(local, cloud);
}

/**
 * السحابة مصدر الحقيقة عند وجود صفوف.
 * إن كانت السحابة فارغة نحتفظ بالمحلي (بما فيه البذرة) حتى لا تُفرَّغ شاشات التصفح.
 */
export function reconcileCompetitionsWithCloud(
  local: Competition[],
  cloud: Competition[]
): Competition[] {
  if (!cloud.length) {
    return local;
  }
  const cloudIds = new Set(cloud.map((c) => c.id));
  const keepLocalLive = local.filter(
    (c) => !isSeedCompetitionId(c.id) && cloudIds.has(c.id)
  );
  return mergeCompetitionsById(keepLocalLive, cloud);
}

export function subscribeCompetitionsCloud(
  onChange: (items: Competition[]) => void
): (() => void) | null {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;

  const pull = () => {
    void fetchCompetitionsCloud().then((res) => {
      // FIX-05: only apply successful fetches (ERROR ≠ EMPTY)
      if (!shouldApplyCloudResult(res)) return;
      onChange(res.items);
    });
  };

  pull();

  const { data: authSub } = sb.auth.onAuthStateChange((event) => {
    if (
      event === 'SIGNED_IN' ||
      event === 'TOKEN_REFRESHED' ||
      event === 'INITIAL_SESSION'
    ) {
      pull();
    }
  });

  const channel = sb
    .channel('app-competitions-all')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_competitions' },
      () => pull()
    )
    .subscribe();

  return () => {
    authSub.subscription.unsubscribe();
    void sb.removeChannel(channel);
  };
}
