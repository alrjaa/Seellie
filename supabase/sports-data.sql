-- =============================================================================
-- Sports operational store — آخر موسمين فقط لكل دوري (بدون أرشيف)
-- شغّل في Supabase SQL Editor مرة واحدة.
-- لا يمس users / profiles / messages / media / competitions الخاصة بالتطبيق.
-- =============================================================================

create table if not exists public.sports_leagues (
  league_id integer primary key,
  slug text not null unique,
  name text not null,
  country text,
  updated_at timestamptz not null default now()
);

create table if not exists public.sports_season_windows (
  league_id integer primary key
    references public.sports_leagues (league_id) on delete cascade,
  current_season integer not null,
  previous_season integer,
  updated_at timestamptz not null default now(),
  constraint sports_season_windows_distinct check (
    previous_season is null or previous_season <> current_season
  )
);

-- حمولات تشغيلية قصيرة: ترتيب / مباريات / ميتا لكل (دوري، موسم، نوع)
create table if not exists public.sports_season_payloads (
  league_id integer not null
    references public.sports_leagues (league_id) on delete cascade,
  season integer not null,
  kind text not null check (
    kind in (
      'standings',
      'fixtures_next',
      'fixtures_last',
      'fixtures_live',
      'meta'
    )
  ),
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (league_id, season, kind)
);

create index if not exists sports_season_payloads_league_season_idx
  on public.sports_season_payloads (league_id, season);

-- دوريات مدعومة افتراضياً (API-Football IDs)
insert into public.sports_leagues (league_id, slug, name, country)
values
  (307, 'saudi-pro-league', 'Saudi Pro League', 'Saudi Arabia'),
  (39, 'premier-league', 'Premier League', 'England'),
  (140, 'la-liga', 'La Liga', 'Spain'),
  (135, 'serie-a', 'Serie A', 'Italy'),
  (78, 'bundesliga', 'Bundesliga', 'Germany'),
  (61, 'ligue-1', 'Ligue 1', 'France')
on conflict (league_id) do update
set
  slug = excluded.slug,
  name = excluded.name,
  country = excluded.country,
  updated_at = now();

alter table public.sports_leagues enable row level security;
alter table public.sports_season_windows enable row level security;
alter table public.sports_season_payloads enable row level security;

-- قراءة عامة للتطبيق — الكتابة عبر service role في Edge Function فقط
drop policy if exists sports_leagues_select_public on public.sports_leagues;
create policy sports_leagues_select_public
  on public.sports_leagues for select
  to anon, authenticated
  using (true);

drop policy if exists sports_windows_select_public on public.sports_season_windows;
create policy sports_windows_select_public
  on public.sports_season_windows for select
  to anon, authenticated
  using (true);

drop policy if exists sports_payloads_select_public on public.sports_season_payloads;
create policy sports_payloads_select_public
  on public.sports_season_payloads for select
  to anon, authenticated
  using (true);

-- حذف موسم كامل بأمان (يستدعى من Edge بمفتاح الخدمة)
create or replace function public.sports_purge_season(
  p_league_id integer,
  p_season integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.sports_season_payloads
  where league_id = p_league_id
    and season = p_season;
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.sports_purge_season(integer, integer) from public;
grant execute on function public.sports_purge_season(integer, integer) to service_role;

comment on table public.sports_season_payloads is
  'Operational football payloads — keep only current + previous season per league.';
comment on function public.sports_purge_season(integer, integer) is
  'Deletes one league-season sports payloads only; never touches user/app tables.';
