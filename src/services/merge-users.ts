/**
 * FIX-02 / F14 — Pure merge of local users with cloud profiles (no RN/network).
 *
 * Identity is `user.id`. Email is optional and never required to keep a user.
 * Email is used only as a secondary key to link a local seed row to a cloud UUID.
 *
 * FIX-02 contract:
 * - Callers MUST NOT invoke this with cloudUsers=[] after a failed fetch.
 * - Empty successful catalog: callers may no-op (keep local) — empty ≠ delete.
 * - “Local newer” is emptiness-heuristic only (no timestamps); non-empty cloud wins that field.
 */
import type { User } from '@/data/initial-data';
import { stripAnalystAccessCode } from '@/services/analyst-strip';

function emailKey(user: User | undefined): string {
  return (user?.email || '').trim().toLowerCase();
}

function mergeUserPair(local: User | undefined, cloud: User): User {
  if (!local) {
    return {
      ...cloud,
      posts: cloud.posts || [],
      analysisContent: cloud.analysisContent || [],
      personalityPhotos: cloud.personalityPhotos || [],
      media: cloud.media || { photos: [], videos: [] },
    };
  }
  const cloudHasMedia =
    (cloud.media?.photos?.length || 0) + (cloud.media?.videos?.length || 0) > 0;
  const cloudHasPosts = (cloud.posts?.length || 0) > 0;
  const cloudHasAnalysis = (cloud.analysisContent?.length || 0) > 0;
  return {
    ...cloud,
    email: emailKey(cloud) ? cloud.email : local.email || cloud.email,
    mobile: cloud.mobile || local.mobile,
    media: cloudHasMedia ? cloud.media : local.media || cloud.media,
    posts: cloudHasPosts ? cloud.posts : local.posts || cloud.posts,
    analysisContent: cloudHasAnalysis
      ? cloud.analysisContent
      : local.analysisContent || cloud.analysisContent,
    personalityPhotos:
      (cloud.personalityPhotos?.length || 0) > 0
        ? cloud.personalityPhotos
        : local.personalityPhotos || cloud.personalityPhotos,
    followers: cloud.followers?.length ? cloud.followers : local.followers,
    following: cloud.following?.length ? cloud.following : local.following,
    analyst: stripAnalystAccessCode(
      cloud.analyst?.status && cloud.analyst.status !== 'none'
        ? cloud.analyst
        : local.analyst || cloud.analyst
    ),
    permissions: {
      ...(local.permissions || {}),
      ...(cloud.permissions || {}),
      canCreateContent:
        cloud.permissions?.canCreateContent === true ||
        local.permissions?.canCreateContent === true ||
        cloud.analyst?.status === 'active' ||
        cloud.analyst?.status === 'warned' ||
        local.analyst?.status === 'active' ||
        local.analyst?.status === 'warned',
    },
  };
}

export function mergeUsersPreferCloud(
  localUsers: User[],
  cloudUsers: User[]
): User[] {
  // Defensive: never treat accidental empty cloud as a wipe of the whole roster.
  if (!cloudUsers.length) return localUsers;

  const byId = new Map<string, User>();
  const emailToId = new Map<string, string>();

  for (const user of localUsers) {
    if (!user?.id) continue;
    byId.set(user.id, user);
    const key = emailKey(user);
    if (key) emailToId.set(key, user.id);
  }

  for (const cloud of cloudUsers) {
    if (!cloud?.id) continue;
    let local = byId.get(cloud.id);
    if (!local) {
      const key = emailKey(cloud);
      const localId = key ? emailToId.get(key) : undefined;
      if (localId && localId !== cloud.id) {
        local = byId.get(localId);
        byId.delete(localId);
      }
    }
    const merged = mergeUserPair(local, cloud);
    byId.set(cloud.id, merged);
    const key = emailKey(merged);
    if (key) emailToId.set(key, cloud.id);
  }

  const hasCloudAdmin = cloudUsers.some((u) => u.role === 'superadmin');
  return Array.from(byId.values()).filter((u) => {
    if (!hasCloudAdmin) return true;
    if (u.id === 'superadmin-1') return false;
    if (
      u.role === 'superadmin' &&
      u.passwordHash !== 'supabase' &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        u.id
      )
    ) {
      return false;
    }
    return true;
  });
}
