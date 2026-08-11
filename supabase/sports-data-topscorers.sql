-- =============================================================================
-- إضافة kind = topscorers لمخزن المواسم التشغيلي (موسمين فقط)
-- شغّل مرة واحدة في Supabase SQL Editor إن كان sports-data.sql مُنفَّذاً مسبقاً.
-- لا يمس جداول المستخدمين / المحتوى / التطبيق.
-- =============================================================================

alter table public.sports_season_payloads
  drop constraint if exists sports_season_payloads_kind_check;

alter table public.sports_season_payloads
  add constraint sports_season_payloads_kind_check
  check (
    kind in (
      'standings',
      'fixtures_next',
      'fixtures_last',
      'fixtures_live',
      'meta',
      'topscorers'
    )
  );

comment on table public.sports_season_payloads is
  'Operational football payloads (standings/fixtures/topscorers/meta) — current + previous season only.';
