-- F14 — Native in-feed ad events (batched via append_ad_events RPC).
-- Apply manually in Supabase SQL editor after review.
-- Does NOT replace superadmin blob delivery (app_blobs.native_ads).

create table if not exists public.ad_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  ad_id text not null check (char_length(ad_id) <= 80),
  event_type text not null check (
    event_type in (
      'impression',
      'video_start',
      'video_complete',
      'click',
      'skip',
      'hide',
      'report'
    )
  ),
  placement text check (placement is null or char_length(placement) <= 32),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ad_events_ad_id_created_at_idx
  on public.ad_events (ad_id, created_at desc);

create index if not exists ad_events_user_id_created_at_idx
  on public.ad_events (user_id, created_at desc);

alter table public.ad_events enable row level security;

drop policy if exists ad_events_select_superadmin on public.ad_events;
create policy ad_events_select_superadmin
  on public.ad_events
  for select
  to authenticated
  using (public.is_app_superadmin());

-- Inserts go through security definer RPC only (no direct client insert policy).

create or replace function public.append_ad_events(p_events jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row jsonb;
  ev text;
  aid text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' then
    return;
  end if;
  if jsonb_array_length(p_events) > 25 then
    raise exception 'batch too large';
  end if;

  for row in select value from jsonb_array_elements(p_events) as t(value)
  loop
    aid := left(trim(coalesce(row->>'adId', '')), 80);
    ev := left(trim(coalesce(row->>'event', '')), 32);
    if aid = '' then
      continue;
    end if;
    if ev not in (
      'impression',
      'video_start',
      'video_complete',
      'click',
      'skip',
      'hide',
      'report'
    ) then
      continue;
    end if;

    insert into public.ad_events (user_id, ad_id, event_type, placement, meta)
    values (
      uid,
      aid,
      ev,
      nullif(left(trim(coalesce(row->>'placement', '')), 32), ''),
      coalesce(row->'meta', '{}'::jsonb)
    );
  end loop;
end;
$$;

revoke all on function public.append_ad_events(jsonb) from public;
grant execute on function public.append_ad_events(jsonb) to authenticated;
