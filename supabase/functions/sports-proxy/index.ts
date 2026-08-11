/**
 * sports-proxy — بوابة آمنة لـ API-Football
 *
 * السر مطلوب في بيئة Supabase فقط:
 *   supabase secrets set API_FOOTBALL_KEY=xxxxxxxx
 *
 * لا يُمرَّر المفتاح إلى العميل أبداً.
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const UPSTREAM = 'https://v3.football.api-sports.io';
/** الدوري السعودي للمحترفين */
const DEFAULT_LEAGUE_ID = 307;

type Resource =
  | 'health'
  | 'standings'
  | 'fixtures_next'
  | 'fixtures_last'
  | 'fixtures_live'
  | 'bundle';

type CacheEntry = { expires: number; body: unknown };

const memoryCache = new Map<string, CacheEntry>();

const TTL_MS: Record<string, number> = {
  standings: 15 * 60 * 1000,
  fixtures_next: 5 * 60 * 1000,
  fixtures_last: 5 * 60 * 1000,
  fixtures_live: 30 * 1000,
  bundle: 2 * 60 * 1000,
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
      ...extraHeaders,
    },
  });
}

/** رسائل عامة فقط — بلا تفاصيل upstream / مفاتيح */
function safeError(code: string, status = 502) {
  return json({ ok: false, error: code }, status);
}

function currentSeason(): number {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  // موسم كرة القدم غالباً يبدأ منتصف السنة
  return m >= 7 ? y : y - 1;
}

function cacheGet(key: string): unknown | null {
  const hit = memoryCache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expires) {
    memoryCache.delete(key);
    return null;
  }
  return hit.body;
}

function cacheSet(key: string, body: unknown, ttl: number) {
  memoryCache.set(key, { body, expires: Date.now() + ttl });
}

async function apiFootball(
  path: string,
  apiKey: string
): Promise<
  | { ok: true; data: any; results: number; errorKeys: string[] }
  | { ok: false; errorKeys: string[] }
> {
  try {
    const res = await fetch(`${UPSTREAM}${path}`, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      return { ok: false, errorKeys: [`http_${res.status}`] };
    }
    const data = await res.json();
    const errors = data?.errors;
    const errorKeys =
      errors && typeof errors === 'object' && !Array.isArray(errors)
        ? Object.keys(errors)
        : Array.isArray(errors) && errors.length
          ? ['list']
          : [];
    const results = Number(data?.results) || 0;
    return { ok: true, data, results, errorKeys };
  } catch {
    return { ok: false, errorKeys: ['network'] };
  }
}

function seasonCandidates(preferred?: number): number[] {
  const base = preferred && preferred > 2000 ? preferred : currentSeason();
  // جرّب الموسم الحالي ثم السابقين — كثير من الدوريات تُرمَّز بسنة البداية
  const list = [base, base - 1, base - 2, base + 1];
  return [...new Set(list.filter((y) => y >= 2018 && y <= 2100))];
}

async function fetchStandingsForSeasons(
  leagueId: number,
  apiKey: string,
  preferred?: number
) {
  for (const season of seasonCandidates(preferred)) {
    const up = await apiFootball(
      `/standings?league=${leagueId}&season=${season}`,
      apiKey
    );
    if (!up.ok) continue;
    const standings = mapStandings(up.data);
    if (standings.length > 0) {
      return {
        season,
        standings,
        meta: leagueMeta(up.data),
        errorKeys: up.errorKeys,
      };
    }
  }
  return null;
}

