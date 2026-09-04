import type {
  Competition,
  Player,
  Referee,
  TeamOfficial,
  User,
} from '@/data/initial-data';
import { normalizeEmail } from '@/utils';

export type CompetitionAlertAudience = {
  managers: number;
  players: number;
  referees: number;
  /** حسابات مستخدمين مرتبطة يمكن تنبيهها */
  linkedUserIds: string[];
};

function normMobile(mobile?: string) {
  return (mobile || '').replace(/\D/g, '');
}

function normName(name?: string) {
  return (name || '').trim().toLowerCase();
}

function matchUser(
  users: User[],
  candidate: { id?: string; email?: string; mobile?: string; name?: string }
): User | undefined {
  if (candidate.id) {
    const byId = users.find((u) => u.id === candidate.id);
    if (byId) return byId;
  }
  const email = candidate.email ? normalizeEmail(candidate.email) : '';
  if (email) {
    const byEmail = users.find((u) => normalizeEmail(u.email) === email);
    if (byEmail) return byEmail;
  }
  const mobile = normMobile(candidate.mobile);
  if (mobile.length >= 8) {
    const byMobile = users.find((u) => normMobile(u.mobile) === mobile);
    if (byMobile) return byMobile;
  }
  const name = normName(candidate.name);
  if (name) {
    const byName = users.find((u) => normName(u.name) === name);
    if (byName) return byName;
  }
  return undefined;
}

function isTeamManagerOfficial(official: TeamOfficial) {
  return (
    official.role === 'مدير الفريق' ||
    official.role === 'مساعد مدير الفريق' ||
    official.role === 'مدرب' ||
    official.role === 'مساعد مدرب'
  );
}

/**
 * جمهور «الإعلام والتنبيه»: مدراء/مدربو الفرق + اللاعبون + الحكام
 * المعيّنون في المسابقة فقط — بلا علاقة ببوابة الإعلانات التجارية.
 */
export function resolveCompetitionAlertAudience(
  competition: Competition | undefined,
  users: User[],
  referees: Referee[],
  excludeUserId?: string
): CompetitionAlertAudience {
  if (!competition) {
    return { managers: 0, players: 0, referees: 0, linkedUserIds: [] };
  }

  const linked = new Set<string>();
  let managers = 0;
  let players = 0;

  for (const team of competition.teams || []) {
    for (const official of team.officials || []) {
      if (!isTeamManagerOfficial(official)) continue;
      managers += 1;
      const user = matchUser(users, {
        id: official.id,
        email: official.email,
        mobile: official.mobile,
        name: official.name,
      });
      if (user && user.id !== excludeUserId) linked.add(user.id);
    }
    for (const player of team.players || []) {
      players += 1;
      const user = matchUser(users, {
        id: player.id,
        email: player.email,
        mobile: player.mobile,
        name: player.name,
      });
      if (user && user.id !== excludeUserId) linked.add(user.id);
    }
  }

  const assignedRefs = (competition.refereeIds || [])
    .map((id) => referees.find((r) => r.id === id))
    .filter((r): r is Referee => !!r);

  for (const ref of assignedRefs) {
    const user = matchUser(users, {
      id: ref.id,
      mobile: ref.mobile,
      name: ref.name,
    });
    if (user && user.id !== excludeUserId) linked.add(user.id);
  }

  return {
    managers,
    players,
    referees: assignedRefs.length,
    linkedUserIds: [...linked],
  };
}

export function describePlayerForMatch(player: Player) {
  return {
    id: player.id,
    email: player.email,
    mobile: player.mobile,
    name: player.name,
  };
}
