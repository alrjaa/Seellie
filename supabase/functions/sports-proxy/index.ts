/**
 * sports-proxy — بوابة API-Football + مخزن تشغيلي (آخر موسمين فقط)
 *
 * Secrets:
 *   API_FOOTBALL_KEY
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (تلقائية في Edge)
 */
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import {
  mergeWindowWithDiscovery,
  seasonProbeList,
  type SeasonWindow,
} from './season-window.ts';

const UPSTREAM = 'https://v3.football.api-sports.io';
const DEFAULT_LEAGUE_ID = 307;

const TRACKED_LEAGUES: Array<{
  leagueId: number;
  slug: string;
  name: string;
  country: string;
}> = [
  { leagueId: 307, slug: 'saudi-pro-league', name: 'Saudi Pro League', country: 'Saudi Arabia' },
  { leagueId: 39, slug: 'premier-league', name: 'Premier League', country: 'England' },
  { leagueId: 140, slug: 'la-liga', name: 'La Liga', country: 'Spain' },
  { leagueId: 135, slug: 'serie-a', name: 'Serie A', country: 'Italy' },
  { leagueId: 78, slug: 'bundesliga', name: 'Bundesliga', country: 'Germany' },
  { leagueId: 61, slug: 'ligue-1', name: 'Ligue 1', country: 'France' },
];

type Resource =
  | 'health'
  | 'bundle'
  | 'sync_league'
  | 'sync_all'
  | 'sync_topscorers'
  | 'window'
  | 'topscorers'
  | 'fixture_detail';

type CacheEntry = { expires: number; body: unknown };
const memoryCache = new Map<string, CacheEntry>();

const TTL_MS = {
  bundle: 2 * 60 * 1000,
  live: 30 * 1000,
  fixtureDetail: 45 * 1000,
};

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders,
    },
  });
}

function safeError(code: string, status = 502) {
  return json({ ok: false, error: code }, status);
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

function purgeMemoryCacheForSeason(leagueId: number, season: number) {
  for (const key of [...memoryCache.keys()]) {
    if (key.includes(`:${leagueId}:`) && key.includes(`:${season}:`)) {
      memoryCache.delete(key);
    }
  }
}

function adminClient() {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** FIX-08 F08-S05 — auth helpers (never expose service_role to client) */
const syncRate = new Map<string, { count: number; resetAt: number }>();

function checkSyncRate(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const cur = syncRate.get(key);
  if (!cur || now > cur.resetAt) {
    syncRate.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

function userClientFromRequest(req: Request) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
  const authHeader = req.headers.get('Authorization') || '';
  if (!supabaseUrl || !anon || !authHeader) return null;
  // Reject bare anon key as a "user" — require a real JWT session
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || token === anon) return null;
  return createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  });
}

async function requireAuth(req: Request): Promise<{ id: string } | null> {
  const sb = userClientFromRequest(req);
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id };
}

async function requireSuperadmin(req: Request): Promise<boolean> {
  const sb = userClientFromRequest(req);
  if (!sb) return false;
  const { data: userData, error } = await sb.auth.getUser();
  if (error || !userData.user) return false;
  const { data: isAdmin, error: adminErr } = await sb.rpc('is_app_superadmin');
  return !adminErr && isAdmin === true;
}

