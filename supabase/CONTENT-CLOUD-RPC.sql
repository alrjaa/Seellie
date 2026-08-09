-- Social content write for any authenticated user (likes/follows mirrored on profiles.content).
-- Paste in SQL Editor after CONTENT-CLOUD.sql. No fancy comment headers.

create or replace function public.replace_profile_content(
  p_id uuid,
  p_content jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  update public.profiles
  set
    content = coalesce(p_content, '{}'::jsonb),
    updated_at = now()
  where id = p_id;
end;
$$;

grant execute on function public.replace_profile_content(uuid, jsonb) to authenticated;
