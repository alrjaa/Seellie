import type { User } from '@/data/initial-data';

/** إجمالي الإعجابات المستلمة على محتوى الحساب */
export function countReceivedLikes(user: User | null | undefined): number {
  if (!user) return 0;
  let total = 0;
  for (const post of user.posts || []) {
    total += post.likes?.length || 0;
  }
  for (const photo of user.media?.photos || []) {
    total += photo.likes?.length || 0;
  }
  for (const video of user.media?.videos || []) {
    total += video.likes?.length || 0;
  }
  for (const analysis of user.analysisContent || []) {
    total += analysis.likes?.length || 0;
  }
  for (const comment of user.comments || []) {
    total += comment.likes?.length || 0;
  }
  return total;
}

export type AccountSocialCounts = {
  likes: number;
  followers: number;
  following: number;
};

export function getAccountSocialCounts(
  user: User | null | undefined
): AccountSocialCounts {
  return {
    likes: countReceivedLikes(user),
    followers: user?.followers?.length || 0,
    following: user?.following?.length || 0,
  };
}

/** ضمان وجود مصفوفات المتابعة */
export function ensureSocialLists<T extends User>(user: T): T {
  return {
    ...user,
    followers: Array.isArray(user.followers) ? user.followers : [],
    following: Array.isArray(user.following) ? user.following : [],
  };
}

/**
 * علاقات متابعة أولية للعرض التجريبي.
 * a يتابع b → يُضاف a إلى followers[b] و b إلى following[a]
 */
export function seedSocialRelations(users: User[]): User[] {
  type MutableUser = User & { followers: string[]; following: string[] };
  const map = new Map<string, MutableUser>();
  for (const u of users) {
    const base = ensureSocialLists(u);
    map.set(u.id, {
      ...base,
      followers: [...(base.followers || [])],
      following: [...(base.following || [])],
    });
  }

  const follow = (followerId: string, targetId: string) => {
    const follower = map.get(followerId);
    const target = map.get(targetId);
    if (!follower || !target || followerId === targetId) return;
    if (!follower.following.includes(targetId)) {
      follower.following.push(targetId);
    }
    if (!target.followers.includes(followerId)) {
      target.followers.push(followerId);
    }
  };

  // شبكة تجريبية مترابطة بين الأدوار
  follow('follower-1', 'organizer-1');
  follow('follower-1', 'freelancer-1');
  follow('follower-1', 'follower-2');
  follow('follower-2', 'follower-1');
  follow('follower-2', 'organizer-1');
  follow('follower-3', 'follower-1');
  follow('follower-3', 'freelancer-1');
  follow('follower-4', 'organizer-2');
  follow('follower-5', 'follower-1');
  follow('organizer-1', 'freelancer-1');
  follow('organizer-1', 'follower-1');
  follow('organizer-2', 'organizer-1');
  follow('freelancer-1', 'organizer-1');
  follow('freelancer-1', 'follower-1');

  return Array.from(map.values());
}
