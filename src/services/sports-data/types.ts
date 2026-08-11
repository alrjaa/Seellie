/** أنواع موحّدة لطبقة البيانات الرياضية — مستقلة عن مزوّد API-Football */

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
  standings: SportsStandingRow[];
  nextFixtures: SportsFixture[];
  lastFixtures: SportsFixture[];
  liveFixtures: SportsFixture[];
  partial?: boolean;
  fetchedAt: string;
  source: string;
};

export type SportsHealth = {
  ok: boolean;
  configured: boolean;
  provider?: string;
  defaultLeagueId?: number;
  season?: number;
};

export type SportsDataProvider = {
  getHealth(): Promise<SportsHealth>;
  getNationalLeagueBundle(opts?: {
    leagueId?: number;
    season?: number;
  }): Promise<SportsLeagueBundle | null>;
};

/** الدوري السعودي للمحترفين في API-Football */
export const SAUDI_PRO_LEAGUE_ID = 307;
