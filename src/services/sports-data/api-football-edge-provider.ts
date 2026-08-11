import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import {
  purgeSportsCacheOutsideWindow,
  readSportsCache,
  writeSportsCache,
} from './cache';
import {
  SAUDI_PRO_LEAGUE_ID,
  type SportsDataProvider,
  type SportsHealth,
  type SportsLeagueBundle,
} from './types';

const BUNDLE_TTL_MS = 2 * 60 * 1000;

type InvokeOk<T> = { ok: true; cached?: boolean; stale?: boolean; data: T };
type InvokeErr = { ok: false; error?: string };

async function invokeSports<T>(
  resource: string,
  extra?: Record<string, unknown>
): Promise<{ data: T | null; stale?: boolean }> {
  if (!isSupabaseConfigured()) return { data: null };
  const sb = getSupabase();
  if (!sb) return { data: null };
  try {
    const { data, error } = await sb.functions.invoke('sports-proxy', {
      body: { resource, ...extra },
    });
    if (error) return { data: null };
    const payload = data as InvokeOk<T> | InvokeErr | null;
    if (!payload || typeof payload !== 'object') return { data: null };
    if (!('ok' in payload) || !payload.ok) return { data: null };
    const ok = payload as InvokeOk<T>;
    return { data: ok.data ?? null, stale: !!ok.stale };
  } catch {
    return { data: null };
  }
}

function normalizeBundle(
  data: SportsLeagueBundle,
  stale?: boolean
): SportsLeagueBundle {
  return {
    leagueId: data.leagueId,
    leagueName: data.leagueName,
    season: data.season,
    country: data.country,
    window: data.window,
    standings: Array.isArray(data.standings) ? data.standings : [],
    nextFixtures: Array.isArray(data.nextFixtures) ? data.nextFixtures : [],
    lastFixtures: Array.isArray(data.lastFixtures) ? data.lastFixtures : [],
    liveFixtures: Array.isArray(data.liveFixtures) ? data.liveFixtures : [],
    previousSeason: data.previousSeason ?? data.window?.previous ?? null,
    previousStandings: Array.isArray(data.previousStandings)
      ? data.previousStandings
      : [],
    previousLastFixtures: Array.isArray(data.previousLastFixtures)
      ? data.previousLastFixtures
      : [],
    partial: data.partial,
    fetchedAt: data.fetchedAt || new Date().toISOString(),
    source: data.source || 'sports-store',
    stale: stale || data.stale,
  };
}

export const apiFootballViaEdgeProvider: SportsDataProvider = {
  async getHealth(): Promise<SportsHealth> {
    const { data } = await invokeSports<SportsHealth>('health');
    if (!data) return { ok: false, configured: false };
    return {
      ok: !!data.ok,
      configured: !!data.configured,
      provider: data.provider,
      store: data.store,
      defaultLeagueId: data.defaultLeagueId ?? SAUDI_PRO_LEAGUE_ID,
      trackedLeagueIds: data.trackedLeagueIds,
    };
  },

  async getNationalLeagueBundle(opts) {
    const leagueId = opts?.leagueId ?? SAUDI_PRO_LEAGUE_ID;
    const cacheKey = `bundle:${leagueId}:active`;

    if (!opts?.forceSync) {
      const cached = await readSportsCache<SportsLeagueBundle>(cacheKey);
      if (cached?.standings?.length) return cached;
    }

    const { data, stale } = await invokeSports<SportsLeagueBundle>('bundle', {
      leagueId,
      forceSync: !!opts?.forceSync,
    });
    if (!data) return null;

    const bundle = normalizeBundle(data, stale);
    if (bundle.window) {
      await purgeSportsCacheOutsideWindow(leagueId, bundle.window);
    }
    await writeSportsCache(cacheKey, bundle, BUNDLE_TTL_MS, {
      leagueId,
      season: bundle.season,
    });
    return bundle;
  },

  async syncLeague(leagueId: number) {
    const { data } = await invokeSports<SportsLeagueBundle>('sync_league', {
      leagueId,
    });
    if (!data) return null;
    const bundle = normalizeBundle(data);
    if (bundle.window) {
      await purgeSportsCacheOutsideWindow(leagueId, bundle.window);
    }
    await writeSportsCache(`bundle:${leagueId}:active`, bundle, BUNDLE_TTL_MS, {
      leagueId,
      season: bundle.season,
    });
    return bundle;
  },
};
