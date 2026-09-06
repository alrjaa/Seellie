import type { Competition, Referee, User } from '@/data/initial-data';
import {
  allocateUniqueHandle,
  ensureAccountIdentity,
} from '@/utils/account';
import { createId } from '@/utils/id';
import { hashPassword } from '@/utils/password';
import { normalizeEmail } from '@/utils';
import { normalizeUserRoles } from '@/utils/roles';
import { ensureSocialLists } from '@/utils/social-stats';

/** كلمة مرور افتراضية غير حقيقية لحسابات التشكيلة المحلية */
export const ROSTER_PLACEHOLDER_PASSWORD = 'Seellie#Roster';

/** نطاق بريد وهمي — ليس حساباً حقيقياً */
export const ROSTER_PLACEHOLDER_EMAIL_DOMAIN = 'roster.seellie.local';

/** جوال افتراضي وهمي عند غياب الرقم */
export const ROSTER_PLACEHOLDER_MOBILE = '0500000000';

export const ROSTER_USERS_STORAGE_KEY = 'tajjd.roster.followerAccounts';

export type RosterPersonInput = {
  name: string;
  email?: string;
  mobile?: string;
  avatar?: string;
  city?: string;
  region?: string;
  country?: string;
  /** إن وُجد يُفضَّل استخدامه كمعرّف الحساب */
  preferredId?: string;
};

function normMobile(mobile?: string) {
  return (mobile || '').replace(/\D/g, '');
}

function normName(name?: string) {
  return (name || '').trim().toLowerCase();
}

function slugifyName(name: string): string {
  const raw = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^\w\u0600-\u06FF]/g, '')
    .slice(0, 28);
  return raw || 'member';
}

function placeholderAvatar(name: string): string {
  const letter = encodeURIComponent((name.trim().slice(0, 1) || '?').toUpperCase());
  return `https://placehold.co/100x100/0d1a26/ffffff.png?text=${letter}`;
}

function isPlaceholderEmail(email?: string): boolean {
  const e = normalizeEmail(email || '');
  return e.endsWith(`@${ROSTER_PLACEHOLDER_EMAIL_DOMAIN}`);
}

function isPlaceholderMobile(mobile?: string): boolean {
  return normMobile(mobile) === normMobile(ROSTER_PLACEHOLDER_MOBILE);
}

/** مطابقة حساب متابع موجود بالهوية / البريد / الجوال / الاسم */
export function matchFollowerUser(
  users: User[],
  candidate: {
    id?: string;
    email?: string;
    mobile?: string;
    name?: string;
  }
): User | undefined {
  if (candidate.id) {
    const byId = users.find((u) => u.id === candidate.id);
    if (byId) return byId;
  }
  const email = candidate.email ? normalizeEmail(candidate.email) : '';
  if (email && !isPlaceholderEmail(email)) {
    const byEmail = users.find((u) => normalizeEmail(u.email) === email);
    if (byEmail) return byEmail;
  }
  const mobile = normMobile(candidate.mobile);
  if (mobile.length >= 8 && !isPlaceholderMobile(mobile)) {
    const byMobile = users.find((u) => normMobile(u.mobile) === mobile);
    if (byMobile) return byMobile;
  }
  const name = normName(candidate.name);
  if (name) {
    const byName = users.find((u) => normName(u.name) === name);
    if (byName) return byName;
  }
  // بريد وهمي فريد قد يطابق حساباً سبق إنشاؤه لنفس الشخص
  if (email && isPlaceholderEmail(email)) {
    const byEmail = users.find((u) => normalizeEmail(u.email) === email);
    if (byEmail) return byEmail;
  }
  return undefined;
}

function uniquePlaceholderEmail(name: string, users: User[]): string {
  const taken = new Set(users.map((u) => normalizeEmail(u.email)));
  const stem = slugifyName(name);
  let email = `${stem}@${ROSTER_PLACEHOLDER_EMAIL_DOMAIN}`;
  let i = 2;
  while (taken.has(normalizeEmail(email))) {
    email = `${stem}${i}@${ROSTER_PLACEHOLDER_EMAIL_DOMAIN}`;
    i += 1;
  }
  return email;
}

/**
 * إيجاد حساب متابع أو إنشاؤه من بيانات التشكيلة.
 * النواقص تُملأ بقيم افتراضية وهمية (ليست حقيقية).
 */