async function fetchFixturesFlexible(
  leagueId: number,
  season: number,
  apiKey: string
) {
  const queries = [
    `/fixtures?league=${leagueId}&season=${season}&next=15`,
    `/fixtures?league=${leagueId}&season=${season}&last=15`,
    `/fixtures?league=${leagueId}&season=${season}`,
  ];
  let nextFixtures: ReturnType<typeof mapFixtures> = [];
  let lastFixtures: ReturnType<typeof mapFixtures> = [];
  const errorKeys: string[] = [];

  // next
  const nx = await apiFootball(queries[0], apiKey);
  if (nx.ok) {
    nextFixtures = mapFixtures(nx.data);
    errorKeys.push(...nx.errorKeys.map((k) => `next:${k}`));
  }

  // last
  const ls = await apiFootball(queries[1], apiKey);
  if (ls.ok) {
    lastFixtures = mapFixtures(ls.data);
    errorKeys.push(...ls.errorKeys.map((k) => `last:${k}`));
  }

  // إن بقيت فارغة: كل مباريات الموسم ثم تقسيم قادم/منتهية
  if (!nextFixtures.length && !lastFixtures.length) {
    const all = await apiFootball(queries[2], apiKey);
    if (all.ok) {
      errorKeys.push(...all.errorKeys.map((k) => `all:${k}`));
      const list = mapFixtures(all.data);
      const now = Date.now();
      const upcoming = list
        .filter((f) => {
          const t = Date.parse(f.date);
          return Number.isFinite(t) && t >= now;
        })
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
      const finished = list
        .filter((f) => {
          const played =
            f.homeScore != null &&
            f.awayScore != null &&
            String(f.status).toUpperCase() === 'FT';
          const t = Date.parse(f.date);
          return played || (Number.isFinite(t) && t < now);
        })
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
      nextFixtures = upcoming.slice(0, 10);
      lastFixtures = finished.slice(0, 10);
    }
  }

  const live = await apiFootball(`/fixtures?live=${leagueId}`, apiKey);
  const liveFixtures = live.ok ? mapFixtures(live.data) : [];
  if (live.ok) errorKeys.push(...live.errorKeys.map((k) => `live:${k}`));

  return { nextFixtures, lastFixtures, liveFixtures, errorKeys };
}

function mapStandings(raw: any) {
  const table =
    raw?.response?.[0]?.league?.standings?.[0] ||
    raw?.response?.[0]?.league?.standings ||
    [];
  const rows = Array.isArray(table) ? table : [];
  return rows.map((r: any) => ({
    rank: Number(r.rank) || 0,
    teamId: String(r.team?.id ?? ''),
    teamName: String(r.team?.name ?? '—'),
    teamLogo: r.team?.logo ? String(r.team.logo) : undefined,
    played: Number(r.all?.played) || 0,
    won: Number(r.all?.win) || 0,
    drawn: Number(r.all?.draw) || 0,
    lost: Number(r.all?.lose) || 0,
    goalsFor: Number(r.all?.goals?.for) || 0,
    goalsAgainst: Number(r.all?.goals?.against) || 0,
    goalDiff: Number(r.goalsDiff) || 0,
    points: Number(r.points) || 0,
    form: r.form ? String(r.form) : undefined,
  }));
}

function mapFixtures(raw: any) {
  const list = Array.isArray(raw?.response) ? raw.response : [];
  return list.map((f: any) => ({
    id: String(f.fixture?.id ?? ''),
    date: f.fixture?.date ? String(f.fixture.date) : '',
    status: String(f.fixture?.status?.short ?? ''),
    elapsed:
      f.fixture?.status?.elapsed != null
        ? Number(f.fixture.status.elapsed)
        : undefined,
    homeName: String(f.teams?.home?.name ?? '—'),
    awayName: String(f.teams?.away?.name ?? '—'),
    homeLogo: f.teams?.home?.logo ? String(f.teams.home.logo) : undefined,
    awayLogo: f.teams?.away?.logo ? String(f.teams.away.logo) : undefined,
    homeScore:
      f.goals?.home != null && f.goals.home !== ''
        ? Number(f.goals.home)
        : null,
    awayScore:
      f.goals?.away != null && f.goals.away !== ''
        ? Number(f.goals.away)
        : null,
    round: f.league?.round ? String(f.league.round) : undefined,
  }));
}

