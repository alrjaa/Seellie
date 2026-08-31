-- Self-service account deletion (see DELETE-OWN-ACCOUNT.sql)

create or replace function public.delete_own_account()
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
  target_role text;
  target_email text;
  deleted_auth int := 0;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if public.is_app_superadmin() then
    raise exception 'cannot_delete_admin';
  end if;

  select p.role
    into target_role
  from public.profiles p
  where p.id = uid;

  if target_role = 'superadmin' then
    raise exception 'cannot_delete_admin';
  end if;

  select coalesce(p.email, u.email)
    into target_email
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = uid;

  delete from public.competition_requests
  where organizer_id = uid::text;

  delete from public.app_competitions
  where organizer_id = uid::text;

  delete from public.app_blobs
  where key in (
    'announcements:' || uid::text,
    'prizes:' || uid::text
  );

  delete from auth.users where id = uid;
  get diagnostics deleted_auth = row_count;

  delete from public.profiles where id = uid;

  return jsonb_build_object(
    'ok', true,
    'id', uid,
    'email', target_email,
    'auth_deleted', deleted_auth > 0
  );
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
