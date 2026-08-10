-- Seellie · hotfix: account_is_active must not block "warned" organizers
-- Paste once if competition sync fails after PHASE4 with RLS errors.
-- Safe to re-run.

create or replace function public.account_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and coalesce(p.status, 'active') not in ('blocked', 'suspended')
  );
$$;

grant execute on function public.account_is_active() to authenticated;

select 'account_is_active hotfix applied' as status;
