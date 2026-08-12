-- لصق في Supabase SQL Editor (مرة واحدة)
-- يحدّث profiles.content.analyst للمالك أو المشرف دون فقدان باقي المحتوى

create or replace function public.set_profile_analyst(
  p_id uuid,
  p_analyst jsonb
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
  perform public.assert_account_active();

  if auth.uid() <> p_id and not public.is_app_superadmin() then
    raise exception 'forbidden';
  end if;

  if not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'profile not found';
  end if;

  update public.profiles
  set
    content = jsonb_set(
      coalesce(content, '{}'::jsonb),
      '{analyst}',
      coalesce(p_analyst, 'null'::jsonb),
      true
    ),
    updated_at = now()
  where id = p_id;
end;
$$;

revoke all on function public.set_profile_analyst(uuid, jsonb) from public;
grant execute on function public.set_profile_analyst(uuid, jsonb) to authenticated;
