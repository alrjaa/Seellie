-- صلاحية حذف المسابقات للمشرف والمنظم (إن نفّذت FIX-CLOUD-SYNC سابقاً)
drop policy if exists "app_competitions_delete_auth" on public.app_competitions;
create policy "app_competitions_delete_auth"
  on public.app_competitions for delete
  to authenticated
  using (
    organizer_id = auth.uid()::text
    or public.is_app_superadmin()
  );
