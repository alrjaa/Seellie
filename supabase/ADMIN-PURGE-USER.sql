-- Admin purge user: paste once in SQL Editor
-- After this, admin Delete removes Auth so the email can sign up again.
-- Requires: public.is_app_superadmin() from FIX-CLOUD-SYNC.sql

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

  if p_id is null then
    raise exception 'missing_id';
  end if;

  if p_id = auth.uid() then
    raise exception 'cannot_delete_self';
  end if;

  select p.role, p.email
    into target_role, target_email
  from public.profiles p
  where p.id = p_id;

  if target_role = 'superadmin' then
    raise exception 'cannot_delete_admin';
  end if;

  if target_email is null then
    select u.email
      into target_email
    from auth.users u
    where u.id = p_id;
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

  delete from public.profiles where id = p_id;

  return jsonb_build_object(
    'ok', true,
    'id', p_id,
    'email', target_email,
    'auth_deleted', deleted_auth > 0
  );
end;
$$;

revoke all on function public.admin_purge_user(uuid) from public;
grant execute on function public.admin_purge_user(uuid) to authenticated;

create or replace function public.admin_purge_user_by_email(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid;
  normalized text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null or not public.is_app_superadmin() then
    raise exception 'forbidden';
  end if;

  if normalized = '' or position('@' in normalized) = 0 then
    return jsonb_build_object('ok', false, 'error', 'invalid_email');
  end if;

  select u.id into uid
  from auth.users u
  where lower(u.email) = normalized
  limit 1;

  if uid is null then
    select p.id into uid
    from public.profiles p
    where lower(p.email) = normalized
    limit 1;
  end if;

  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'not_found', 'email', normalized);
  end if;

  return public.admin_purge_user(uid);
end;
$$;

revoke all on function public.admin_purge_user_by_email(text) from public;
grant execute on function public.admin_purge_user_by_email(text) to authenticated;

-- Optional now: free one stuck email (replace then uncomment and run)
-- select public.admin_purge_user_by_email('user@example.com');
