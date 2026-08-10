-- Emergency: free an email so Sign up works again
-- 1) Replace YOUR_EMAIL_HERE with the real email
-- 2) Run in Supabase SQL Editor
-- 3) Then register again in the app

delete from auth.users
where lower(email) = lower('YOUR_EMAIL_HERE');

-- Optional check (should return 0 rows):
-- select id, email from auth.users where lower(email) = lower('YOUR_EMAIL_HERE');
-- select id, email, status from public.profiles where lower(email) = lower('YOUR_EMAIL_HERE');
