import type { ShareCard, ShareCardKind, ShareCardStatus } from '@/data/initial-data';
import { getSupabase } from '@/services/supabase';
import { uploadShareMedia } from '@/services/supabase-storage';

export type ShareCardRow = {
  id: string;
  kind: string;
  status: string;
  sender_id: string;
  sender_name: string;
  sender_avatar: string | null;
  sender_handle: string | null;
  sender_role: string | null;
  recipient_id: string;
  recipient_name: string;
  recipient_kind: string | null;
  title: string | null;
  body: string | null;
  media_url: string | null;
  media_kind: string | null;
  competition_id: string | null;
  competition_name: string | null;
  team_id: string | null;
  team_name: string | null;
  position: string | null;
  read: boolean | null;
  created_at: string;
};

export function rowToShareCard(row: ShareCardRow): ShareCard {
  return {
    id: row.id,
    kind: row.kind as ShareCardKind,
    status: row.status as ShareCardStatus,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderAvatar: row.sender_avatar || undefined,
    senderHandle: row.sender_handle || undefined,
    senderRole: row.sender_role || undefined,
    recipientId: row.recipient_id,
    recipientName: row.recipient_name,
    recipientKind: (row.recipient_kind as 'user' | 'referee') || 'user',
    title: row.title || undefined,
    body: row.body || undefined,
    mediaUrl: row.media_url || undefined,
    mediaKind: (row.media_kind as ShareCard['mediaKind']) || undefined,
    competitionId: row.competition_id || undefined,
    competitionName: row.competition_name || undefined,
    teamId: row.team_id || undefined,
    teamName: row.team_name || undefined,
    position: row.position || undefined,
    timestamp: new Date(row.created_at),
    read: !!row.read,
  };
}

export async function fetchShareCardsForUser(
  userId: string
): Promise<ShareCard[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const { data, error } = await sb
    .from('share_cards')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error || !data) {
    console.warn('[supabase] fetchShareCards', error?.message);
    return [];
  }
  return (data as ShareCardRow[]).map(rowToShareCard);
}

export async function insertShareCard(input: {
  kind: ShareCardKind;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  senderHandle?: string;
  senderRole?: string;
  recipientId: string;
  recipientName: string;
  recipientKind?: 'user' | 'referee';
  title?: string;
  body?: string;
  mediaUrl?: string;
  mediaKind?: 'photo' | 'video' | 'text' | 'link';
  competitionId?: string;
  competitionName?: string;
  teamId?: string;
  teamName?: string;
  position?: string;
}): Promise<ShareCard | null> {
  const sb = getSupabase();
  if (!sb) return null;

  let mediaUrl = input.mediaUrl;
  if (
    mediaUrl &&
    input.mediaKind &&
    (input.mediaKind === 'photo' || input.mediaKind === 'video') &&
    !/^https?:\/\//i.test(mediaUrl)
  ) {
    const uploaded = await uploadShareMedia(
      mediaUrl,
      input.mediaKind,
      input.senderId
    );
    if (uploaded) mediaUrl = uploaded;
  }

  const payload = {
    kind: input.kind,
    status: 'pending',
    sender_id: input.senderId,
    sender_name: input.senderName,
    sender_avatar: input.senderAvatar || null,
    sender_handle: input.senderHandle || null,
    sender_role: input.senderRole || null,
    recipient_id: input.recipientId,
    recipient_name: input.recipientName,
    recipient_kind: input.recipientKind || 'user',
    title: input.title || null,
    body: input.body || null,
    media_url: mediaUrl || null,
    media_kind: input.mediaKind || null,
    competition_id: input.competitionId || null,
    competition_name: input.competitionName || null,
    team_id: input.teamId || null,
    team_name: input.teamName || null,
    position: input.position || null,
    read: false,
  };

  const { data, error } = await sb
    .from('share_cards')
    .insert(payload)
    .select('*')
    .single();
  if (error || !data) {
    console.warn('[supabase] insertShareCard', error?.message);
    return null;
  }
  return rowToShareCard(data as ShareCardRow);
}

export async function updateShareCardRemote(
  cardId: string,
  patch: { status?: ShareCardStatus; read?: boolean }
): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const body: Record<string, unknown> = {};
  if (patch.status) body.status = patch.status;
  if (typeof patch.read === 'boolean') body.read = patch.read;
  const { error } = await sb.from('share_cards').update(body).eq('id', cardId);
  if (error) {
    console.warn('[supabase] updateShareCard', error.message);
    return false;
  }
  return true;
}

function mapProfileHits(
  data: Array<Record<string, unknown>> | null
): ProfileHit[] {
  if (!data?.length) return [];
  return data.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    handle: (r.handle as string) || (r.visible_id as string) || '',
    email: (r.email as string) || undefined,
    kind: 'user' as const,
  }));
}

/** أحدث الحسابات السحابية (للمشرف عند إرسال رسالة بين جهازَين) */
export async function listRecentProfiles(excludeId: string, limit = 30) {
  const sb = getSupabase();
  if (!sb) return [] as ProfileHit[];
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    console.warn('[supabase] listRecentProfiles: no auth session');
    return [];
  }
  let query = sb
    .from('profiles')
    .select('id, name, handle, visible_id, role, email, created_at')
    .neq('role', 'superadmin')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error || !data) {
    console.warn('[supabase] listRecentProfiles', error?.message);
    return [];
  }
  return mapProfileHits(data as Array<Record<string, unknown>>);
}

export async function searchProfiles(query: string, excludeId: string) {
  const sb = getSupabase();
  if (!sb) return [] as ProfileHit[];
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    console.warn('[supabase] searchProfiles: no auth session');
    return [];
  }

  const q = query.trim();
  if (!q) return listRecentProfiles(excludeId);

  // البحث بالإيميل يجب أن يكون منفصلاً — رمز @ يكسر فلتر .or في PostgREST
  if (q.includes('@')) {
    const email = q.toLowerCase();
    const { data, error } = await sb
      .from('profiles')
      .select('id, name, handle, visible_id, role, email')
      .ilike('email', `%${email}%`)
      .neq('role', 'superadmin')
      .limit(12);
    if (error || !data) {
      console.warn('[supabase] searchProfiles email', error?.message);
      return [];
    }
    return mapProfileHits(
      (data as Array<Record<string, unknown>>).filter(
        (r) => !excludeId || r.id !== excludeId
      )
    );
  }

  if (q.length < 1) return [];
  // إزالة رموز تكسر صيغة or
  const safe = q.replace(/[%_,.()]/g, ' ').trim();
  if (safe.length < 1) return [];

  const { data, error } = await sb
    .from('profiles')
    .select('id, name, handle, visible_id, role, email')
    .or(
      `name.ilike.%${safe}%,handle.ilike.%${safe}%,email.ilike.%${safe}%,visible_id.ilike.%${safe}%`
    )
    .neq('role', 'superadmin')
    .limit(12);
  if (error || !data) {
    console.warn('[supabase] searchProfiles', error?.message);
    return [];
  }
  return mapProfileHits(
    (data as Array<Record<string, unknown>>).filter(
      (r) => !excludeId || r.id !== excludeId
    )
  );
}

export type ProfileHit = {
  id: string;
  name: string;
  handle: string;
  email?: string;
  kind: 'user';
};
