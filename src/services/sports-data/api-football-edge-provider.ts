import {
  getSupabase,
  getSupabasePublicConfig,
  isSupabaseConfigured,
} from '@/services/supabase';
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
  type SportsFixtureDetail,
} from './types';

/** كاش محلي قصير للعرض الفوري فقط — المصدر التشغيلي هو مخزن Edge. */
const BUNDLE_TTL_MS = 90 * 1000;

function bundleHasRows(bundle: SportsLeagueBundle | null | undefined): boolean {
  if (!bundle) return false;
  return !!(
    bundle.standings?.length ||
    bundle.lastFixtures?.length ||
    bundle.nextFixtures?.length ||
    bundle.liveFixtures?.length
  );
}

type InvokeOk<T> = { ok: true; cached?: boolean; stale?: boolean; data: T };
type InvokeErr = { ok: false; error?: string };

function parsePayload<T>(
  payload: unknown
): { data: T | null; stale?: boolean } {
  if (!payload || typeof payload !== 'object') return { data: null };
  const p = payload as InvokeOk<T> | InvokeErr;
  if (!('ok' in p) || !p.ok) return { data: null };
  const ok = p as InvokeOk<T>;
  return { data: (ok.data as T) ?? null, stale: !!ok.stale };
}

/**
 * استدعاء Edge Function مباشرة بـ anon key.
 * أكثر ثباتاً على الويب من functions.invoke عند اختلاف جلسة المستخدم.
 */
async function invokeSportsFetch<T>(
  resource: string,
  extra?: Record<string, unknown>
): Promise<{ data: T | null; stale?: boolean }> {
  const config = getSupabasePublicConfig();
  if (!config) return { data: null };
  try {
    const res = await fetch(`${config.url}/functions/v1/sports-proxy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.anonKey}`,
        apikey: config.anonKey,
      },
      body: JSON.stringify({ resource, ...extra }),
    });
    if (!res.ok) return { data: null };
    const json = await res.json();
    return parsePayload<T>(json);
  } catch {
    return { data: null };
  }
}

async function invokeSportsSdk<T>(
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
    return parsePayload<T>(data);
  } catch {
    return { data: null };
  }
}

const SYNC_RESOURCES = new Set([
  'sync_league',
  'sync_topscorers',
  'sync_all',
]);

/**
 * FIX-08 F08-S05: privileged sync / forceSync must use the user session JWT
 * (anon key alone is rejected by Edge for these resources).
 */
async function invokeSportsAuthed<T>(
  resource: string,
  extra?: Record<string, unknown>
): Promise<{ data: T | null; stale?: boolean }> {
  if (!isSupabaseConfigured()) return { data: null };
  const sb = getSupabase();
  if (!sb) return { data: null };
  try {
    const { data: sessionData } = await sb.auth.getSession();
    if (!sessionData.session?.access_token) return { data: null };
    return invokeSportsSdk<T>(resource, extra);
  } catch {
    return { data: null };
  }
}

async function invokeSports<T>(
  resource: string,
  extra?: Record<string, unknown>
): Promise<{ data: T | null; stale?: boolean }> {
  const forceSync = !!(extra && extra.forceSync);
  if (SYNC_RESOURCES.has(resource) || forceSync) {
    return invokeSportsAuthed<T>(resource, extra);
  }
  // الويب: fetch مباشر أولاً للقراءة العامة (أكثر موثوقية)
  const viaFetch = await invokeSportsFetch<T>(resource, extra);
  if (viaFetch.data) return viaFetch;
  return invokeSportsSdk<T>(resource, extra);
}

function normalizeTopScorers(rows: unknown): SportsLeagueBundle['topScorers'] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((raw, index) => {
      const r = raw as Record<string, unknown>;
      const playerId = Number(r.playerId);
      if (!Number.isFinite(playerId) || playerId <= 0) return null;
      const teamIdRaw = Number(r.teamId);
      return {
        rank: Number(r.rank) || index + 1,
        playerId,
        playerName: String(r.playerName ?? '—'),
        playerPhoto: r.playerPhoto ? String(r.playerPhoto) : undefined,
        teamId:
          Number.isFinite(teamIdRaw) && teamIdRaw > 0 ? teamIdRaw : null,
        teamName: r.teamName ? String(r.teamName) : undefined,
        teamLogo: r.teamLogo ? String(r.teamLogo) : undefined,
        goals: Number(r.goals) || 0,
        assists:
          r.assists == null || r.assists === ''
            ? null
            : Number(r.assists),
        appearances:
          r.appearances == null || r.appearances === ''
            ? null
            : Number(r.appearances),
        minutes:
          r.minutes == null || r.minutes === '' ? null : Number(r.minutes),
        position: r.position ? String(r.position) : undefined,
        penaltyScored:
          r.penaltyScored == null || r.penaltyScored === ''
            ? null
            : Number(r.penaltyScored),
      };
    })
    .filter((row): row is NonNullable<typeof row> => !!row);
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
    topScorers: normalizeTopScorers(data.topScorers),
    previousSeason: data.previousSeason ?? data.window?.previous ?? null,
    previousStandings: Array.isArray(data.previousStandings)
      ? data.previousStandings
      : [],
    previousLastFixtures: Array.isArray(data.previousLastFixtures)
      ? data.previousLastFixtures
      : [],
    previousTopScorers: normalizeTopScorers(data.previousTopScorers),
    partial: data.partial,
    fetchedAt: data.fetchedAt || new Date().toISOString(),
    source: data.source || 'sports-store',
    stale: stale || data.stale,
  };
}

