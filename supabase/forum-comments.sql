-- Seellie · Forum comments (الساحات) — run once in SQL Editor
-- Syncs posts across all devices for authenticated users.

create table if not exists public.forum_comments (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  author_name text not null,
  author_avatar text,
  body text not null default '',
  video_url text,
  video_duration_sec double precision,
  likes uuid[] not null default '{}'::uuid[],
  status text not null default 'active'
    check (status in ('active', 'warned', 'suspended', 'blocked')),
  status_reason text,
  created_at timestamptz not null default now()
);

create index if not exists forum_comments_created_idx
  on public.forum_comments (created_at desc);

create index if not exists forum_comments_author_idx
  on public.forum_comments (author_id, created_at desc);

alter table public.forum_comments enable row level security;

-- الجميع المسجّلون يقرأون مساهمات الساحة
drop policy if exists "forum_comments_select_auth" on public.forum_comments;
create policy "forum_comments_select_auth"
  on public.forum_comments for select
  to authenticated
  using (true);

-- الناشر يضيف مساهمته فقط
drop policy if exists "forum_comments_insert_own" on public.forum_comments;
create policy "forum_comments_insert_own"
  on public.forum_comments for insert
  to authenticated
  with check (auth.uid() = author_id);

-- أي مسجّل يحدّث الإعجابات؛ الناشر يحدّث نصه/حالته
drop policy if exists "forum_comments_update_auth" on public.forum_comments;
create policy "forum_comments_update_auth"
  on public.forum_comments for update
  to authenticated
  using (true)
  with check (true);

-- الناشر أو المشرف يمكنه الحذف (المشرف عبر service لاحقاً؛ هنا المالك)
drop policy if exists "forum_comments_delete_own" on public.forum_comments;
create policy "forum_comments_delete_own"
  on public.forum_comments for delete
  to authenticated
  using (auth.uid() = author_id);

do $$
begin
  alter publication supabase_realtime add table public.forum_comments;
exception
  when duplicate_object then null;
end $$;
