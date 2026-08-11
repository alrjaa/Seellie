import { apiFootballViaEdgeProvider } from './api-football-edge-provider';
import type { SportsDataProvider } from './types';

export type {
  SportsDataProvider,
  SportsFixture,
  SportsHealth,
  SportsLeagueBundle,
  SportsStandingRow,
  SeasonWindow,
} from './types';
export { SAUDI_PRO_LEAGUE_ID, TRACKED_LEAGUE_IDS } from './types';
export {
  isSeasonInWindow,
  pickLatestAvailableSeason,
  rotateToNewSeason,
  seasonProbeList,
} from './season-window';

let activeProvider: SportsDataProvider = apiFootballViaEdgeProvider;

export function getSportsDataProvider(): SportsDataProvider {
  return activeProvider;
}

export function setSportsDataProvider(provider: SportsDataProvider): void {
  activeProvider = provider;
}
