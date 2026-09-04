-- Enrich admin ad list with owner email + optional search.
-- Run in Supabase SQL Editor after F16. Idempotent.

create or replace function public.list_admin_advertisements(
  p_query text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q text := nullif(lower(trim(coalesce(p_query, ''))), '');
begin
  if not public.is_app_superadmin() then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(a.*) order by a.updated_at desc)
    from (
      select
        ad.*,
        acc.business_name as account_business_name,
        acc.contact_name as account_contact_name,
        coalesce(u.email, p.email) as owner_email
      from public.advertisements ad
      join public.advertiser_accounts acc on acc.id = ad.advertiser_id
      left join auth.users u on u.id = acc.owner_user_id
      left join public.profiles p on p.id = acc.owner_user_id
      where ad.status <> 'deleted'
        and (
          q is null
          or lower(ad.id::text) like '%' || q || '%'
          or lower(coalesce(ad.advertiser_name, '')) like '%' || q || '%'
          or lower(coalesce(ad.advertiser_handle, '')) like '%' || q || '%'
          or lower(coalesce(ad.title, '')) like '%' || q || '%'
          or lower(coalesce(ad.hook_text, '')) like '%' || q || '%'
          or lower(coalesce(ad.body_text, '')) like '%' || q || '%'
          or lower(coalesce(acc.business_name, '')) like '%' || q || '%'
          or lower(coalesce(acc.contact_name, '')) like '%' || q || '%'
          or lower(coalesce(u.email, p.email, '')) like '%' || q || '%'
          or lower(coalesce(ad.campaign_id::text, '')) like '%' || q || '%'
          or lower(coalesce(ad.advertiser_id::text, '')) like '%' || q || '%'
        )
      order by ad.updated_at desc
      limit 150
    ) a
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_admin_advertisements(text) from public;
grant execute on function public.list_admin_advertisements(text) to authenticated;

-- Keep zero-arg overload for older clients (calls enriched list with no filter).
create or replace function public.list_admin_advertisements()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.list_admin_advertisements(null);
end;
$$;

revoke all on function public.list_admin_advertisements() from public;
grant execute on function public.list_admin_advertisements() to authenticated;
