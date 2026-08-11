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
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    const res = await fetch(`${UPSTREAM}${path}`, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
        Accept: 'application/json',
      },
    });
    if (!res.ok) {
      // لا نسجّل الهيدر ولا المفتاح ولا جسم الخطأ الخام
      return { ok: false };
    }
    const data = await res.json();
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
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
    const [st, nx, ls, lv] = await Promise.all([
      apiFootball(`/standings?league=${leagueId}&season=${season}`, apiKey),
      apiFootball(
        `/fixtures?league=${leagueId}&season=${season}&next=8`,
        apiKey
      ),
      apiFootball(
        `/fixtures?league=${leagueId}&season=${season}&last=8`,
        apiKey
      ),
      apiFootball(`/fixtures?live=${leagueId}`, apiKey),
    ]);

    // يكفي نجاح جزئي — لا نكسر الاستجابة بالكامل
    const standings = st.ok ? mapStandings(st.data) : [];
    const meta = st.ok
      ? leagueMeta(st.data)
      : { leagueId, leagueName: undefined, season, country: undefined };
    const data = {
      ...meta,
      leagueId,
      season,
      standings,
      nextFixtures: nx.ok ? mapFixtures(nx.data) : [],
      lastFixtures: ls.ok ? mapFixtures(ls.data) : [],
      liveFixtures: lv.ok ? mapFixtures(lv.data) : [],
      partial: !(st.ok && nx.ok && ls.ok),
      fetchedAt: new Date().toISOString(),
      source: 'api-football' as const,
    };

    if (!st.ok && !nx.ok && !ls.ok && !lv.ok) {
      return safeError('upstream_unavailable');
    }

    cacheSet(cacheKey, data, ttl);
    return json({ ok: true, cached: false, data });
  }

  return safeError('unknown_resource', 400);
});
