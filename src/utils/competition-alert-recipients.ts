import type {
  Competition,
  Player,
  Referee,
  TeamOfficial,
  User,
} from '@/data/initial-data';
import { matchFollowerUser } from '@/utils/roster-follower-account';

export type CompetitionAlertAudience = {
  managers: number;
  players: number;
  referees: number;
  /** حسابات مستخدمين مرتبطة يمكن تنبيهها */
  linkedUserIds: string[];
};

/**
 * جمهور «الإعلام والتنبيه»: إدارة الفرق + طاقم المسابقة + اللاعبون + الحكام
 * المرتبطون بحسابات متابع.
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

  const linkPerson = (candidate: {
    id?: string;
    email?: string;
    mobile?: string;
    name?: string;
  }) => {
    const user = matchFollowerUser(users, candidate);
    if (user && user.id !== excludeUserId) linked.add(user.id);
  };

  for (const team of competition.teams || []) {
    for (const official of team.officials || []) {
      managers += 1;
      linkPerson({
        id: official.id,
        email: official.email,
        mobile: official.mobile,
        name: official.name,
      });
    }
    for (const player of team.players || []) {
      players += 1;
      linkPerson({
        id: player.id,
        email: player.email,
        mobile: player.mobile,
        name: player.name,
      });
    }
  }

  for (const staff of competition.staff || []) {
    managers += 1;
    linkPerson({
      id: staff.id,
      email: staff.email,
      mobile: staff.mobile,
      name: staff.name,
    });
  }

  const assignedRefs = (competition.refereeIds || [])
    .map((id) => referees.find((r) => r.id === id))
    .filter((r): r is Referee => !!r);

  for (const ref of assignedRefs) {
    linkPerson({
      id: ref.id,
      email: ref.email,
      mobile: ref.mobile,
      name: ref.name,
    });
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

export function describeOfficialForMatch(official: TeamOfficial) {
  return {
    id: official.id,
    email: official.email,
    mobile: official.mobile,
    name: official.name,
  };
}