export function findOrCreateFollowerAccount(
  users: User[],
  input: RosterPersonInput
): { user: User; created: boolean; nextUsers: User[] } {
  const name = input.name.trim();
  if (!name) {
    throw new Error('roster_name_required');
  }

  const matched = matchFollowerUser(users, {
    id: input.preferredId,
    email: input.email,
    mobile: input.mobile,
    name,
  });

  if (matched) {
    let next = matched;
    let changed = false;
    if (!next.avatar && input.avatar?.trim()) {
      next = { ...next, avatar: input.avatar.trim() };
      changed = true;
    }
    if (
      input.mobile?.trim() &&
      (!next.mobile || isPlaceholderMobile(next.mobile))
    ) {
      next = { ...next, mobile: input.mobile.trim() };
      changed = true;
    }
    if (
      input.email?.trim() &&
      !isPlaceholderEmail(input.email) &&
      isPlaceholderEmail(next.email)
    ) {
      next = { ...next, email: normalizeEmail(input.email) };
      changed = true;
    }
    if (input.city?.trim() && !next.city) {
      next = { ...next, city: input.city.trim() };
      changed = true;
    }
    if (!changed) {
      return { user: matched, created: false, nextUsers: users };
    }
    return {
      user: next,
      created: false,
      nextUsers: users.map((u) => (u.id === next.id ? next : u)),
    };
  }

  const email = input.email?.trim()
    ? normalizeEmail(input.email)
    : uniquePlaceholderEmail(name, users);

  const draft: User = {
    id: input.preferredId || createId('fol'),
    name,
    email,
    passwordHash: hashPassword(ROSTER_PLACEHOLDER_PASSWORD),
    role: 'follower',
    roles: ['follower'],
    activeRole: 'follower',
    status: 'active',
    permissions: { canComment: true, canCreateContent: false },
    handle: allocateUniqueHandle(
      email.split('@')[0] || name,
      users.map((u) => u.handle)
    ),
    visibleId: '',
    mobile: input.mobile?.trim() || ROSTER_PLACEHOLDER_MOBILE,
    avatar: input.avatar?.trim() || placeholderAvatar(name),
    city: input.city?.trim() || undefined,
    region: input.region?.trim() || undefined,
    country: input.country?.trim() || undefined,
    posts: [],
    media: { photos: [], videos: [] },
    personalityPhotos: [],
    analysisContent: [],
    comments: [],
  };

  const user = ensureSocialLists(
    normalizeUserRoles(ensureAccountIdentity(draft, users))
  );

  return { user, created: true, nextUsers: [...users, user] };
}

export type RosterLinkSnapshot = {
  users: User[];
  createdCount: number;
};

/**
 * يربط اللاعبين / الإدارة / الحكام الحاليين بحسابات متابع
 * وينشئ حسابات وهمية للنواقص.
 */
export function linkRosterToFollowerAccounts(
  competitions: Competition[],
  referees: Referee[],
  users: User[]
): {
  competitions: Competition[];
  referees: Referee[];
  users: User[];
  createdCount: number;
} {
  let nextUsers = users;
  let createdCount = 0;

  const ensure = (input: RosterPersonInput) => {
    const result = findOrCreateFollowerAccount(nextUsers, input);
    nextUsers = result.nextUsers;
    if (result.created) createdCount += 1;
    return result.user;
  };

  const idRemap = new Map<string, string>();

  const nextCompetitions = competitions.map((comp) => {
    const teams = comp.teams.map((team) => {
      const players = team.players.map((p) => {
        const user = ensure({
          preferredId: p.id,
          name: p.name,
          email: p.email,
          mobile: p.mobile,
          avatar: p.avatar,
        });
        if (p.id !== user.id) idRemap.set(p.id, user.id);
        return {
          ...p,
          id: user.id,
          visibleId: user.visibleId || p.visibleId,
          name: user.name,
          avatar: user.avatar || p.avatar,
          email: user.email,
          mobile: user.mobile || p.mobile,
        };
      });
      const officials = (team.officials || []).map((o) => {
        const user = ensure({
          preferredId: o.id,
          name: o.name,
          email: o.email,
          mobile: o.mobile,
          avatar: o.avatar,
        });
        if (o.id !== user.id) idRemap.set(o.id, user.id);
        return {
          ...o,
          id: user.id,
          name: user.name,
          avatar: user.avatar || o.avatar,
          email: user.email,
          mobile: user.mobile || o.mobile,
        };
      });
      return { ...team, players, officials };
    });

    const staff = (comp.staff || []).map((s) => {
      const user = ensure({
        preferredId: s.id,
        name: s.name,
        email: s.email,
        mobile: s.mobile,
        avatar: s.avatar,
      });
      if (s.id !== user.id) idRemap.set(s.id, user.id);
      return {
        ...s,
        id: user.id,
        name: user.name,
        avatar: user.avatar || s.avatar,
        email: user.email,
        mobile: user.mobile || s.mobile,
      };
    });

    return { ...comp, teams, staff };
  });

  const nextReferees = referees.map((ref) => {
    const user = ensure({
      preferredId: ref.id,
      name: ref.name,
      mobile: ref.mobile,
      email: ref.email,
      avatar: ref.avatar,
      city: ref.city,
    });
    if (ref.id !== user.id) idRemap.set(ref.id, user.id);
    return {
      ...ref,
      id: user.id,
      name: user.name,
      avatar: user.avatar || ref.avatar,
      mobile: user.mobile || ref.mobile,
      email: user.email || ref.email,
      city: user.city || ref.city,
    };
  });

  const competitionsWithRefIds = nextCompetitions.map((comp) => ({
    ...comp,
    refereeIds: (comp.refereeIds || []).map((id) => idRemap.get(id) || id),
  }));

  return {
    competitions: competitionsWithRefIds,
    referees: nextReferees,
    users: nextUsers,
    createdCount,
  };
}
