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
  previousSeason?: number | null;
  previousStandings?: SportsStandingRow[];
  previousLastFixtures?: SportsFixture[];
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
