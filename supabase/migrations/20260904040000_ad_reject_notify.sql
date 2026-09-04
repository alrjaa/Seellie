-- Notify advertiser when a pending ad is rejected (or approved).
-- Idempotent. Run in Supabase SQL Editor after F16.

alter table public.advertiser_notifications
  drop constraint if exists advertiser_notifications_kind_check;

alter table public.advertiser_notifications
  add constraint advertiser_notifications_kind_check
  check (kind in ('blocked', 'deleted', 'rejected', 'approved'));

drop function if exists public.admin_set_advertisement_status(uuid, text);
drop function if exists public.admin_set_advertisement_status(uuid, text, text);

create or replace function public.admin_set_advertisement_status(
  p_ad_id uuid,
  p_status text,
  p_note text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  st text;
  camp uuid;
  aid uuid;
  prev_st text;
  title text;
  note text;
begin
  if not public.is_app_superadmin() then
    raise exception 'forbidden';
  end if;
  if p_ad_id is null then
    raise exception 'ad id required';
  end if;

  st := left(trim(coalesce(p_status, '')), 16);
  if st not in ('draft', 'pending_review', 'active', 'paused') then
    raise exception 'invalid status';
  end if;

  note := nullif(left(trim(coalesce(p_note, '')), 240), '');

  select a.status, a.advertiser_id, coalesce(nullif(trim(a.title), ''), a.advertiser_name)
  into prev_st, aid, title
  from public.advertisements a
  where a.id = p_ad_id;

  if not found then
    raise exception 'ad not found';
  end if;

  update public.advertisements set
    status = st,
    updated_at = now()
  where id = p_ad_id
  returning campaign_id into camp;

  if st = 'active' and camp is not null then
    update public.ad_campaigns set
      status = 'active',
      updated_at = now()
    where id = camp and status in ('draft', 'paused');
  end if;

  if prev_st = 'pending_review' and st = 'draft' and aid is not null then
    insert into public.advertiser_notifications (
      advertiser_id, advertisement_id, kind, ad_title, note
    ) values (
      aid,
      p_ad_id,
      'rejected',
      left(coalesce(title, ''), 80),
      coalesce(
        note,
        'تم رفض الإعلان وإعادته إلى المسودة. راجع المحتوى ثم أعد الإرسال للمراجعة.'
      )
    );
  elsif prev_st = 'pending_review' and st = 'active' and aid is not null then
    insert into public.advertiser_notifications (
      advertiser_id, advertisement_id, kind, ad_title, note
    ) values (
      aid,
      p_ad_id,
      'approved',
      left(coalesce(title, ''), 80),
      note
    );
  end if;

  return (select to_jsonb(a.*) from public.advertisements a where a.id = p_ad_id);
end;
$$;

revoke all on function public.admin_set_advertisement_status(uuid, text, text) from public;
grant execute on function public.admin_set_advertisement_status(uuid, text, text) to authenticated;

-- Legacy 2-arg overload so older clients / PostgREST calls without p_note still work.
create or replace function public.admin_set_advertisement_status(
  p_ad_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.admin_set_advertisement_status(p_ad_id, p_status, '');
end;
$$;

revoke all on function public.admin_set_advertisement_status(uuid, text) from public;
grant execute on function public.admin_set_advertisement_status(uuid, text) to authenticated;
