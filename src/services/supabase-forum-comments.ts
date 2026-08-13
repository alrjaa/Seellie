import type { Comment } from '@/data/initial-data';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';

export type ForumCommentRow = {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar: string | null;
  body: string;
  video_url: string | null;
  video_duration_sec: number | null;
  likes: string[] | null;
  status: string | null;
  status_reason: string | null;
  created_at: string;
};

export function rowToForumComment(row: ForumCommentRow): Comment {
  return {
    id: row.id,
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatar: row.author_avatar || '',
    text: row.body || '',
    videoUrl: row.video_url || undefined,
    videoDurationSec: row.video_duration_sec ?? undefined,
    timestamp: new Date(row.created_at),
    replies: [],
    likes: Array.isArray(row.likes) ? row.likes : [],
    status: (row.status as Comment['status']) || 'active',
    statusReason: row.status_reason || undefined,
  };
}

export function mergeCommentsById(
  primary: Comment[],
  secondary: Comment[]
): Comment[] {
  const map = new Map<string, Comment>();
  for (const c of secondary) map.set(c.id, c);
  for (const c of primary) map.set(c.id, c);
  return Array.from(map.values()).sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
  );
}

export async function fetchForumComments(): Promise<{
  comments: Comment[];
  ok: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { comments: [], ok: false, error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { comments: [], ok: false, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { comments: [], ok: false, error: 'no_session' };
  }
  const { data, error } = await sb
    .from('forum_comments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    console.warn('[forum] fetch', error.message);
    return { comments: [], ok: false, error: error.message };
  }
  return {
    comments: ((data || []) as ForumCommentRow[]).map(rowToForumComment),
    ok: true,
  };
}

export async function insertForumComment(input: {
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  text: string;
  videoUrl?: string;
  videoDurationSec?: number;
}): Promise<{ comment: Comment | null; error?: string }> {
  if (!isSupabaseConfigured() || !isUuid(input.authorId)) {
    return { comment: null, error: 'not_cloud_user' };
  }
  const sb = getSupabase();
  if (!sb) return { comment: null, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { comment: null, error: 'no_session' };
  }
  const { data, error } = await sb
    .from('forum_comments')
    .insert({
      author_id: input.authorId,
      author_name: input.authorName,
      author_avatar: input.authorAvatar || null,
      body: input.text || '',
      video_url: input.videoUrl || null,
      video_duration_sec: input.videoDurationSec ?? null,
      likes: [],
      status: 'active',
    })
    .select('*')
    .single();
  if (error) {
    console.warn('[forum] insert', error.message);
    return { comment: null, error: error.message };
  }
  return { comment: rowToForumComment(data as ForumCommentRow) };
}

export async function updateForumCommentStatusRemote(
  commentId: string,
  status: Comment['status'],
  statusReason?: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !isUuid(commentId)) {
    return { ok: false, error: 'not_cloud' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) return { ok: false, error: 'no_session' };

  // SECURITY-PHASE4: status عبر RPC للمشرف فقط
  const { data, error } = await sb.rpc('set_forum_comment_status', {
    p_comment_id: commentId,
    p_status: status || 'active',
    p_reason: statusReason || null,
  });
  if (error) {
    console.warn('[forum] status', error.message);
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

export async function toggleForumCommentLikeRemote(
  commentId: string,
  userId: string
): Promise<{ likes: string[]; error?: string }> {
  if (!isSupabaseConfigured() || !isUuid(commentId) || !isUuid(userId)) {
    return { likes: [], error: 'not_cloud' };
  }
  const sb = getSupabase();
  if (!sb) return { likes: [], error: 'no_client' };

  // SECURITY-PHASE4: تبديل إعجاب المستخدم الحالي فقط عبر RPC
  const { data, error } = await sb.rpc('toggle_forum_comment_like', {
    p_comment_id: commentId,
  });
  if (error) return { likes: [], error: error.message };
  if (data && typeof data === 'object') {
    const payload = data as { ok?: boolean; likes?: string[]; error?: string };
    if (payload.ok === false) {
      return { likes: [], error: payload.error || 'rpc_failed' };
    }
    if (Array.isArray(payload.likes)) {
      return { likes: payload.likes.map(String) };
    }
  }
  return { likes: [] };
}

export function subscribeForumComments(
  onInsert: (comment: Comment) => void
): (() => void) | null {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  const channel = sb
    .channel('forum-comments-live')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'forum_comments',
      },
      (payload) => {
        const row = payload.new as ForumCommentRow;
        if (row?.id) onInsert(rowToForumComment(row));
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'forum_comments',
      },
      (payload) => {
        const row = payload.new as ForumCommentRow;
        if (row?.id) onInsert(rowToForumComment(row));
      }
    )
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}
