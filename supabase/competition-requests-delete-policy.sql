-- حذف طلبات التنظيم للمنظم (طلباته) وللمشرف
-- وحذف المسابقات للمنظم/المشرف

drop policy if exists "competition_requests_delete_auth" on public.competition_requests;
create policy "competition_requests_delete_auth"
  on public.competition_requests for delete
  to authenticated
  using (
    organizer_id = auth.uid()::text
    or public.is_app_superadmin()
  );

drop policy if exists "app_competitions_delete_auth" on public.app_competitions;
create policy "app_competitions_delete_auth"
  on public.app_competitions for delete
  to authenticated
  using (
    organizer_id = auth.uid()::text
    or public.is_app_superadmin()
  );
