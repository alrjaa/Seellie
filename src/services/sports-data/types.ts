/** أنواع موحّدة لطبقة البيانات الرياضية — مستقلة عن مزوّد API-Football */

import type { SeasonWindow } from './season-window';

export type { SeasonWindow };

export type SportsStandingRow = {
  rank: number;
  teamId: string;
  teamName: string;
  teamLogo?: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  form?: string;
};

export type SportsFixture = {
  id: string;
  date: string;
  status: string;
  elapsed?: number;
  homeName: string;
  awayName: string;
  homeLogo?: string;
  awayLogo?: string;
  homeScore: number | null;
  awayScore: number | null;
  round?: string;
};

export type SportsTopScorerRow = {
  rank: number;
  playerId: number;
  playerName: string;
  playerPhoto?: string;
  teamId: number | null;
  teamName?: string;
  teamLogo?: string;
  goals: number;
  assists?: number | null;
  appearances?: number | null;
  minutes?: number | null;
  position?: string;
  penaltyScored?: number | null;
};

export type SportsLeagueBundle = {
  leagueId: number;
  leagueName?: string;
  season: number;
  country?: string;
  window?: SeasonWindow;
  standings: SportsStandingRow[];
  nextFixtures: SportsFixture[];
  lastFixtures: SportsFixture[];
  liveFixtures: SportsFixture[];
  topScorers?: SportsTopScorerRow[];
  previousSeason?: number | null;
  previousStandings?: SportsStandingRow[];
  previousLastFixtures?: SportsFixture[];
  previousTopScorers?: SportsTopScorerRow[];
  partial?: boolean;
  fetchedAt: string;
  source: string;
  stale?: boolean;
};

export type SportsHealth = {
  ok: boolean;
  configured: boolean;
  provider?: string;
  store?: string;
  defaultLeagueId?: number;
  trackedLeagueIds?: number[];
};

export type SportsDataProvider = {
  getHealth(): Promise<SportsHealth>;
  getNationalLeagueBundle(opts?: {
    leagueId?: number;
    forceSync?: boolean;
  }): Promise<SportsLeagueBundle | null>;
  syncLeague?(leagueId: number): Promise<SportsLeagueBundle | null>;
  getFixtureDetail?(fixtureId: string): Promise<SportsFixtureDetail | null>;
};

export type SportsMatchEvent = {
  id: string;
  minute: number;
  extraMinute?: number;
  type: string;
  detail?: string;
  teamSide: 'home' | 'away';
  teamName: string;
  playerId?: number;
  playerName?: string;
  assistPlayerId?: number;
  assistName?: string;
};

export type SportsLineupPlayer = {
  id: number;
  name: string;
  number?: number;
  position?: string;
  photo?: string;
  grid?: string;
  rating?: number;
  goals?: number;
  assists?: number;
  substitutedOut?: boolean;
};

export type SportsTeamLineup = {
  teamId: number;
  teamName: string;
  teamLogo?: string;
  formation?: string;
  coach?: string;
  startXI: SportsLineupPlayer[];
  substitutes: SportsLineupPlayer[];
};

export type SportsMatchStat = {
  type: string;
  home: string | number;
  away: string | number;
};

export type SportsFixtureDetail = SportsFixture & {
  leagueId?: number;
  leagueName?: string;
  season?: number;
  venue?: string;
  city?: string;
  referee?: string;
  events: SportsMatchEvent[];
  lineups: { home?: SportsTeamLineup; away?: SportsTeamLineup };
  statistics: SportsMatchStat[];
  fetchedAt: string;
};

/** الدوري السعودي للمحترفين في API-Football */
export const SAUDI_PRO_LEAGUE_ID = 307;

export const TRACKED_LEAGUE_IDS = [
  307, // Saudi Pro League
  39, // Premier League
  140, // La Liga
  135, // Serie A
  78, // Bundesliga
  61, // Ligue 1
] as const;
