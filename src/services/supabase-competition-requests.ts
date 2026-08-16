import type { CompetitionRequest } from '@/data/initial-data';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { reviveCompetitionRequest } from '@/services/competition-sync-core';
import {
  mergeCompetitionRequestsById,
  shouldApplyCompetitionRequestsCloud,
} from '@/services/competition-requests-merge';

export {
  mergeCompetitionRequestsById,
  reconcileCompetitionRequestsWithCloud,
  shouldApplyCompetitionRequestsCloud,
} from '@/services/competition-requests-merge';

type CompetitionRequestRow = {
  id: string;
  organizer_id: string;
  name: string;
  region: string;
  city: string;
  neighborhood: string;
  venue_name: string;
  terms_accepted_at: string;
  diligence_pledge: boolean;
  stadium_pledge: boolean;
  min_teams_pledge: boolean;
  first_aid_pledge: boolean;
  order_pledge: boolean;
  status: CompetitionRequest['status'];
  requested_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  competition_id: string | null;
};

function rowToRequest(row: CompetitionRequestRow): CompetitionRequest {
  return reviveCompetitionRequest({
    id: row.id,
    organizerId: row.organizer_id,
    name: row.name,
    region: row.region,
    city: row.city,
    neighborhood: row.neighborhood,
    venueName: row.venue_name,
    termsAcceptedAt: row.terms_accepted_at,
    diligencePledge: !!row.diligence_pledge,
    stadiumPledge: !!row.stadium_pledge,
    minTeamsPledge: !!row.min_teams_pledge,
    firstAidPledge: !!row.first_aid_pledge,
    orderPledge: !!row.order_pledge,
    status: row.status,
    requestedAt: row.requested_at,
    reviewedAt: row.reviewed_at || undefined,
    rejectionReason: row.rejection_reason || undefined,
    competitionId: row.competition_id || undefined,
  });
}

function requestToRow(request: CompetitionRequest): CompetitionRequestRow {
  const terms =
    request.termsAcceptedAt instanceof Date
      ? request.termsAcceptedAt.toISOString()
      : String(request.termsAcceptedAt);
  const requested =
    request.requestedAt instanceof Date
      ? request.requestedAt.toISOString()
      : String(request.requestedAt);
  const reviewed = request.reviewedAt
    ? request.reviewedAt instanceof Date
      ? request.reviewedAt.toISOString()
      : String(request.reviewedAt)
    : null;
  return {
    id: request.id,
    organizer_id: request.organizerId,
    name: request.name,
    region: request.region,
    city: request.city,
    neighborhood: request.neighborhood,
    venue_name: request.venueName,
    terms_accepted_at: terms,
    diligence_pledge: request.diligencePledge,
    stadium_pledge: request.stadiumPledge,
    min_teams_pledge: request.minTeamsPledge,
    first_aid_pledge: request.firstAidPledge,
    order_pledge: request.orderPledge,
    status: request.status,
    requested_at: requested,
    reviewed_at: reviewed,
    rejection_reason: request.rejectionReason || null,
    competition_id: request.competitionId || null,
  };
}

async function requireSessionUserId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session?.user?.id) {
    return { ok: false, error: 'no_session' };
  }
  return { ok: true, userId: sessionData.session.user.id };
}

export async function fetchCompetitionRequestsCloud(): Promise<{
  items: CompetitionRequest[];
  /** true = HTTP/query succeeded (empty array is a real empty catalog). */
  ok: boolean;
  error?: string;
}> {
  const session = await requireSessionUserId();
  if (!session.ok) {
    return { items: [], ok: false, error: session.error };
  }
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from('competition_requests')
    .select('*')
    .order('requested_at', { ascending: false })
    .limit(300);
  if (error) {
    console.warn('[supabase] fetchCompetitionRequests', error.message);
    return { items: [], ok: false, error: error.message };
  }
  return {
    items: ((data || []) as CompetitionRequestRow[]).map(rowToRequest),
    ok: true,
  };
}

/** إنشاء طلب جديد — insert فقط مع تطابق جلسة auth */
export async function upsertCompetitionRequestCloud(
  request: CompetitionRequest
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSessionUserId();
  if (!session.ok) return { ok: false, error: session.error };
  if (session.userId !== request.organizerId) {
    return {
      ok: false,
      error:
        'session_user_mismatch — أعد الدخول بحساب Sign up السحابي (وليس حساباً تجريبياً).',
    };
  }
  const sb = getSupabase()!;
  const row = {
    ...requestToRow(request),
    updated_at: new Date().toISOString(),
  };
  const { error } = await sb.from('competition_requests').insert(row);
  if (error) {
    console.warn('[supabase] insertCompetitionRequest', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** موافقة/رفض المشرف */
export async function updateCompetitionRequestCloud(
  request: CompetitionRequest
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSessionUserId();
  if (!session.ok) return { ok: false, error: session.error };
  const sb = getSupabase()!;
  const row = requestToRow(request);
  const { data, error } = await sb
    .from('competition_requests')
    .update({
      status: row.status,
      reviewed_at: row.reviewed_at,
      rejection_reason: row.rejection_reason,
      competition_id: row.competition_id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', request.id)
    .select('id');
  if (error) {
    console.warn('[supabase] updateCompetitionRequest', error.message);
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return {
      ok: false,
      error:
        'not_found_or_forbidden — نفّذ FIX-CLOUD-SYNC.sql وتأكد أن حسابك superadmin في profiles',
    };
  }
  return { ok: true };
}

export async function deleteCompetitionRequestCloud(
  requestId: string
): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSessionUserId();
  if (!session.ok) return { ok: false, error: session.error };
  const sb = getSupabase()!;
  const { data, error } = await sb
    .from('competition_requests')
    .delete()
    .eq('id', requestId)
    .select('id');
  if (error) {
    console.warn('[supabase] deleteCompetitionRequest', error.message);
    return { ok: false, error: error.message };
  }
  if (!data?.length) {
    return {
      ok: false,
      error:
        'not_found_or_forbidden — تأكد أن الطلب لك أو أنك مشرف، ونفّذ سياسة الحذف في SQL',
    };
  }
  return { ok: true };
}

export function subscribeCompetitionRequestsCloud(
  onChange: (items: CompetitionRequest[]) => void
): (() => void) | null {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;

  const pull = () => {
    void fetchCompetitionRequestsCloud().then((res) => {
      if (!shouldApplyCompetitionRequestsCloud(res)) return;
      onChange(res.items);
    });
  };

  pull();

  const channel = sb
    .channel('competition-requests-all')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'competition_requests',
      },
      () => pull()
    )
    .subscribe();

  return () => {
    void sb.removeChannel(channel);
  };
}
