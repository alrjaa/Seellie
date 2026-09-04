-- Admin: list appreciation receipts from followers (digital certificates).
-- Run manually in Supabase SQL editor if not applied via migration pipeline.
-- Idempotent.

create or replace function public.admin_list_appreciation_receipts(
  p_query text default null,
  p_limit integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rows jsonb;
  q text := nullif(trim(p_query), '');
  lim integer := greatest(1, least(coalesce(p_limit, 100), 200));
  off integer := greatest(0, coalesce(p_offset, 0));
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.is_superadmin_commerce() then
    raise exception 'forbidden';
  end if;

  select coalesce(jsonb_agg(row_to_json(x)), '[]'::jsonb) into rows
  from (
    select
      dc.id,
      dc.certificate_number,
      dc.status,
      dc.issued_at,
      dc.credits_cost,
      dc.reason,
      coalesce(cc.name_ar, cc.name_en, cc.slug) as appreciation_type,
      cc.name_ar as appreciation_type_ar,
      cc.name_en as appreciation_type_en,
      cc.slug as catalog_slug,
      rp.id as recipient_id,
      rp.name as recipient_name,
      rp.email as recipient_email,
      rp.handle as recipient_handle,
      rp.visible_id as recipient_visible_id,
      rp.role as recipient_role,
      sp.id as sender_id,
      sp.name as sender_name,
      sp.handle as sender_handle,
      sp.visible_id as sender_visible_id,
      sp.role as sender_role
    from public.digital_certificates dc
    join public.certificate_catalog cc on cc.id = dc.catalog_id
    join public.profiles rp on rp.id = dc.recipient_id
    join public.profiles sp on sp.id = dc.sender_id
    where dc.status = 'issued'
      and (
        coalesce(sp.role, '') = 'follower'
        or coalesce(sp.active_role, '') = 'follower'
        or (sp.roles is not null and 'follower' = any (sp.roles))
      )
      and (
        q is null
        or coalesce(rp.name, '') ilike '%' || q || '%'
        or coalesce(rp.email, '') ilike '%' || q || '%'
        or coalesce(rp.handle, '') ilike '%' || q || '%'
        or coalesce(rp.visible_id, '') ilike '%' || q || '%'
        or coalesce(cc.name_ar, '') ilike '%' || q || '%'
        or coalesce(cc.name_en, '') ilike '%' || q || '%'
        or coalesce(cc.slug, '') ilike '%' || q || '%'
        or coalesce(sp.name, '') ilike '%' || q || '%'
        or coalesce(sp.handle, '') ilike '%' || q || '%'
      )
    order by dc.issued_at desc
    limit lim
    offset off
  ) x;

  return coalesce(rows, '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_appreciation_receipts(text, integer, integer) from public;
grant execute on function public.admin_list_appreciation_receipts(text, integer, integer) to authenticated;
