-- F16 — Superadmin can block/delete advertiser ads and notify the advertiser inbox.
-- Depends on F15 (advertiser_accounts, advertisements, is_app_superadmin).
-- Idempotent. Run in Supabase SQL Editor after F15.

-- ─── Status: blocked (hidden from feed) / deleted (soft delete) ────────────

alter table public.advertisements drop constraint if exists advertisements_status_check;
alter table public.advertisements add constraint advertisements_status_check
  check (status in (
    'draft',
    'pending_review',
    'active',
    'paused',
    'blocked',
    'deleted'
  ));

-- ─── Advertiser inbox ──────────────────────────────────────────────────────

create table if not exists public.advertiser_notifications (
  id uuid primary key default gen_random_uuid(),
  advertiser_id uuid not null references public.advertiser_accounts (id) on delete cascade,
  advertisement_id uuid references public.advertisements (id) on delete set null,
  kind text not null check (kind in ('blocked', 'deleted')),
  ad_title text check (ad_title is null or char_length(ad_title) <= 80),
  note text check (note is null or char_length(note) <= 240),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists advertiser_notifications_inbox_idx
  on public.advertiser_notifications (advertiser_id, created_at desc);

alter table public.advertiser_notifications enable row level security;

drop policy if exists advertiser_notifications_select_own on public.advertiser_notifications;
create policy advertiser_notifications_select_own
  on public.advertiser_notifications for select to authenticated
  using (
    public.is_app_superadmin()
    or advertiser_id in (
      select id from public.advertiser_accounts where owner_user_id = auth.uid()
    )
  );

-- Writes via security definer RPCs only.

-- ─── Advertiser cannot self-unmoderate ─────────────────────────────────────

create or replace function public.advertisements_guard_moderated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.status in ('blocked', 'deleted')
     and not public.is_app_superadmin() then
    raise exception 'ad moderated';
  end if;
  return new;
end;
$$;

drop trigger if exists advertisements_guard_moderated on public.advertisements;
create trigger advertisements_guard_moderated
  before update on public.advertisements
  for each row
  execute procedure public.advertisements_guard_moderated();

-- ─── Superadmin list (pending + live + moderated) ──────────────────────────

create or replace function public.list_admin_advertisements()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_superadmin() then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(a.*) order by a.updated_at desc)
    from (
      select *
      from public.advertisements
      where status <> 'deleted'
      order by updated_at desc
      limit 80
    ) a
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_admin_advertisements() from public;
grant execute on function public.list_admin_advertisements() to authenticated;

-- ─── Superadmin block / delete + notify ────────────────────────────────────

create or replace function public.admin_moderate_advertisement(
  p_ad_id uuid,
  p_action text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  act text;
  st text;
  aid uuid;
  title text;
  note text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform public.assert_account_active();
  if not public.is_app_superadmin() then
    raise exception 'forbidden';
  end if;
  if p_ad_id is null then
    raise exception 'ad id required';
  end if;

  act := left(trim(coalesce(p_action, '')), 16);
  if act not in ('block', 'delete') then
    raise exception 'invalid action';
  end if;
  st := case when act = 'block' then 'blocked' else 'deleted' end;
  note := nullif(left(trim(coalesce(p_note, '')), 240), '');

  select advertiser_id, left(coalesce(nullif(title, ''), advertiser_name), 80)
    into aid, title
  from public.advertisements
  where id = p_ad_id;

  if aid is null then
    raise exception 'ad not found';
  end if;

  update public.advertisements set
    status = st,
    updated_at = now()
  where id = p_ad_id;

  insert into public.advertiser_notifications (
    advertiser_id, advertisement_id, kind, ad_title, note
  ) values (
    aid, p_ad_id, st, title, note
  );

  return (select to_jsonb(a.*) from public.advertisements a where a.id = p_ad_id);
end;
$$;

revoke all on function public.admin_moderate_advertisement(uuid, text, text) from public;
grant execute on function public.admin_moderate_advertisement(uuid, text, text) to authenticated;

-- ─── Advertiser inbox RPCs ─────────────────────────────────────────────────

create or replace function public.list_my_advertiser_notifications()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  aid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform public.assert_account_active();
  aid := public.advertiser_id_for_user(uid);
  if aid is null then
    return '[]'::jsonb;
  end if;
  return coalesce((
    select jsonb_agg(to_jsonb(n.*) order by n.created_at desc)
    from (
      select *
      from public.advertiser_notifications
      where advertiser_id = aid
      order by created_at desc
      limit 50
    ) n
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_my_advertiser_notifications() from public;
grant execute on function public.list_my_advertiser_notifications() to authenticated;

create or replace function public.mark_advertiser_notification_read(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  aid uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform public.assert_account_active();
  aid := public.advertiser_id_for_user(uid);
  if aid is null or p_id is null then
    raise exception 'not found';
  end if;

  update public.advertiser_notifications set
    read_at = coalesce(read_at, now())
  where id = p_id and advertiser_id = aid;

  if not found then
    raise exception 'not found';
  end if;

  return (
    select to_jsonb(n.*)
    from public.advertiser_notifications n
    where n.id = p_id and n.advertiser_id = aid
  );
end;
$$;

revoke all on function public.mark_advertiser_notification_read(uuid) from public;
grant execute on function public.mark_advertiser_notification_read(uuid) to authenticated;
