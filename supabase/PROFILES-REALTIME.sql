-- بث فوري لجدول profiles حتى تظهر التحليلات/المنشورات على الحسابات الأخرى فوراً
-- شغّل مرة واحدة في Supabase SQL Editor

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
end $$;
