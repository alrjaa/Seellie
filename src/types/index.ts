export type {
  Comment,
  Competition,
  CompetitionStaff,
  CompetitionVenue,
  DynamicFloatingIcon,
  GiftTransaction,
  Match,
  MatchMedia,
  Message,
  Offer,
  Player,
  Referee,
  SkillName,
  Supporter,
  SupportLevel,
  SupportLevelName,
  Team,
  TeamOfficial,
  User,
} from '@/data/initial-data';

export type UserRole = 'superadmin' | 'organizer' | 'follower' | 'freelancer';

export type CommentTarget =
  | { type: 'general' }
  | { type: 'player'; id: string }
  | { type: 'match'; competitionId: string; matchId: string };
