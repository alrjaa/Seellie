import { apiFootballViaEdgeProvider } from './api-football-edge-provider';
import type { SportsDataProvider } from './types';

export type {
  SportsDataProvider,
  SportsFixture,
  SportsHealth,
  SportsLeagueBundle,
  SportsStandingRow,
} from './types';
export { SAUDI_PRO_LEAGUE_ID } from './types';

/**
 * نقطة الدخول الوحيدة للتطبيق.
 * لتبديل المزوّد لاحقاً: غيّر التعيين هنا فقط.
 */
let activeProvider: SportsDataProvider = apiFootballViaEdgeProvider;

export function getSportsDataProvider(): SportsDataProvider {
  return activeProvider;
}

/** للاختبارات أو تبديل المزوّد دون إعادة بناء الشاشات */
export function setSportsDataProvider(provider: SportsDataProvider): void {
  activeProvider = provider;
}