async function enrichTopScorers(
  bundle: SportsLeagueBundle
): Promise<SportsLeagueBundle> {
  const needsCurrent = !(bundle.topScorers && bundle.topScorers.length);
  const needsPrevious =
    !!bundle.window?.previous &&
    !(bundle.previousTopScorers && bundle.previousTopScorers.length);

  if (!needsCurrent && !needsPrevious) return bundle;

  // قراءة من المخزن فقط — المزامنة تتم عبر sync_league / sync_topscorers في الخلفية
  const [cur, prev] = await Promise.all([
    needsCurrent
      ? invokeSports<{ rows?: unknown[] }>('topscorers', {
          leagueId: bundle.leagueId,
        })
      : Promise.resolve({ data: null as { rows?: unknown[] } | null }),
    needsPrevious
      ? invokeSports<{ rows?: unknown[] }>('topscorers', {
          leagueId: bundle.leagueId,
          season: bundle.window!.previous,
        })
      : Promise.resolve({ data: null as { rows?: unknown[] } | null }),
  ]);

  return {
    ...bundle,
    topScorers:
      needsCurrent && cur.data?.rows?.length
        ? normalizeTopScorers(cur.data.rows)
        : bundle.topScorers || [],
    previousTopScorers:
      needsPrevious && prev.data?.rows?.length
        ? normalizeTopScorers(prev.data.rows)
        : bundle.previousTopScorers || [],
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
    const forceSync = !!opts?.forceSync;

    // لا نعيد الكاش المحلي قبل الشبكة: نقرأ المخزن التشغيلي فورًا (F09-P1-01:
    // بدون forceSync لا يوجد upstream). الكاش يبقى للعرض الفوري في الـ hook فقط.
    const { data, stale } = await invokeSports<SportsLeagueBundle>('bundle', {
      leagueId,
      forceSync,
    });

    if (!bundleHasRows(data)) {
      // F09-P1-01: Edge public bundle is read-only. Explicit sync_league uses
      // session JWT only (invokeSportsAuthed) — anonymous never hits upstream.
      const synced = await invokeSports<SportsLeagueBundle>('sync_league', {
        leagueId,
      });
      if (!bundleHasRows(synced.data)) {
        if (data) {
          const partial = await enrichTopScorers(normalizeBundle(data, stale));
          await writeSportsCache(cacheKey, partial, BUNDLE_TTL_MS, {
            leagueId,
            season: partial.season,
          });
          return partial;
        }
        // Offline / store empty: last known local paint
        const cached = await readSportsCache<SportsLeagueBundle>(cacheKey);
        return cached && bundleHasRows(cached) ? cached : null;
      }
      let bundle = await enrichTopScorers(normalizeBundle(synced.data!));
      if (bundle.window) {
        await purgeSportsCacheOutsideWindow(leagueId, bundle.window);
      }
      await writeSportsCache(cacheKey, bundle, BUNDLE_TTL_MS, {
        leagueId,
        season: bundle.season,
      });
      return bundle;
    }

    let bundle = await enrichTopScorers(normalizeBundle(data!, stale));
    if (!bundleHasRows(bundle)) return null;

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
    const bundle = await enrichTopScorers(normalizeBundle(data));
    if (bundle.window) {
      await purgeSportsCacheOutsideWindow(leagueId, bundle.window);
    }
    await writeSportsCache(`bundle:${leagueId}:active`, bundle, BUNDLE_TTL_MS, {
      leagueId,
      season: bundle.season,
    });
    return bundle;
  },

  async getFixtureDetail(fixtureId: string) {
    const id = String(fixtureId || '').trim();
    if (!id) return null;
    const { data } = await invokeSports<SportsFixtureDetail>('fixture_detail', {
      fixtureId: id,
    });
    if (!data) return null;
    return {
      ...data,
      events: Array.isArray(data.events) ? data.events : [],
      statistics: Array.isArray(data.statistics) ? data.statistics : [],
      lineups: data.lineups || {},
      fetchedAt: data.fetchedAt || new Date().toISOString(),
    };
  },
};
