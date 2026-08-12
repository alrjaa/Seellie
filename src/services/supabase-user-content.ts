import type { Comment, User } from '@/data/initial-data';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';
import { requireCloudSession } from '@/services/cloud-write';

export type UserContentPayload = {
  posts?: User['posts'];
  media?: User['media'];
  analysisContent?: User['analysisContent'];
  personalityPhotos?: string[];
  pinnedCompetitionIds?: string[];
  following?: string[];
  followers?: string[];
  analyst?: User['analyst'];
  permissions?: User['permissions'];
  city?: string;
  region?: string;
  country?: string;
  mobile?: string;
};

function reviveMediaItem<T extends { timestamp?: Date | string }>(
  item: T
): T {
  if (item.timestamp == null) return item;
  return {
    ...item,
    timestamp: new Date(item.timestamp as Date | string),
  };
}

export function applyContentPayload(
  user: User,
  content: UserContentPayload | null | undefined
): User {
  if (!content || typeof content !== 'object') return user;
  const media = content.media || user.media || { photos: [], videos: [] };
  return {
    ...user,
    posts: Array.isArray(content.posts)
      ? content.posts.map((p) => ({
          ...p,
          timestamp: new Date(p.timestamp as Date | string),
        }))
      : user.posts || [],
    media: {
      photos: (media.photos || []).map((p) => reviveMediaItem(p)),
      videos: (media.videos || []).map((v) => reviveMediaItem(v)),
    },
    analysisContent: Array.isArray(content.analysisContent)
      ? content.analysisContent.map((a) => ({
          ...a,
          timestamp: new Date(a.timestamp as Date | string),
          comments: (a.comments || []) as Comment[],
        }))
      : user.analysisContent || [],
    personalityPhotos: Array.isArray(content.personalityPhotos)
      ? content.personalityPhotos
      : user.personalityPhotos || [],
    pinnedCompetitionIds: Array.isArray(content.pinnedCompetitionIds)
      ? content.pinnedCompetitionIds
      : user.pinnedCompetitionIds || [],
    following: Array.isArray(content.following)
      ? content.following
      : user.following || [],
    followers: Array.isArray(content.followers)
      ? content.followers
      : user.followers || [],
    analyst: content.analyst
      ? {
          ...content.analyst,
          termsAcceptedAt: content.analyst.termsAcceptedAt
            ? new Date(content.analyst.termsAcceptedAt as Date | string)
            : undefined,
          requestedAt: content.analyst.requestedAt
            ? new Date(content.analyst.requestedAt as Date | string)
            : undefined,
          reviewedAt: content.analyst.reviewedAt
            ? new Date(content.analyst.reviewedAt as Date | string)
            : undefined,
          accessCodeSentAt: content.analyst.accessCodeSentAt
            ? new Date(content.analyst.accessCodeSentAt as Date | string)
            : undefined,
          warnedAt: content.analyst.warnedAt
            ? new Date(content.analyst.warnedAt as Date | string)
            : undefined,
          bannedAt: content.analyst.bannedAt
            ? new Date(content.analyst.bannedAt as Date | string)
            : undefined,
          suspendFrom: content.analyst.suspendFrom
            ? new Date(content.analyst.suspendFrom as Date | string)
            : undefined,
          suspendTo: content.analyst.suspendTo
            ? new Date(content.analyst.suspendTo as Date | string)
            : undefined,
        }
      : user.analyst,
    permissions: content.permissions
      ? { ...user.permissions, ...content.permissions }
      : user.permissions,
    city: content.city ?? user.city,
    region: content.region ?? user.region,
    country: content.country ?? user.country,
    mobile: content.mobile ?? user.mobile,
  };
}

export function userToContentPayload(user: User): UserContentPayload {
  return {
    posts: user.posts || [],
    media: user.media || { photos: [], videos: [] },
    analysisContent: user.analysisContent || [],
    personalityPhotos: user.personalityPhotos || [],
    pinnedCompetitionIds: user.pinnedCompetitionIds || [],
    following: user.following || [],
    followers: user.followers || [],
    analyst: user.analyst,
    permissions: user.permissions,
    city: user.city,
    region: user.region,
    country: user.country,
    mobile: user.mobile,
  };
}

/**
 * يكتب profiles.content.
 * - مالك الحساب: تحديث مباشر (+ حقول الملف).
 * - مستخدم آخر (إعجاب/متابعة/مشرف محللين): RPC replace_profile_content.
 */
export async function upsertUserContentCloud(
  user: User,
  options?: { allowCrossUser?: boolean }
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !isUuid(user.id)) {
    return { ok: false, error: 'not_cloud_user' };
  }
  const allowCross = options?.allowCrossUser === true;
  const { session, error: sessionError } = await requireCloudSession(
    allowCross ? undefined : user.id
  );
  if (!session) {
    return { ok: false, error: sessionError || 'no_session' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  const content = userToContentPayload(user);
  const isOwner = session.userId === user.id;

  if (isOwner) {
    const { error } = await sb
      .from('profiles')
      .update({
        content,
        avatar: user.avatar || null,
        bio: user.bio || null,
        city: user.city || null,
        region: user.region || null,
        country: user.country || null,
        mobile: user.mobile || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    if (error) {
      console.warn('[content] upsertUserContent', error.message);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  }

  // مشرف يعدّل محللاً / إعجاب على منشور غيرك — عبر RPC (نفّذ CONTENT-CLOUD-RPC.sql)
  const { error: rpcError } = await sb.rpc('replace_profile_content', {
    p_id: user.id,
    p_content: content,
  });
  if (rpcError) {
    // احتياطي: سياسة profiles_update_admin إن وُجدت
    const { error } = await sb
      .from('profiles')
      .update({
        content,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);
    if (error) {
      console.warn(
        '[content] upsert cross-user',
        rpcError.message,
        error.message
      );
      return { ok: false, error: rpcError.message || error.message };
    }
  }
  return { ok: true };
}