function leagueMeta(raw: any) {
  const league = raw?.response?.[0]?.league;
  return {
    leagueId: league?.id != null ? Number(league.id) : undefined,
    leagueName: league?.name ? String(league.name) : undefined,
    season: league?.season != null ? Number(league.season) : undefined,
    country: league?.country ? String(league.country) : undefined,
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return safeError('method_not_allowed', 405);
  }

  const apiKey = Deno.env.get('API_FOOTBALL_KEY')?.trim() || '';

  let body: {
    resource?: Resource;
    leagueId?: number;
    season?: number;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const resource = (body.resource || 'health') as Resource;
  const leagueId =
    typeof body.leagueId === 'number' && body.leagueId > 0
      ? body.leagueId
      : DEFAULT_LEAGUE_ID;
  const season =
    typeof body.season === 'number' && body.season > 2000
      ? body.season
      : currentSeason();

  if (resource === 'health') {
    return json({
      ok: true,
      configured: !!apiKey,
      provider: 'api-football',
      defaultLeagueId: DEFAULT_LEAGUE_ID,
      season,
    });
  }

  if (!apiKey) {
    return safeError('provider_not_configured', 503);
  }

  const cacheKey = `${resource}:${leagueId}:${season}`;
  const ttl = TTL_MS[resource] ?? TTL_MS.bundle;
  const cached = cacheGet(cacheKey);
  if (cached != null) {
    return json(
      { ok: true, cached: true, data: cached },
      200,
      { 'Cache-Control': `public, max-age=${Math.floor(ttl / 1000)}` }
    );
  }

  if (resource === 'standings') {
    const up = await apiFootball(
      `/standings?league=${leagueId}&season=${season}`,
      apiKey
    );
    if (!up.ok) return safeError('upstream_unavailable');
    const data = {
      ...leagueMeta(up.data),
      standings: mapStandings(up.data),
      fetchedAt: new Date().toISOString(),
    };
    cacheSet(cacheKey, data, ttl);
    return json({ ok: true, cached: false, data });
  }

  if (resource === 'fixtures_next') {
    const up = await apiFootball(
      `/fixtures?league=${leagueId}&season=${season}&next=10`,
      apiKey
    );
    if (!up.ok) return safeError('upstream_unavailable');
    const data = {
      fixtures: mapFixtures(up.data),
      fetchedAt: new Date().toISOString(),
    };
    cacheSet(cacheKey, data, ttl);
    return json({ ok: true, cached: false, data });
  }

  if (resource === 'fixtures_last') {
    const up = await apiFootball(
      `/fixtures?league=${leagueId}&season=${season}&last=10`,
      apiKey
    );
    if (!up.ok) return safeError('upstream_unavailable');
    const data = {
      fixtures: mapFixtures(up.data),
      fetchedAt: new Date().toISOString(),
    };
    cacheSet(cacheKey, data, ttl);
    return json({ ok: true, cached: false, data });
  }

  if (resource === 'fixtures_live') {
    const up = await apiFootball(`/fixtures?live=${leagueId}`, apiKey);
    if (!up.ok) return safeError('upstream_unavailable');
    const data = {
      fixtures: mapFixtures(up.data),
      fetchedAt: new Date().toISOString(),
    };
    cacheSet(cacheKey, data, ttl);
    return json({ ok: true, cached: false, data });
  }

  if (resource === 'bundle') {
    // اختيار موسم فيه ترتيب فعلي (لا نعرض موسماً فارغاً مثل 2026 قبل توفره)
    const resolved = await fetchStandingsForSeasons(
      leagueId,
      apiKey,
      typeof body.season === 'number' ? body.season : undefined
    );

    if (!resolved) {
      // لا بيانات لهذا الدوري ضمن المواسم المجربة
      const data = {
        leagueId,
        season,
        standings: [],
        nextFixtures: [],
        lastFixtures: [],
        liveFixtures: [],
        partial: true,
        fetchedAt: new Date().toISOString(),
        source: 'api-football' as const,
      };
      return json({ ok: true, cached: false, data });
    }

    const fx = await fetchFixturesFlexible(
      leagueId,
      resolved.season,
      apiKey
    );

    const data = {
      ...resolved.meta,
      leagueId,
      season: resolved.season,
      standings: resolved.standings,
      nextFixtures: fx.nextFixtures,
      lastFixtures: fx.lastFixtures,
      liveFixtures: fx.liveFixtures,
      partial:
        fx.nextFixtures.length === 0 &&
        fx.lastFixtures.length === 0 &&
        fx.liveFixtures.length === 0,
      // مفاتيح أخطاء المزود فقط (مثل plan) — بلا تفاصيل حساسة
      providerHints: [...new Set(fx.errorKeys)].slice(0, 8),
      fetchedAt: new Date().toISOString(),
      source: 'api-football' as const,
    };

    cacheSet(`bundle:${leagueId}:${resolved.season}`, data, ttl);
    return json({ ok: true, cached: false, data });
  }

  return safeError('unknown_resource', 400);
});
