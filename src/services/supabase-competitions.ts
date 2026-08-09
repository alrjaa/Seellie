import type { Competition } from '@/data/initial-data';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { mergeCompetitionsById } from '@/services/competition-sync';
import { isSeedCompetitionId } from '@/utils/seed-data';

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
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { items: [], error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { items: [], error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { items: [], error: 'no_session' };
  }
  const { data, error } = await sb
    .from('app_competitions')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(300);
  if (error) {
    console.warn('[supabase] fetchCompetitions', error.message);
    return { items: [], error: error.message };
  }
  const items = ((data || []) as CompetitionCloudRow[])
    .map(rowToCompetition)
    .filter((c): c is Competition => !!c);
  return { items };
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
  const { error } = await sb.from('app_competitions').upsert(
    {
      id: competition.id,
      organizer_id: competition.organizerId,
      name: competition.name,
      payload: competition,
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
 * السحابة مصدر الحقيقة للمسابقات السحابية.
 * لا تُبقى مسابقات البذرة التجريبية (comp-1…) عند الدمج مع السحابة.
 */
export function reconcileCompetitionsWithCloud(
  local: Competition[],
  cloud: Competition[]
): Competition[] {
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
      if (res.error && !res.items.length) return;
      onChange(res.items);
    });
  };

  pull();

  const channel = sb
    .channel('app-competitions-all')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_competitions' },
      () => pull()
    )
    .subscribe();

  return () => {
    void sb.removeChannel(channel);
  };
}
