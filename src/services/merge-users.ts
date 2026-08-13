/**
 * FIX-02 — Pure merge of local users with cloud profiles (no RN/network).
 */
import type { User } from '@/data/initial-data';
import { stripAnalystAccessCode } from '@/services/analyst-strip';

/**
 * دمج القائمة المحلية مع السحابة:
 * نفس الإيميل → الحساب السحابي (UUID) يفوز ويزيل المكرر المحلي.
 * إن كان محتوى السحابة فارغاً نحتفظ بمحتوى محلي غير فارغ حتى لا يُمسَح بعد المزامنة.
 *
 * FIX-02 contract:
 * - Callers MUST NOT invoke this with cloudUsers=[] after a failed fetch.
 * - Empty successful catalog: callers may no-op (keep local) — empty ≠ delete.
 * - “Local newer” is emptiness-heuristic only (no timestamps); non-empty cloud wins that field.
 */
export function mergeUsersPreferCloud(
  localUsers: User[],
  cloudUsers: User[]
): User[] {
  // Defensive: never treat accidental empty cloud as a wipe of the whole roster.
  if (!cloudUsers.length) return localUsers;

  const byEmail = new Map<string, User>();
  for (const u of localUsers) {
    const key = (u.email || '').trim().toLowerCase();
    if (!key) continue;
    byEmail.set(key, u);
  }
  for (const u of cloudUsers) {
    const key = (u.email || '').trim().toLowerCase();
    if (!key) continue;
    const local = byEmail.get(key);
    if (!local) {
      byEmail.set(key, u);
      continue;
    }
    const cloudHasMedia =
      (u.media?.photos?.length || 0) + (u.media?.videos?.length || 0) > 0;
    const cloudHasPosts = (u.posts?.length || 0) > 0;
    const cloudHasAnalysis = (u.analysisContent?.length || 0) > 0;
    byEmail.set(key, {
      ...u,
      media: cloudHasMedia ? u.media : local.media || u.media,
      posts: cloudHasPosts ? u.posts : local.posts || u.posts,
      analysisContent: cloudHasAnalysis
        ? u.analysisContent
        : local.analysisContent || u.analysisContent,
      personalityPhotos:
        (u.personalityPhotos?.length || 0) > 0
          ? u.personalityPhotos
          : local.personalityPhotos || u.personalityPhotos,
      followers: u.followers?.length ? u.followers : local.followers,
      following: u.following?.length ? u.following : local.following,
      analyst: stripAnalystAccessCode(
        u.analyst?.status && u.analyst.status !== 'none'
          ? u.analyst
          : local.analyst || u.analyst
      ),
      permissions: {
        ...(local.permissions || {}),
        ...(u.permissions || {}),
        canCreateContent:
          u.permissions?.canCreateContent === true ||
          local.permissions?.canCreateContent === true ||
          u.analyst?.status === 'active' ||
          u.analyst?.status === 'warned' ||
          local.analyst?.status === 'active' ||
          local.analyst?.status === 'warned',
      },
    });
  }
  const hasCloudAdmin = cloudUsers.some((u) => u.role === 'superadmin');
  const merged = Array.from(byEmail.values()).filter((u) => {
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
  return merged;
}
