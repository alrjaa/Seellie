import { getSupabase, isSupabaseConfigured } from '@/services/supabase';
import { readSportsCache, writeSportsCache } from './cache';
import {
  SAUDI_PRO_LEAGUE_ID,
  type SportsDataProvider,
  type SportsHealth,
  type SportsLeagueBundle,
} from './types';

const BUNDLE_CACHE_KEY = 'sports_national_league_bundle_v1';
const BUNDLE_TTL_MS = 2 * 60 * 1000;

type InvokeOk<T> = { ok: true; cached?: boolean; data: T };
type InvokeErr = { ok: false; error?: string };

async function invokeSports<T>(
  resource: string,
  extra?: { leagueId?: number; season?: number }
): Promise<T | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.functions.invoke('sports-proxy', {
      body: { resource, ...extra },
    });
    if (error) return null;
    const payload = data as InvokeOk<T> | InvokeErr | null;
    if (!payload || typeof payload !== 'object') return null;
    if (!('ok' in payload) || !payload.ok) return null;
    return (payload as InvokeOk<T>).data ?? null;
  } catch {
    // فشل الشبكة/الدالة — التطبيق يستمر بدون بيانات حية
    return null;
  }
}

/**
 * مزوّد عبر Supabase Edge Function (sports-proxy).
 * المفتاح API_FOOTBALL_KEY يبقى على الخادم فقط.
 */
export const apiFootballViaEdgeProvider: SportsDataProvider = {
  async getHealth(): Promise<SportsHealth> {
    const data = await invokeSports<SportsHealth>('health');
    if (!data) {
      return { ok: false, configured: false };
    }
    return {
      ok: !!data.ok,
      configured: !!data.configured,
      provider: data.provider,
      defaultLeagueId: data.defaultLeagueId ?? SAUDI_PRO_LEAGUE_ID,
      season: data.season,
    };
  },

  async getNationalLeagueBundle(opts) {
    const leagueId = opts?.leagueId ?? SAUDI_PRO_LEAGUE_ID;
    const cacheKey = `${BUNDLE_CACHE_KEY}:${leagueId}:${opts?.season ?? 'auto'}`;
    const cached = await readSportsCache<SportsLeagueBundle>(cacheKey);
    if (cached) return cached;

    const data = await invokeSports<SportsLeagueBundle>('bundle', {
      leagueId,
      season: opts?.season,
    });
    if (!data) return null;

    const bundle: SportsLeagueBundle = {
      leagueId: data.leagueId || leagueId,
      leagueName: data.leagueName,
      season: data.season,
      country: data.country,
      standings: Array.isArray(data.standings) ? data.standings : [],
      nextFixtures: Array.isArray(data.nextFixtures) ? data.nextFixtures : [],
      lastFixtures: Array.isArray(data.lastFixtures) ? data.lastFixtures : [],
      liveFixtures: Array.isArray(data.liveFixtures) ? data.liveFixtures : [],
      partial: data.partial,
      fetchedAt: data.fetchedAt || new Date().toISOString(),
      source: data.source || 'api-football',
    };

    await writeSportsCache(cacheKey, bundle, BUNDLE_TTL_MS);
    return bundle;
  },
};
