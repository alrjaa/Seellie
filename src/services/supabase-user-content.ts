import type { Comment, User } from '@/data/initial-data';
import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { isUuid } from '@/services/supabase-messages';
import { requireCloudSession } from '@/services/cloud-write';
import {
  setAnalystAccessCodeCloud,
  stripAnalystAccessCode,
} from '@/services/analyst-secrets';

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

/**
 * تصنيف حقول profiles.content (FIX-01):
 * PUBLIC: posts, media, analysisContent, personalityPhotos, following/followers, city/region/country
 * PRIVATE: mobile (يظهر في الملف لكن لا يجب تسريبه في سجلات)
 * SENSITIVE: analyst.accessCode — ممنوع في content؛ جدول analyst_access_codes فقط
 * ADMIN_ONLY: moderation reasons داخل analyst (تحذير/حظر) — تُعرض للإدارة/المالك
 */

function reviveMediaItem<T extends { timestamp?: Date | string }>(
  item: T
): T {
  if (item.timestamp == null) return item;
  return {
    ...item,
    timestamp: new Date(item.timestamp as Date | string),
  };
}

function objectRows<T extends object>(raw: unknown): T[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (row): row is T => !!row && typeof row === 'object' && !Array.isArray(row)
  );
}

export function applyContentPayload(
  user: User,
  content: UserContentPayload | null | undefined
): User {
  if (!content || typeof content !== 'object') return user;
  try {
    const media = content.media || user.media || { photos: [], videos: [] };
    return {
      ...user,
      posts: Array.isArray(content.posts)
        ? objectRows<User['posts'][number]>(content.posts).map((p) => ({
            ...p,
            likes: Array.isArray(p.likes) ? p.likes : [],
            timestamp: new Date(p.timestamp as Date | string),
          }))
        : user.posts || [],
      media: {
        photos: objectRows<NonNullable<User['media']>['photos'][number]>(
          media.photos
        ).map((p) => reviveMediaItem({ ...p, likes: Array.isArray(p.likes) ? p.likes : [] })),
        videos: objectRows<NonNullable<User['media']>['videos'][number]>(
          media.videos
        ).map((v) => reviveMediaItem({ ...v, likes: Array.isArray(v.likes) ? v.likes : [] })),
      },
      analysisContent: Array.isArray(content.analysisContent)
        ? objectRows<User['analysisContent'][number]>(content.analysisContent).map(
            (a) => ({
              ...a,
              likes: Array.isArray(a.likes) ? a.likes : [],
              timestamp: new Date(a.timestamp as Date | string),
              comments: objectRows<Comment>(a.comments),
            })
          )
        : user.analysisContent || [],
      personalityPhotos: Array.isArray(content.personalityPhotos)
        ? content.personalityPhotos.filter(
            (url): url is string => typeof url === 'string' && !!url.trim()
          )
        : user.personalityPhotos || [],
      pinnedCompetitionIds: Array.isArray(content.pinnedCompetitionIds)
        ? content.pinnedCompetitionIds.filter(
            (id): id is string => typeof id === 'string' && !!id.trim()
          )
        : user.pinnedCompetitionIds || [],
      following: Array.isArray(content.following)
        ? content.following.filter(
            (id): id is string => typeof id === 'string' && !!id.trim()
          )
        : user.following || [],
      followers: Array.isArray(content.followers)
        ? content.followers.filter(
            (id): id is string => typeof id === 'string' && !!id.trim()
          )
        : user.followers || [],
      analyst: content.analyst
        ? stripAnalystAccessCode({
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
          })
        : user.analyst,
      permissions: content.permissions
        ? { ...user.permissions, ...content.permissions }
        : user.permissions,
      city: content.city ?? user.city,
      region: content.region ?? user.region,
      country: content.country ?? user.country,
      mobile: content.mobile ?? user.mobile,
    };
  } catch (error) {
    console.warn('[content] applyContentPayload failed; keeping local user', error);
    return user;
  }
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
    analyst: user.analyst
      ? stripAnalystAccessCode({ ...user.analyst })
      : user.analyst,
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

/**
 * يكتب حقل analyst فقط (موافقة/رفض) مع حفظ الرمز في جدول سري منفصل (FIX-01).
 */
export async function setAnalystProfileCloud(
  userId: string,
  analyst: NonNullable<User['analyst']>
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured() || !isUuid(userId)) {
    return { ok: false, error: 'not_cloud_user' };
  }
  const { session, error: sessionError } = await requireCloudSession();
  if (!session) {
    return { ok: false, error: sessionError || 'no_session' };
  }
  const sb = getSupabase();
  if (!sb) return { ok: false, error: 'no_client' };

  const secretCode = analyst.accessCode?.trim() || '';
  const safeAnalyst = stripAnalystAccessCode({ ...analyst });
  const payload = JSON.parse(
    JSON.stringify(safeAnalyst)
  ) as Record<string, unknown>;

  const { error: rpcError } = await sb.rpc('set_profile_analyst', {
    p_id: userId,
    p_analyst: payload,
  });

  if (rpcError) {
    console.warn('[analyst] set_profile_analyst', rpcError.message);
    return {
      ok: false,
      error:
        rpcError.message.includes('function') ||
        rpcError.message.includes('does not exist')
          ? 'analyst_rpc_missing — نفّذ supabase/FIX-01-ANALYST-SECRETS.sql'
          : rpcError.message,
    };
  }

  if (secretCode) {
    const secret = await setAnalystAccessCodeCloud(userId, secretCode);
    if (!secret.ok) {
      return {
        ok: false,
        error:
          secret.error ||
          'access_code_secret_failed — نفّذ supabase/FIX-01-ANALYST-SECRETS.sql',
      };
    }
  }

  const { data: check, error: checkErr } = await sb
    .from('profiles')
    .select('content')
    .eq('id', userId)
    .maybeSingle();
  if (checkErr) {
    return { ok: false, error: checkErr.message };
  }
  const got = (check?.content as { analyst?: User['analyst'] } | null)?.analyst;
  if (!got || got.status !== analyst.status) {
    return {
      ok: false,
      error:
        'analyst_not_persisted — نفّذ supabase/FIX-01-ANALYST-SECRETS.sql',
    };
  }
  // يجب ألا يعود accessCode في content العام
  if (got.accessCode) {
    return {
      ok: false,
      error: 'access_code_leaked_in_content — نفّذ FIX-01-ANALYST-SECRETS.sql',
    };
  }
  return { ok: true };
}

