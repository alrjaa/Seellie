/**
 * FIX-02 — Pure merge of local users with cloud profiles (no RN/network).
 */
import type { User } from '@/data/initial-data';
import { stripAnalystAccessCode } from '@/services/analyst-strip';

/**
 * دمج القائمة المحلية مع السحابة:
 * نفس المعرف → السحابة تفوز للحقول القادمة، مع الإبقاء على email/mobile المحلي إن حذفتها الكتالوج.
 * نفس الإيميل (بذرة محلية ↔ UUID سحابي) → الحساب السحابي يفوز ويزيل المكرر المحلي.
 */
export function mergeUsersPreferCloud(
  localUsers: User[],
  cloudUsers: User[]
): User[] {
  // Defensive: never treat accidental empty cloud as a wipe of the whole roster.
  if (!cloudUsers.length) return localUsers;

  const byId = new Map<string, User>();
  const byEmail = new Map<string, User>();

  const remember = (u: User) => {
    byId.set(u.id, u);
    const key = (u.email || '').trim().toLowerCase();
    if (key) byEmail.set(key, u);
  };

  for (const u of localUsers) remember(u);

  const mergePair = (local: User | undefined, cloud: User): User => {
    if (!local) return cloud;
    const cloudHasMedia =
      (cloud.media?.photos?.length || 0) + (cloud.media?.videos?.length || 0) >
      0;
    const cloudHasPosts = (cloud.posts?.length || 0) > 0;
    const cloudHasAnalysis = (cloud.analysisContent?.length || 0) > 0;
    return {
      ...cloud,
      email: cloud.email || local.email,
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
  };

  for (const cloud of cloudUsers) {
    const emailKey = (cloud.email || '').trim().toLowerCase();
    const local = byId.get(cloud.id) || (emailKey ? byEmail.get(emailKey) : undefined);
    const merged = mergePair(local, cloud);
    if (local && local.id !== merged.id) {
      byId.delete(local.id);
    }
    remember(merged);
  }

  const hasCloudAdmin = cloudUsers.some((u) => u.role === 'superadmin');
  const merged = Array.from(byId.values()).filter((u) => {
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
