import { apiFootballViaEdgeProvider } from './api-football-edge-provider';
import type { SportsDataProvider } from './types';

export type {
  SportsDataProvider,
  SportsFixture,
  SportsHealth,
  SportsLeagueBundle,
  SportsStandingRow,
  SportsTopScorerRow,
  SeasonWindow,
} from './types';
export { SAUDI_PRO_LEAGUE_ID, TRACKED_LEAGUE_IDS } from './types';
export { TRACKED_LEAGUES, findTrackedLeague } from './leagues';
export type { TrackedLeague } from './leagues';
export {
  isSeasonInWindow,
  mergeWindowWithDiscovery,
  pickLatestAvailableSeason,
  rotateToNewSeason,
  seasonProbeList,
  expectedSeasonBase,
  windowFromAvailableSeasons,
} from './season-window';

let activeProvider: SportsDataProvider = apiFootballViaEdgeProvider;

export function getSportsDataProvider(): SportsDataProvider {
  return activeProvider;
}
