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
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { comments: [], error: 'not_configured' };
  }
  const sb = getSupabase();
  if (!sb) return { comments: [], error: 'no_client' };
  const { data: sessionData } = await sb.auth.getSession();
  if (!sessionData.session) {
    return { comments: [], error: 'no_session' };
  }
  const { data, error } = await sb
    .from('forum_comments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) {
    console.warn('[forum] fetch', error.message);
    return { comments: [], error: error.message };
  }
  return {
    comments: ((data || []) as ForumCommentRow[]).map(rowToForumComment),
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

export async function toggleForumCommentLikeRemote(
  commentId: string,
  userId: string
): Promise<{ likes: string[]; error?: string }> {
  if (!isSupabaseConfigured() || !isUuid(commentId) || !isUuid(userId)) {
    return { likes: [], error: 'not_cloud' };
  }
  const sb = getSupabase();
  if (!sb) return { likes: [], error: 'no_client' };

  const { data, error } = await sb
    .from('forum_comments')
    .select('likes')
    .eq('id', commentId)
    .maybeSingle();
  if (error) return { likes: [], error: error.message };

  const current = Array.isArray((data as { likes?: string[] } | null)?.likes)
    ? ([...(data as { likes: string[] }).likes] as string[])
    : [];
  const liked = current.includes(userId);
  const next = liked
    ? current.filter((id) => id !== userId)
    : [...current, userId];

  const { error: upErr } = await sb
    .from('forum_comments')
    .update({ likes: next })
    .eq('id', commentId);
  if (upErr) return { likes: current, error: upErr.message };
  return { likes: next };
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
