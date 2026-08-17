-- F15 — Advertiser self-serve platform (ads.seellie.com)
-- Separate from user profiles.role — advertiser_accounts linked to auth.users.

-- ─── Tables ───────────────────────────────────────────────────────────────

create table if not exists public.advertiser_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  business_name text not null check (char_length(business_name) between 1 and 80),
  contact_name text not null check (char_length(contact_name) between 1 and 80),
  country text check (country is null or char_length(country) <= 80),
  region text check (region is null or char_length(region) <= 80),
  city text check (city is null or char_length(city) <= 80),
  status text not null default 'active'
    check (status in ('pending', 'active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_user_id)
);

create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertiser_accounts (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  budget_cents integer check (budget_cents is null or budget_cents >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused', 'ended')),
  start_at timestamptz,
  end_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ad_campaigns_advertiser_idx
  on public.ad_campaigns (advertiser_id, updated_at desc);

create table if not exists public.advertisements (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertiser_accounts (id) on delete cascade,
  campaign_id uuid not null references public.ad_campaigns (id) on delete cascade,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'paused')),
  advertiser_name text not null check (char_length(advertiser_name) between 1 and 80),
  advertiser_handle text check (
    advertiser_handle is null or char_length(advertiser_handle) <= 40
  ),
  title text check (title is null or char_length(title) <= 80),
  body_text text check (body_text is null or char_length(body_text) <= 240),
  hook_text text check (hook_text is null or char_length(hook_text) <= 80),
  video_url text not null check (video_url ~ '^https://'),
  poster_url text check (poster_url is null or poster_url ~ '^https://'),
  cta_label text check (cta_label is null or char_length(cta_label) <= 32),
  cta_url text check (cta_url is null or cta_url ~ '^https://'),
  duration_sec integer not null default 10
    check (duration_sec between 6 and 15),
  placements text[] not null default array['general']::text[],
  insert_every_n integer not null default 4
    check (insert_every_n between 2 and 12),
  start_at timestamptz,
  end_at timestamptz,
  target_country text check (target_country is null or char_length(target_country) <= 80),
  target_region text check (target_region is null or char_length(target_region) <= 80),
  target_city text check (target_city is null or char_length(target_city) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists advertisements_live_idx
  on public.advertisements (status, start_at, end_at);

create index if not exists advertisements_campaign_idx
  on public.advertisements (campaign_id, updated_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────────────

alter table public.advertiser_accounts enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.advertisements enable row level security;

drop policy if exists advertiser_accounts_select_own on public.advertiser_accounts;
create policy advertiser_accounts_select_own
  on public.advertiser_accounts for select to authenticated
  using (owner_user_id = auth.uid() or public.is_app_superadmin());

drop policy if exists ad_campaigns_select_own on public.ad_campaigns;
create policy ad_campaigns_select_own
  on public.ad_campaigns for select to authenticated
  using (
    public.is_app_superadmin()
    or advertiser_id in (
      select id from public.advertiser_accounts where owner_user_id = auth.uid()
    )
  );

drop policy if exists advertisements_select_own on public.advertisements;
create policy advertisements_select_own
  on public.advertisements for select to authenticated
  using (
    public.is_app_superadmin()
    or advertiser_id in (
      select id from public.advertiser_accounts where owner_user_id = auth.uid()
    )
  );

-- Writes via security definer RPCs only.

-- ─── Helpers ──────────────────────────────────────────────────────────────

create or replace function public.advertiser_id_for_user(p_user_id uuid default auth.uid())
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.advertiser_accounts
  where owner_user_id = p_user_id
  limit 1;
$$;

revoke all on function public.advertiser_id_for_user(uuid) from public;
grant execute on function public.advertiser_id_for_user(uuid) to authenticated;

-- ─── ensure_advertiser_account ─────────────────────────────────────────────

create or replace function public.ensure_advertiser_account(p_profile jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  aid uuid;
  biz text;
  contact text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  biz := left(trim(coalesce(p_profile->>'businessName', '')), 80);
  contact := left(trim(coalesce(p_profile->>'contactName', '')), 80);
  if biz = '' or contact = '' then
    raise exception 'business and contact name required';
  end if;

  select id into aid from public.advertiser_accounts where owner_user_id = uid;
  if aid is null then
    insert into public.advertiser_accounts (
      owner_user_id, business_name, contact_name, country, region, city, status
    ) values (
      uid,
      biz,
      contact,
      nullif(left(trim(coalesce(p_profile->>'country', '')), 80), ''),
      nullif(left(trim(coalesce(p_profile->>'region', '')), 80), ''),
      nullif(left(trim(coalesce(p_profile->>'city', '')), 80), ''),
      'active'
    )
    returning id into aid;
  else
    update public.advertiser_accounts set
      business_name = biz,
      contact_name = contact,
      country = nullif(left(trim(coalesce(p_profile->>'country', '')), 80), ''),
      region = nullif(left(trim(coalesce(p_profile->>'region', '')), 80), ''),
      city = nullif(left(trim(coalesce(p_profile->>'city', '')), 80), ''),
      updated_at = now()
    where id = aid;
  end if;

  return (
    select to_jsonb(a.*) from public.advertiser_accounts a where a.id = aid
  );
end;
$$;

revoke all on function public.ensure_advertiser_account(jsonb) from public;
grant execute on function public.ensure_advertiser_account(jsonb) to authenticated;

-- ─── Campaign RPCs ─────────────────────────────────────────────────────────

create or replace function public.save_ad_campaign(p_campaign jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  aid uuid;
  cid uuid;
  nm text;
  st text;
  bud integer;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  aid := public.advertiser_id_for_user(uid);
  if aid is null then raise exception 'advertiser account required'; end if;

  nm := left(trim(coalesce(p_campaign->>'name', '')), 80);
  if nm = '' then raise exception 'campaign name required'; end if;

  st := left(trim(coalesce(p_campaign->>'status', 'draft')), 16);
  if st not in ('draft', 'active', 'paused', 'ended') then st := 'draft'; end if;

  bud := nullif(trim(coalesce(p_campaign->>'budgetCents', '')), '')::integer;
  if bud is not null and bud < 0 then bud := 0; end if;

  cid := nullif(trim(coalesce(p_campaign->>'id', '')), '')::uuid;

  if cid is not null and exists (
    select 1 from public.ad_campaigns c
    where c.id = cid and c.advertiser_id = aid
  ) then
    update public.ad_campaigns set
      name = nm,
      status = st,
      budget_cents = bud,
      start_at = nullif(trim(coalesce(p_campaign->>'startAt', '')), '')::timestamptz,
      end_at = nullif(trim(coalesce(p_campaign->>'endAt', '')), '')::timestamptz,
      updated_at = now()
    where id = cid and advertiser_id = aid;
  else
    insert into public.ad_campaigns (
      advertiser_id, name, status, budget_cents, start_at, end_at
    ) values (
      aid, nm, st, bud,
      nullif(trim(coalesce(p_campaign->>'startAt', '')), '')::timestamptz,
      nullif(trim(coalesce(p_campaign->>'endAt', '')), '')::timestamptz
    )
    returning id into cid;
  end if;

  return (select to_jsonb(c.*) from public.ad_campaigns c where c.id = cid);
end;
$$;

revoke all on function public.save_ad_campaign(jsonb) from public;
grant execute on function public.save_ad_campaign(jsonb) to authenticated;

create or replace function public.list_my_ad_campaigns()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid;
begin
  aid := public.advertiser_id_for_user(auth.uid());
  if aid is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(c.*) order by c.updated_at desc)
    from public.ad_campaigns c where c.advertiser_id = aid
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_my_ad_campaigns() from public;
grant execute on function public.list_my_ad_campaigns() to authenticated;

-- ─── Advertisement RPC ─────────────────────────────────────────────────────

create or replace function public.save_advertisement(p_ad jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  aid uuid;
  cid uuid;
  ad_id uuid;
  camp uuid;
  st text;
  pl text[];
  dur integer;
  vurl text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  aid := public.advertiser_id_for_user(uid);
  if aid is null then raise exception 'advertiser account required'; end if;

  camp := nullif(trim(coalesce(p_ad->>'campaignId', '')), '')::uuid;
  if camp is null or not exists (
    select 1 from public.ad_campaigns where id = camp and advertiser_id = aid
  ) then
    raise exception 'invalid campaign';
  end if;

  vurl := left(trim(coalesce(p_ad->>'videoUrl', '')), 2000);
  if vurl !~ '^https://' then raise exception 'https video required'; end if;

  dur := coalesce(nullif(trim(coalesce(p_ad->>'durationSec', '')), '')::integer, 10);
  dur := greatest(6, least(15, dur));

  st := left(trim(coalesce(p_ad->>'status', 'draft')), 16);
  if st not in ('draft', 'active', 'paused') then st := 'draft'; end if;

  pl := coalesce(
    (
      select array_agg(left(trim(x), 32))
      from jsonb_array_elements_text(
        case when jsonb_typeof(p_ad->'placements') = 'array'
          then p_ad->'placements' else '["general"]'::jsonb end
      ) as t(x)
      where trim(x) in ('general', 'unique', 'highlights')
    ),
    array['general']::text[]
  );
  if array_length(pl, 1) is null then pl := array['general']; end if;

  if left(trim(coalesce(p_ad->>'advertiserName', '')), 80) = '' then
    raise exception 'advertiser name required';
  end if;

  ad_id := nullif(trim(coalesce(p_ad->>'id', '')), '')::uuid;

  if ad_id is not null and exists (
    select 1 from public.advertisements a
    where a.id = ad_id and a.advertiser_id = aid
  ) then
    update public.advertisements set
      campaign_id = camp,
      status = st,
      advertiser_name = left(trim(coalesce(p_ad->>'advertiserName', '')), 80),
      advertiser_handle = nullif(left(trim(coalesce(p_ad->>'advertiserHandle', '')), 40), ''),
      title = nullif(left(trim(coalesce(p_ad->>'title', '')), 80), ''),
      body_text = nullif(left(trim(coalesce(p_ad->>'text', '')), 240), ''),
      hook_text = nullif(left(trim(coalesce(p_ad->>'hookText', '')), 80), ''),
      video_url = vurl,
      poster_url = nullif(left(trim(coalesce(p_ad->>'posterUrl', '')), 2000), ''),
      cta_label = nullif(left(trim(coalesce(p_ad->>'ctaLabel', '')), 32), ''),
      cta_url = nullif(left(trim(coalesce(p_ad->>'ctaUrl', '')), 2000), ''),
      duration_sec = dur,
      placements = pl,
      insert_every_n = greatest(2, least(12,
        coalesce(nullif(trim(coalesce(p_ad->>'insertEveryN', '')), '')::integer, 4))),
      start_at = nullif(trim(coalesce(p_ad->>'startAt', '')), '')::timestamptz,
      end_at = nullif(trim(coalesce(p_ad->>'endAt', '')), '')::timestamptz,
      target_country = nullif(left(trim(coalesce(p_ad->>'targetCountry', '')), 80), ''),
      target_region = nullif(left(trim(coalesce(p_ad->>'targetRegion', '')), 80), ''),
      target_city = nullif(left(trim(coalesce(p_ad->>'targetCity', '')), 80), ''),
      updated_at = now()
    where id = ad_id and advertiser_id = aid;
  else
    insert into public.advertisements (
      advertiser_id, campaign_id, status,
      advertiser_name, advertiser_handle, title, body_text, hook_text,
      video_url, poster_url, cta_label, cta_url,
      duration_sec, placements, insert_every_n,
      start_at, end_at, target_country, target_region, target_city
    ) values (
      aid, camp, st,
      left(trim(coalesce(p_ad->>'advertiserName', '')), 80),
      nullif(left(trim(coalesce(p_ad->>'advertiserHandle', '')), 40), ''),
      nullif(left(trim(coalesce(p_ad->>'title', '')), 80), ''),
      nullif(left(trim(coalesce(p_ad->>'text', '')), 240), ''),
      nullif(left(trim(coalesce(p_ad->>'hookText', '')), 80), ''),
      vurl,
      nullif(left(trim(coalesce(p_ad->>'posterUrl', '')), 2000), ''),
      nullif(left(trim(coalesce(p_ad->>'ctaLabel', '')), 32), ''),
      nullif(left(trim(coalesce(p_ad->>'ctaUrl', '')), 2000), ''),
      dur, pl,
      greatest(2, least(12,
        coalesce(nullif(trim(coalesce(p_ad->>'insertEveryN', '')), '')::integer, 4))),
      nullif(trim(coalesce(p_ad->>'startAt', '')), '')::timestamptz,
      nullif(trim(coalesce(p_ad->>'endAt', '')), '')::timestamptz,
      nullif(left(trim(coalesce(p_ad->>'targetCountry', '')), 80), ''),
      nullif(left(trim(coalesce(p_ad->>'targetRegion', '')), 80), ''),
      nullif(left(trim(coalesce(p_ad->>'targetCity', '')), 80), '')
    )
    returning id into ad_id;
  end if;

  return (select to_jsonb(a.*) from public.advertisements a where a.id = ad_id);
end;
$$;

revoke all on function public.save_advertisement(jsonb) from public;
grant execute on function public.save_advertisement(jsonb) to authenticated;

create or replace function public.list_campaign_advertisements(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid;
begin
  aid := public.advertiser_id_for_user(auth.uid());
  if aid is null then return '[]'::jsonb; end if;
  if not exists (
    select 1 from public.ad_campaigns c
    where c.id = p_campaign_id and c.advertiser_id = aid
  ) then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(a.*) order by a.updated_at desc)
    from public.advertisements a
    where a.campaign_id = p_campaign_id and a.advertiser_id = aid
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_campaign_advertisements(uuid) from public;
grant execute on function public.list_campaign_advertisements(uuid) to authenticated;

-- ─── Public feed delivery (authenticated read — same as app_blobs) ─────────

create or replace function public.get_public_native_ads()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  now_ts timestamptz := now();
begin
  if auth.uid() is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', 'adv-' || a.id::text,
        'status', a.status,
        'advertiserName', a.advertiser_name,
        'advertiserHandle', a.advertiser_handle,
        'title', a.title,
        'text', a.body_text,
        'hookText', a.hook_text,
        'videoUrl', a.video_url,
        'posterUrl', a.poster_url,
        'ctaLabel', a.cta_label,
        'ctaUrl', a.cta_url,
        'durationSec', a.duration_sec,
        'placements', to_jsonb(a.placements),
        'insertEveryN', a.insert_every_n,
        'startAt', a.start_at,
        'endAt', a.end_at,
        'targetCountry', a.target_country,
        'targetRegion', a.target_region,
        'targetCity', a.target_city,
        'createdAt', a.created_at,
        'updatedAt', a.updated_at
      )
      order by a.updated_at desc
    )
    from public.advertisements a
    join public.ad_campaigns c on c.id = a.campaign_id
    join public.advertiser_accounts acc on acc.id = a.advertiser_id
    where a.status = 'active'
      and c.status = 'active'
      and acc.status = 'active'
      and a.video_url ~ '^https://'
      and (a.start_at is null or a.start_at <= now_ts)
      and (a.end_at is null or a.end_at >= now_ts)
      and (c.start_at is null or c.start_at <= now_ts)
      and (c.end_at is null or c.end_at >= now_ts)
    limit 40
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.get_public_native_ads() from public;
grant execute on function public.get_public_native_ads() to authenticated;
