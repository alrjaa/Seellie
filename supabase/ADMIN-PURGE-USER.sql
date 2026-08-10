-- Admin purge user — true delete from Auth so the email can sign up again.
-- Run once in SQL Editor (after FIX-CLOUD-SYNC.sql / is_app_superadmin).
--
-- Why: "Delete" used to only set profiles.status = blocked. Auth.users stayed,
-- so Sign up said "account already exists".
--
-- Emergency (SQL Editor as postgres) — replace the email then run:
--   delete from auth.users where lower(email) = lower('user@example.com');

create or replace function public.admin_purge_user(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_role text;
  target_email text;
  deleted_auth int := 0;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_app_superadmin() then
    raise exception 'forbidden';
  end if;

  if p_id = auth.uid() then
    raise exception 'cannot_delete_self';
  end if;

  select role, email into target_role, target_email
  from public.profiles
  where id = p_id;

  if target_role = 'superadmin' then
    raise exception 'cannot_delete_admin';
  end if;

  delete from public.competition_requests
  where organizer_id = p_id::text;

  delete from public.app_competitions
  where organizer_id = p_id::text;

  delete from public.app_blobs
  where key in (
    'announcements:' || p_id::text,
    'prizes:' || p_id::text
  );

  delete from auth.users where id = p_id;
  get diagnostics deleted_auth = row_count;

  if deleted_auth = 0 then
    delete from public.profiles where id = p_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'id', p_id,
    'email', target_email,
    'auth_deleted', deleted_auth > 0
  );
end;
$$;

grant execute on function public.admin_purge_user(uuid) to authenticated;

create or replace function public.admin_purge_user_by_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid;
begin
  if auth.uid() is null or not public.is_app_superadmin() then
    raise exception 'forbidden';
  end if;

  select id into uid
  from auth.users
  where lower(email) = lower(trim(p_email))
  limit 1;

  if uid is null then
    select id into uid
    from public.profiles
    where lower(email) = lower(trim(p_email))
    limit 1;
  end if;

  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  return public.admin_purge_user(uid);
end;
$$;

grant execute on function public.admin_purge_user_by_email(text) to authenticated;