async function apiFootball(path: string, apiKey: string) {
  try {
    const res = await fetch(`${UPSTREAM}${path}`, {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return { ok: false as const, errorKeys: [`http_${res.status}`] };
    const data = await res.json();
    const errors = data?.errors;
    let errorKeys: string[] = [];
    if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
      errorKeys = Object.entries(errors as Record<string, unknown>)
        .filter(([, v]) => v != null && String(v).length > 0)
        .map(([k, v]) => `${k}:${String(v).slice(0, 80)}`);
      if (!errorKeys.length) errorKeys = Object.keys(errors);
    }
    return {
      ok: true as const,
      data,
      results: Number(data?.results) || 0,
      errorKeys,
    };
  } catch {
    return { ok: false as const, errorKeys: ['network'] };
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

function playerPhotoUrl(playerId: number, raw?: string) {
  if (raw) return String(raw);
  if (playerId > 0) {
    return `https://media.api-sports.io/football/players/${playerId}.png`;
  }
  return undefined;
}

function mapPlayerMatchStats(playersRaw: any) {
  const map = new Map<
    number,
    { rating?: number; goals?: number; assists?: number }
  >();
  const teams = Array.isArray(playersRaw?.response) ? playersRaw.response : [];
  for (const teamBlock of teams) {
    const players = Array.isArray(teamBlock?.players) ? teamBlock.players : [];
    for (const entry of players) {
      const id = Number(entry?.player?.id);
      if (!id) continue;
      const stats = Array.isArray(entry?.statistics)
        ? entry.statistics[0]
        : null;
      const ratingRaw = stats?.games?.rating;
      const rating =
        ratingRaw != null && ratingRaw !== ''
          ? parseFloat(String(ratingRaw))
          : undefined;
      const goals =
        stats?.goals?.total != null ? Number(stats.goals.total) : undefined;
      const assists =
        stats?.goals?.assists != null
          ? Number(stats.goals.assists)
          : undefined;
      map.set(id, {
        rating: Number.isFinite(rating) ? rating : undefined,
        goals: Number.isFinite(goals) ? goals : undefined,
        assists: Number.isFinite(assists) ? assists : undefined,
      });
    }
  }
  return map;
}

function mapFixtureDetail(
  fxRaw: any,
  eventsRaw: any,
  lineupsRaw: any,
  statsRaw: any,
  playersRaw: any
) {
  const fx = Array.isArray(fxRaw?.response) ? fxRaw.response[0] : null;
  if (!fx) return null;

  const base = mapFixtures({ response: [fx] })[0];
  const homeId = Number(fx.teams?.home?.id);
  const awayId = Number(fx.teams?.away?.id);

  const events = (Array.isArray(eventsRaw?.response) ? eventsRaw.response : [])
    .map((e: any, i: number) => {
      const teamId = Number(e.team?.id);
      const side: 'home' | 'away' =
        teamId === homeId ? 'home' : teamId === awayId ? 'away' : 'home';
      return {
        id: `${e.time?.elapsed ?? 0}-${i}-${e.type ?? ''}`,
        minute: Number(e.time?.elapsed ?? 0),
        extraMinute:
          e.time?.extra != null ? Number(e.time.extra) : undefined,
        type: String(e.type ?? ''),
        detail: e.detail ? String(e.detail) : undefined,
        teamSide: side,
        teamName: String(e.team?.name ?? ''),
        playerId:
          e.player?.id != null ? Number(e.player.id) : undefined,
        playerName: e.player?.name ? String(e.player.name) : undefined,
        assistPlayerId:
          e.assist?.id != null ? Number(e.assist.id) : undefined,
        assistName: e.assist?.name ? String(e.assist.name) : undefined,
      };
    })
    .sort((a: { minute: number }, b: { minute: number }) => a.minute - b.minute);

  const substitutedOut = new Set<number>();
  for (const e of events) {
    if (e.type.toLowerCase() === 'subst' && e.assistPlayerId) {
      substitutedOut.add(e.assistPlayerId);
    }
  }

  const playerStats = mapPlayerMatchStats(playersRaw);

  const mapPlayers = (list: any[]) =>
    (list || []).map((row: any) => {
      const playerId = Number(row.player?.id ?? 0);
      const stats = playerStats.get(playerId);
      return {
        id: playerId,
        name: String(row.player?.name ?? '—'),
        number:
          row.player?.number != null ? Number(row.player.number) : undefined,
        position: row.player?.pos ? String(row.player.pos) : undefined,
        photo: playerPhotoUrl(playerId, row.player?.photo),
        grid: row.player?.grid ? String(row.player.grid) : undefined,
        rating: stats?.rating,
        goals: stats?.goals,
        assists: stats?.assists,
        substitutedOut: substitutedOut.has(playerId),
      };
    });

  const lineupsList = Array.isArray(lineupsRaw?.response)
    ? lineupsRaw.response
    : [];
  const homeLineup = lineupsList.find(
    (l: any) => Number(l.team?.id) === homeId
  );
  const awayLineup = lineupsList.find(
    (l: any) => Number(l.team?.id) === awayId
  );

  const mapTeamLineup = (raw: any) =>
    raw
      ? {
          teamId: Number(raw.team?.id ?? 0),
          teamName: String(raw.team?.name ?? '—'),
          teamLogo: raw.team?.logo ? String(raw.team.logo) : undefined,
          formation: raw.formation ? String(raw.formation) : undefined,
          coach: raw.coach?.name ? String(raw.coach.name) : undefined,
          startXI: mapPlayers(raw.startXI),
          substitutes: mapPlayers(raw.substitutes),
        }
      : undefined;

  const statsList = Array.isArray(statsRaw?.response) ? statsRaw.response : [];
  const homeStats = statsList.find((s: any) => Number(s.team?.id) === homeId);
  const awayStats = statsList.find((s: any) => Number(s.team?.id) === awayId);
  const homeStatRows = Array.isArray(homeStats?.statistics)
    ? homeStats.statistics
    : [];
  const awayStatRows = Array.isArray(awayStats?.statistics)
    ? awayStats.statistics
    : [];
  const statTypes = new Set<string>();
  for (const s of homeStatRows) {
    if (s?.type) statTypes.add(String(s.type));
  }
  for (const s of awayStatRows) {
    if (s?.type) statTypes.add(String(s.type));
  }
  const statistics = [...statTypes].map((type) => {
    const h = homeStatRows.find((s: any) => String(s.type) === type);
    const a = awayStatRows.find((s: any) => String(s.type) === type);
    return {
      type,
      home: h?.value ?? '—',
      away: a?.value ?? '—',
    };
  });

  return {
    ...base,
    leagueId: fx.league?.id != null ? Number(fx.league.id) : undefined,
    leagueName: fx.league?.name ? String(fx.league.name) : undefined,
    season: fx.league?.season != null ? Number(fx.league.season) : undefined,
    venue: fx.fixture?.venue?.name
      ? String(fx.fixture.venue.name)
      : undefined,
    city: fx.fixture?.venue?.city
      ? String(fx.fixture.venue.city)
      : undefined,
    referee: fx.fixture?.referee ? String(fx.fixture.referee) : undefined,
    events,
    lineups: {
      home: mapTeamLineup(homeLineup),
      away: mapTeamLineup(awayLineup),
    },
    statistics,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchFixtureDetail(fixtureId: number, apiKey: string) {
  const [fx, events, lineups, stats, players] = await Promise.all([
    apiFootball(`/fixtures?id=${fixtureId}`, apiKey),
    apiFootball(`/fixtures/events?fixture=${fixtureId}`, apiKey),
    apiFootball(`/fixtures/lineups?fixture=${fixtureId}`, apiKey),
    apiFootball(`/fixtures/statistics?fixture=${fixtureId}`, apiKey),
    apiFootball(`/fixtures/players?fixture=${fixtureId}`, apiKey),
  ]);
  if (!fx.ok) return { ok: false as const };
  const detail = mapFixtureDetail(
    fx.data,
    events.ok ? events.data : { response: [] },
    lineups.ok ? lineups.data : { response: [] },
    stats.ok ? stats.data : { response: [] },
    players.ok ? players.data : { response: [] }
  );
  if (!detail) return { ok: false as const };
  return { ok: true as const, data: detail };
}

function leagueMeta(raw: any, fallbackId: number, season: number) {
  const league = raw?.response?.[0]?.league;
  return {
    leagueId: league?.id != null ? Number(league.id) : fallbackId,
    leagueName: league?.name ? String(league.name) : undefined,
    season: league?.season != null ? Number(league.season) : season,
    country: league?.country ? String(league.country) : undefined,
  };
}

/** يصفّي صفوف الهدافين ويُزيل التكرار حسب playerId (أول ظهور = الأعلى ترتيباً) */
function mapTopScorers(raw: any) {
  const list = Array.isArray(raw?.response) ? raw.response : [];
  const seen = new Set<number>();
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    const player = item?.player;
    const stats = Array.isArray(item?.statistics) ? item.statistics[0] : null;
    const playerId = Number(player?.id);
    if (!Number.isFinite(playerId) || playerId <= 0) continue;
    if (seen.has(playerId)) continue;
    seen.add(playerId);

    const teamId = Number(stats?.team?.id);
    const goals = Number(stats?.goals?.total);
    rows.push({
      rank: rows.length + 1,
      playerId,
      playerName: String(player?.name ?? '—'),
      playerPhoto: player?.photo ? String(player.photo) : undefined,
      teamId: Number.isFinite(teamId) && teamId > 0 ? teamId : null,
      teamName: stats?.team?.name ? String(stats.team.name) : undefined,
      teamLogo: stats?.team?.logo ? String(stats.team.logo) : undefined,
      goals: Number.isFinite(goals) ? goals : 0,
      assists:
        stats?.goals?.assists != null && stats.goals.assists !== ''
          ? Number(stats.goals.assists)
          : null,
      appearances:
        stats?.games?.appearences != null
          ? Number(stats.games.appearences)
          : stats?.games?.appearances != null
            ? Number(stats.games.appearances)
            : null,
      minutes:
        stats?.games?.minutes != null ? Number(stats.games.minutes) : null,
      position: stats?.games?.position
        ? String(stats.games.position)
        : undefined,
      penaltyScored:
        stats?.penalty?.scored != null ? Number(stats.penalty.scored) : null,
    });
  }

  return rows;
}

async function ensureLeagueRow(
  sb: ReturnType<typeof createClient>,
  league: (typeof TRACKED_LEAGUES)[number]
) {
  await sb.from('sports_leagues').upsert(
    {
      league_id: league.leagueId,
      slug: league.slug,
      name: league.name,
      country: league.country,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'league_id' }
  );
}

async function readWindow(
  sb: ReturnType<typeof createClient>,
  leagueId: number
): Promise<SeasonWindow | null> {
  const { data } = await sb
    .from('sports_season_windows')
    .select('current_season, previous_season')
    .eq('league_id', leagueId)
    .maybeSingle();
  if (!data?.current_season) return null;
  return {
    current: Number(data.current_season),
    previous:
      data.previous_season == null ? null : Number(data.previous_season),
  };
}

async function writeWindow(
  sb: ReturnType<typeof createClient>,
  leagueId: number,
  window: SeasonWindow
) {
  await sb.from('sports_season_windows').upsert(
    {
      league_id: leagueId,
      current_season: window.current,
      previous_season: window.previous,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'league_id' }
  );
}

async function upsertPayload(
  sb: ReturnType<typeof createClient>,
  leagueId: number,
  season: number,
  kind: string,
  payload: unknown
) {
  await sb.from('sports_season_payloads').upsert(
    {
      league_id: leagueId,
      season,
      kind,
      payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'league_id,season,kind' }
  );
}

async function readPayload(
  sb: ReturnType<typeof createClient>,
  leagueId: number,
  season: number,
  kind: string
) {
  const { data } = await sb
    .from('sports_season_payloads')
    .select('payload, updated_at')
    .eq('league_id', leagueId)
    .eq('season', season)
    .eq('kind', kind)
    .maybeSingle();
  return data;
}

async function purgeSeason(
  sb: ReturnType<typeof createClient>,
  leagueId: number,
  season: number
) {
  // لا يمس أي جداول مستخدمين/محتوى
  await sb.rpc('sports_purge_season', {
    p_league_id: leagueId,
    p_season: season,
  });
  purgeMemoryCacheForSeason(leagueId, season);
}

async function fetchStandingsSeason(
  apiKey: string,
  leagueId: number,
  season: number
) {
  const up = await apiFootball(
    `/standings?league=${leagueId}&season=${season}`,
    apiKey
  );
  if (!up.ok) {
    return {
      ok: false as const,
      standings: [] as any[],
      meta: null as any,
      errorKeys: up.errorKeys,
    };
  }
  const standings = mapStandings(up.data);
  if (!standings.length) {
    return {
      ok: false as const,
      standings: [],
      meta: leagueMeta(up.data, leagueId, season),
      errorKeys: up.errorKeys.length ? up.errorKeys : ['empty_standings'],
    };
  }
  return {
    ok: true as const,
    standings,
    meta: leagueMeta(up.data, leagueId, season),
    errorKeys: up.errorKeys,
  };
}

/** مواسم الدوري كما يعلنها المزوّد (سنة البداية) */
async function listProviderSeasonYears(
  apiKey: string,
  leagueId: number
): Promise<number[]> {
  const up = await apiFootball(`/leagues?id=${leagueId}`, apiKey);
  if (!up.ok) return [];
  const seasons = up.data?.response?.[0]?.seasons;
  if (!Array.isArray(seasons)) return [];
  return [
    ...new Set(
      seasons
        .map((s: any) => Number(s?.year))
        .filter((y: number) => Number.isFinite(y) && y >= 2018 && y <= 2100)
    ),
  ].sort((a, b) => b - a);
}

/**
 * جلب هدّافي موسم واحد من API-Football.
 * عند فشل الشبكة/المزود يُعاد null (لا يُمسح المخزن).
 * عند نجاح بلا نتائج يُعاد [] (موسم بدون هدّافين بعد).
 */
async function fetchTopScorersSeason(
  apiKey: string,
  leagueId: number,
  season: number
): Promise<{
  rows: Array<Record<string, unknown>> | null;
  providerHints?: string[];
}> {
  const up = await apiFootball(
    `/players/topscorers?league=${leagueId}&season=${season}`,
    apiKey
  );
  if (!up.ok) {
    return { rows: null, providerHints: up.errorKeys };
  }
  const mapped = mapTopScorers(up.data);
  // إن وُجدت صفوف رغم تحذير مزود — احفظها (لا تضيّع بيانات صالحة)
  if (mapped.length) {
    return { rows: mapped, providerHints: up.errorKeys };
  }
  if (up.errorKeys.length) {
    return { rows: null, providerHints: up.errorKeys };
  }
  return { rows: mapped };
}

async function upsertTopScorersIfFetched(
  sb: ReturnType<typeof createClient>,
  apiKey: string,
  leagueId: number,
  season: number
) {
  const fetched = await fetchTopScorersSeason(apiKey, leagueId, season);
  if (fetched.rows == null) {
    return {
      ok: false as const,
      count: 0,
      providerHints: fetched.providerHints || [],
    };
  }
  await upsertPayload(sb, leagueId, season, 'topscorers', {
    rows: fetched.rows,
  });
  return {
    ok: true as const,
    count: fetched.rows.length,
    providerHints: [] as string[],
  };
}

async function fetchFixturesForSeason(
  apiKey: string,
  leagueId: number,
  season: number
) {
  const nx = await apiFootball(
    `/fixtures?league=${leagueId}&season=${season}&next=15`,
    apiKey
  );
  const ls = await apiFootball(
    `/fixtures?league=${leagueId}&season=${season}&last=15`,
    apiKey
  );
  let nextFixtures = nx.ok ? mapFixtures(nx.data) : [];
  let lastFixtures = ls.ok ? mapFixtures(ls.data) : [];

  if (!nextFixtures.length && !lastFixtures.length) {
    const all = await apiFootball(
      `/fixtures?league=${leagueId}&season=${season}`,
      apiKey
    );
    if (all.ok) {
      const list = mapFixtures(all.data);
      const now = Date.now();
      nextFixtures = list
        .filter((f) => {
          const t = Date.parse(f.date);
          return Number.isFinite(t) && t >= now;
        })
        .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
        .slice(0, 12);
      lastFixtures = list
        .filter((f) => {
          const t = Date.parse(f.date);
          const ft = String(f.status).toUpperCase() === 'FT';
          return (
            ft ||
            (f.homeScore != null && f.awayScore != null) ||
            (Number.isFinite(t) && t < now)
          );
        })
        .sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
        .slice(0, 12);
    }
  }

  const live = await apiFootball(`/fixtures?live=${leagueId}`, apiKey);
  const liveFixtures = live.ok ? mapFixtures(live.data) : [];
  return { nextFixtures, lastFixtures, liveFixtures };
}

/**
 * مزامنة دوري واحد:
 * - يجلب فقط مواسم المرشحين القريبين
 * - يحدّث النافذة (حالي+سابق) عند توفر موسم أحدث فعلياً
 * - يحذف الأقدم فقط بعد نجاح الإدخال
 * - عند فشل API لا يحذف شيئاً ويعيد المخزن الحالي إن وجد
 */
async function syncLeague(
  apiKey: string,
  leagueId: number
): Promise<{ ok: boolean; bundle: any | null; rotated?: boolean }> {
  const sb = adminClient();
  const tracked =
    TRACKED_LEAGUES.find((l) => l.leagueId === leagueId) ||
    TRACKED_LEAGUES[0];

  if (sb) await ensureLeagueRow(sb, tracked);

  const existingWindow = sb ? await readWindow(sb, leagueId) : null;

  const withData: number[] = [];
  const standingsBySeason = new Map<
    number,
    { standings: any[]; meta: any }
  >();
  const discoveryLog: Array<Record<string, unknown>> = [];

  // مواسم المزوّد المعلنة + مرشحو التقويم (حتى لا نعلق على نافذة قديمة)
  const providerYears = await listProviderSeasonYears(apiKey, leagueId);
  const probeYears = [
    ...new Set([...seasonProbeList(), ...providerYears]),
  ]
    .filter((y) => y >= 2018 && y <= 2100)
    .sort((a, b) => b - a)
    .slice(0, 8);

  for (const season of probeYears) {
    const hit = await fetchStandingsSeason(apiKey, leagueId, season);
    if (hit.ok) {
      withData.push(season);
      standingsBySeason.set(season, {
        standings: hit.standings,
        meta: hit.meta,
      });
      discoveryLog.push({
        season,
        standings: hit.standings.length,
        source: 'standings',
        errors: hit.errorKeys,
      });
      continue;
    }

    const expectedBase = seasonProbeList()[0] ?? new Date().getUTCFullYear();
    // لا نحرق حصة المباريات إلا للمواسم القريبة من التقويم الحالي
    if (season < expectedBase - 1) {
      discoveryLog.push({
        season,
        standings: 0,
        source: 'skipped_fixtures',
        errors: hit.errorKeys,
      });
      continue;
    }

    // موسم جديد قد يملك مباريات قبل اكتمال جدول الترتيب
    const fx = await fetchFixturesForSeason(apiKey, leagueId, season);
    const fxCount =
      (fx.nextFixtures?.length || 0) +
      (fx.lastFixtures?.length || 0) +
      (fx.liveFixtures?.length || 0);
    if (fxCount > 0) {
      withData.push(season);
      standingsBySeason.set(season, {
        standings: [],
        meta: {
          leagueId,
          leagueName: tracked.name,
          season,
          country: tracked.country,
        },
      });
      discoveryLog.push({
        season,
        standings: 0,
        fixtures: fxCount,
        source: 'fixtures',
        errors: hit.errorKeys,
      });
    } else {
      discoveryLog.push({
        season,
        standings: 0,
        fixtures: 0,
        source: 'empty',
        errors: hit.errorKeys,
      });
    }
  }

  // فشل المزود / لا مواسم: أعد المخزن التشغيلي دون حذف
  if (!withData.length) {
    if (existingWindow && sb) {
      const bundle = await buildBundleFromStore(sb, leagueId, existingWindow);
      if (bundle) (bundle as any).discovery = { probeYears, providerYears, discoveryLog };
      return { ok: !!bundle, bundle };
    }
    return { ok: false, bundle: null };
  }

  const rotation = mergeWindowWithDiscovery(existingWindow, withData);
  const window = rotation.window;
  if (!window.current) {
    return { ok: false, bundle: null };
  }

  if (!sb) {
    // بدون جداول بعد: أعد حزمة مباشرة من API ضمن النافذة فقط
    const cur = standingsBySeason.get(window.current);
    if (!cur) return { ok: false, bundle: null };
    const fx = await fetchFixturesForSeason(apiKey, leagueId, window.current);
    const prevStandings =
      window.previous != null
        ? standingsBySeason.get(window.previous)?.standings || []
        : [];
    let prevFx = {
      nextFixtures: [] as any[],
      lastFixtures: [] as any[],
      liveFixtures: [] as any[],
    };
    if (window.previous != null) {
      prevFx = await fetchFixturesForSeason(apiKey, leagueId, window.previous);
    }
    const bundle = {
      ...cur.meta,
      leagueId,
      season: window.current,
      window,
      standings: cur.standings,
      nextFixtures: fx.nextFixtures,
      lastFixtures: fx.lastFixtures,
      liveFixtures: fx.liveFixtures,
      topScorers: [] as any[],
      previousSeason: window.previous,
      previousStandings: prevStandings,
      previousLastFixtures: prevFx.lastFixtures,
      previousTopScorers: [] as any[],
      partial: fx.nextFixtures.length === 0 && fx.lastFixtures.length === 0,
      fetchedAt: new Date().toISOString(),
      source: 'api-football',
      rotated: rotation.rotated,
    };
    return { ok: true, bundle, rotated: rotation.rotated };
  }

  // اكتب الحالي
  const cur = standingsBySeason.get(window.current);
  if (!cur) {
    // موسم جديد مُكتشف نظرياً لكن بلا بيانات؟ لا تدّور — أبقِ المخزن
    if (existingWindow) {
      const bundle = await buildBundleFromStore(sb, leagueId, existingWindow);
      return { ok: !!bundle, bundle };
    }
    return { ok: false, bundle: null };
  }

  await writeWindow(sb, leagueId, window);
  await upsertPayload(sb, leagueId, window.current, 'standings', {
    rows: cur.standings,
  });
  await upsertPayload(sb, leagueId, window.current, 'meta', cur.meta);
  // هدّافون قبل طلبات المباريات الثقيلة — فشلها لا يُلغي المزامنة
  await upsertTopScorersIfFetched(sb, apiKey, leagueId, window.current);
  if (window.previous != null) {
    await upsertTopScorersIfFetched(sb, apiKey, leagueId, window.previous);
  }

  const fx = await fetchFixturesForSeason(apiKey, leagueId, window.current);
  await upsertPayload(sb, leagueId, window.current, 'fixtures_next', {
    rows: fx.nextFixtures,
  });
  await upsertPayload(sb, leagueId, window.current, 'fixtures_last', {
    rows: fx.lastFixtures,
  });
  await upsertPayload(sb, leagueId, window.current, 'fixtures_live', {
    rows: fx.liveFixtures,
  });

  // اكتب السابق إن وُجدت بياناته
  if (window.previous != null) {
    let prev = standingsBySeason.get(window.previous);
    if (!prev) {
      const fetched = await fetchStandingsSeason(
        apiKey,
        leagueId,
        window.previous
      );
      if (fetched.ok) {
        prev = { standings: fetched.standings, meta: fetched.meta };
      }
    }
    if (prev) {
      const prevFx = await fetchFixturesForSeason(
        apiKey,
        leagueId,
        window.previous
      );
      await upsertPayload(sb, leagueId, window.previous, 'standings', {
        rows: prev.standings,
      });
      await upsertPayload(sb, leagueId, window.previous, 'fixtures_next', {
        rows: prevFx.nextFixtures,
      });
      await upsertPayload(sb, leagueId, window.previous, 'fixtures_last', {
        rows: prevFx.lastFixtures,
      });
      await upsertPayload(sb, leagueId, window.previous, 'meta', prev.meta);
    }
  }

  // بعد نجاح إدخال الموسم الجديد فقط: احذف الأقدم
  if (rotation.rotated && rotation.purgeSeason != null) {
    await purgeSeason(sb, leagueId, rotation.purgeSeason);
  }

  const bundle = await buildBundleFromStore(sb, leagueId, window);
  if (bundle) {
    (bundle as any).discovery = {
      probeYears,
      providerYears: providerYears.slice(0, 12),
      discoveryLog,
      rotated: rotation.rotated,
    };
    // وقت المخزن الحقيقي — لا تختم «الآن» في كل قراءة عامة
    if ((bundle as any).storeUpdatedAt) {
      bundle.fetchedAt = (bundle as any).storeUpdatedAt;
    }
  }
  return { ok: !!bundle, bundle, rotated: rotation.rotated };
}

async function buildBundleFromStore(
  sb: ReturnType<typeof createClient>,
  leagueId: number,
  window: SeasonWindow
) {
  const [st, nx, ls, lv, meta, sc] = await Promise.all([
    readPayload(sb, leagueId, window.current, 'standings'),
    readPayload(sb, leagueId, window.current, 'fixtures_next'),
    readPayload(sb, leagueId, window.current, 'fixtures_last'),
    readPayload(sb, leagueId, window.current, 'fixtures_live'),
    readPayload(sb, leagueId, window.current, 'meta'),
    readPayload(sb, leagueId, window.current, 'topscorers'),
  ]);

  const standingsRaw = (st?.payload as any)?.rows;
  let standings = Array.isArray(standingsRaw) ? standingsRaw : [];
  let displaySeason = window.current;
  const topScorers = Array.isArray((sc?.payload as any)?.rows)
    ? (sc?.payload as any).rows
    : [];

  let previousStandings: any[] = [];
  let previousLastFixtures: any[] = [];
  let previousTopScorers: any[] = [];
  if (window.previous != null) {
    const [pst, pls, psc] = await Promise.all([
      readPayload(sb, leagueId, window.previous, 'standings'),
      readPayload(sb, leagueId, window.previous, 'fixtures_last'),
      readPayload(sb, leagueId, window.previous, 'topscorers'),
    ]);
    previousStandings = (pst?.payload as any)?.rows || [];
    previousLastFixtures = (pls?.payload as any)?.rows || [];
    previousTopScorers = (psc?.payload as any)?.rows || [];
  }

  if (!standings.length && previousStandings.length) {
    standings = previousStandings;
    displaySeason = window.previous!;
  }
  if (!standings.length) return null;

  const metaObj = (meta?.payload as any) || {};
  const storeUpdatedAt =
    st?.updated_at ||
    nx?.updated_at ||
    ls?.updated_at ||
    meta?.updated_at ||
    null;
  return {
    leagueId,
    leagueName: metaObj.leagueName,
    country: metaObj.country,
    season: displaySeason,
    window,
    standings,
    nextFixtures: (nx?.payload as any)?.rows || [],
    lastFixtures: (ls?.payload as any)?.rows || [],
    liveFixtures: (lv?.payload as any)?.rows || [],
    topScorers,
    previousSeason: window.previous,
    previousStandings,
    previousLastFixtures,
    previousTopScorers,
    partial: false,
    fetchedAt: storeUpdatedAt || new Date().toISOString(),
    source: 'sports-store',
    storeUpdatedAt,
  };
}

/** قراءة هدّافين من المخزن فقط (لا استدعاء API) — ضمن نافذة الموسمين */
async function buildTopScorersFromStore(
  sb: ReturnType<typeof createClient>,
  leagueId: number,
  window: SeasonWindow,
  season?: number
) {
  const target =
    season != null && Number.isFinite(season) ? Number(season) : window.current;
  if (target !== window.current && target !== window.previous) {
    return {
      ok: false as const,
      error: 'season_outside_window' as const,
    };
  }

  const row = await readPayload(sb, leagueId, target, 'topscorers');
  const rows = Array.isArray((row?.payload as any)?.rows)
    ? (row?.payload as any).rows
    : [];

  return {
    ok: true as const,
    data: {
      leagueId,
      season: target,
      window,
      rows,
      updatedAt: row?.updated_at ?? null,
      source: 'sports-store' as const,
    },
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') return safeError('method_not_allowed', 405);

  const apiKey = Deno.env.get('API_FOOTBALL_KEY')?.trim() || '';

  let body: {
    resource?: Resource;
    leagueId?: number;
    forceSync?: boolean;
    season?: number;
    fixtureId?: number | string;
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

  // FIX-08 F08-S05: privileged sync requires auth; sync_all requires superadmin
  if (resource === 'sync_all') {
    if (!(await requireSuperadmin(req))) {
      return safeError('forbidden', 403);
    }
    if (!checkSyncRate('sync_all:global', 3, 60_000)) {
      return safeError('rate_limited', 429);
    }
  } else if (resource === 'sync_league' || resource === 'sync_topscorers') {
    const user = await requireAuth(req);
    if (!user) return safeError('unauthorized', 401);
    if (!checkSyncRate(`sync:${user.id}`, 8, 60_000)) {
      return safeError('rate_limited', 429);
    }
  } else if (
    (resource === 'bundle' || resource === 'topscorers') &&
    body.forceSync
  ) {
    const user = await requireAuth(req);
    if (!user) return safeError('unauthorized', 401);
    if (!checkSyncRate(`force:${user.id}`, 6, 60_000)) {
      return safeError('rate_limited', 429);
    }
  }

  if (resource === 'health') {
    return json({
      ok: true,
      configured: !!apiKey,
      provider: 'api-football',
      store: 'two-season-operational',
      defaultLeagueId: DEFAULT_LEAGUE_ID,
      trackedLeagueIds: TRACKED_LEAGUES.map((l) => l.leagueId),
      expectedSeasonBase: (() => {
        const y = new Date().getUTCFullYear();
        const m = new Date().getUTCMonth() + 1;
        return m >= 7 ? y : y - 1;
      })(),
      payloads: [
        'standings',
        'fixtures_next',
        'fixtures_last',
        'fixtures_live',
        'meta',
        'topscorers',
      ],
    });
  }

  if (resource === 'window') {
    const sb = adminClient();
    if (!sb) return safeError('store_unavailable', 503);
    const window = await readWindow(sb, leagueId);
    return json({ ok: true, data: { leagueId, window } });
  }

  if (resource === 'topscorers') {
    const sb = adminClient();
    if (!sb) return safeError('store_unavailable', 503);
    const window = await readWindow(sb, leagueId);
    if (!window?.current) return safeError('window_unavailable', 404);

    // قراءة من المخزن أولاً — لا استدعاء API عند كل طلب
    if (!body.forceSync) {
      const fromStore = await buildTopScorersFromStore(
        sb,
        leagueId,
        window,
        body.season
      );
      if (!fromStore.ok) return safeError(fromStore.error, 400);
      return json({ ok: true, cached: false, data: fromStore.data });
    }

    if (!apiKey) {
      const fromStore = await buildTopScorersFromStore(
        sb,
        leagueId,
        window,
        body.season
      );
      if (fromStore.ok) return json({ ok: true, data: fromStore.data });
      return safeError('provider_not_configured', 503);
    }

    const targetSeason =
      typeof body.season === 'number' && Number.isFinite(body.season)
        ? Number(body.season)
        : window.current;
    if (targetSeason !== window.current && targetSeason !== window.previous) {
      return safeError('season_outside_window', 400);
    }

    const synced = await upsertTopScorersIfFetched(
      sb,
      apiKey,
      leagueId,
      targetSeason
    );
    if (!synced.ok) {
      const stale = await buildTopScorersFromStore(
        sb,
        leagueId,
        window,
        targetSeason
      );
      if (stale.ok && (stale.data.rows.length || stale.data.updatedAt)) {
        return json({ ok: true, stale: true, data: stale.data });
      }
      return json(
        {
          ok: false,
          error: 'upstream_unavailable',
          providerHints: synced.providerHints || [],
          leagueId,
          season: targetSeason,
        },
        502
      );
    }

    const fresh = await buildTopScorersFromStore(
      sb,
      leagueId,
      window,
      targetSeason
    );
    if (!fresh.ok) return safeError(fresh.error, 400);
    return json({ ok: true, data: fresh.data });
  }

  if (resource === 'sync_all') {
    if (!apiKey) return safeError('provider_not_configured', 503);
    const results = [];
    for (const league of TRACKED_LEAGUES) {
      const r = await syncLeague(apiKey, league.leagueId);
      results.push({
        leagueId: league.leagueId,
        ok: r.ok,
        rotated: !!r.rotated,
        season: r.bundle?.season ?? null,
      });
    }
    return json({ ok: true, data: { results } });
  }

  /** مزامنة الهدافين فقط لموسمي النافذة — خفيفة على حصة API */
  if (resource === 'sync_topscorers') {
    if (!apiKey) return safeError('provider_not_configured', 503);
    const sb = adminClient();
    if (!sb) return safeError('store_unavailable', 503);
    const window = await readWindow(sb, leagueId);
    if (!window?.current) return safeError('window_unavailable', 404);

    const current = await upsertTopScorersIfFetched(
      sb,
      apiKey,
      leagueId,
      window.current
    );
    let previous: {
      ok: boolean;
      count: number;
      providerHints: string[];
    } | null = null;
    if (window.previous != null) {
      previous = await upsertTopScorersIfFetched(
        sb,
        apiKey,
        leagueId,
        window.previous
      );
    }

    const curStore = await buildTopScorersFromStore(
      sb,
      leagueId,
      window,
      window.current
    );
    const prevStore =
      window.previous != null
        ? await buildTopScorersFromStore(sb, leagueId, window, window.previous)
        : null;

    return json({
      ok: current.ok || !!previous?.ok,
      data: {
        leagueId,
        window,
        current: {
          ok: current.ok,
          count: current.count,
          providerHints: current.providerHints,
          rows: curStore.ok ? curStore.data.rows : [],
          updatedAt: curStore.ok ? curStore.data.updatedAt : null,
        },
        previous:
          window.previous == null
            ? null
            : {
                season: window.previous,
                ok: !!previous?.ok,
                count: previous?.count ?? 0,
                providerHints: previous?.providerHints ?? [],
                rows: prevStore?.ok ? prevStore.data.rows : [],
                updatedAt: prevStore?.ok ? prevStore.data.updatedAt : null,
              },
      },
    });
  }

  if (resource === 'sync_league') {
    if (!apiKey) return safeError('provider_not_configured', 503);
    const r = await syncLeague(apiKey, leagueId);
    if (!r.ok || !r.bundle) return safeError('sync_failed');
    cacheSet(`bundle:${leagueId}`, r.bundle, TTL_MS.bundle);
    return json({ ok: true, data: r.bundle });
  }

  if (resource === 'bundle') {
    const cacheKey = `bundle:${leagueId}`;

    // F09-P1-01: public/anonymous (and any !forceSync) read is durable/cache ONLY.
    // Never start upstream syncLeague / background refresh from this path.
    // Explicit refresh requires forceSync (already gated by requireAuth above).
    if (!body.forceSync) {
      const cached = cacheGet(cacheKey);
      if (cached) return json({ ok: true, cached: true, data: cached });

      const sb = adminClient();
      if (sb) {
        const window = await readWindow(sb, leagueId);
        if (window) {
          const fromStore = await buildBundleFromStore(sb, leagueId, window);
          if (fromStore) {
            if (
              fromStore.standings?.length ||
              fromStore.lastFixtures?.length ||
              fromStore.nextFixtures?.length
            ) {
              cacheSet(cacheKey, fromStore, TTL_MS.bundle);
            }
            return json({ ok: true, cached: false, data: fromStore });
          }
        }
      }
      // Empty / missing store — do not burn API-Football quota on public reads
      return safeError('store_unavailable', 503);
    }

    // Authenticated forceSync: sync then fall back to stale store on failure
    const sb = adminClient();
    if (!apiKey) {
      if (sb) {
        const window = await readWindow(sb, leagueId);
        if (window) {
          const fromStore = await buildBundleFromStore(sb, leagueId, window);
          if (fromStore) {
            return json({ ok: true, stale: true, data: fromStore });
          }
        }
      }
      return safeError('provider_not_configured', 503);
    }

    const r = await syncLeague(apiKey, leagueId);
    if (!r.ok || !r.bundle) {
      if (sb) {
        const window = await readWindow(sb, leagueId);
        if (window) {
          const fromStore = await buildBundleFromStore(sb, leagueId, window);
          if (fromStore) {
            return json({ ok: true, stale: true, data: fromStore });
          }
        }
      }
      return safeError('upstream_unavailable');
    }

    cacheSet(cacheKey, r.bundle, TTL_MS.bundle);
    return json({ ok: true, cached: false, data: r.bundle });
  }

  if (resource === 'fixture_detail') {
    const fixtureId = Number(body.fixtureId);
    if (!Number.isFinite(fixtureId) || fixtureId <= 0) {
      return safeError('invalid_fixture_id', 400);
    }
    if (!checkSyncRate('fixture_detail:global', 90, 60_000)) {
      return safeError('rate_limited', 429);
    }
    const cacheKey = `fixture:${fixtureId}`;
    const cached = cacheGet(cacheKey);
    if (cached) return json({ ok: true, cached: true, data: cached });

    if (!apiKey) return safeError('provider_not_configured', 503);
    const r = await fetchFixtureDetail(fixtureId, apiKey);
    if (!r.ok || !r.data) return safeError('fixture_not_found', 404);
    cacheSet(cacheKey, r.data, TTL_MS.fixtureDetail);
    return json({ ok: true, cached: false, data: r.data });
  }

  return safeError('unknown_resource', 400);
});
