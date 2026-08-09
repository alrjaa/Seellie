# Supabase setup for Seellie

## 1) Run SQL (once)
1. Open Supabase Dashboard → **SQL Editor**
2. Paste and run in order:
   - `supabase/schema.sql` (or existing base tables)
   - `supabase/FIX-CLOUD-SYNC.sql` (competitions + requests)
   - `supabase/messages.sql` (if messages table missing)
   - `supabase/forum-comments.sql`
   - `supabase/private-space.sql`
   - `supabase/private-space-dm-sync.sql`
   - `supabase/private-space-friends-fix.sql`
   - **`supabase/CONTENT-CLOUD.sql`** ← user posts/media/analysis + storage
3. Confirm tables: `profiles` (with `content` jsonb), `share_cards`, `messages`, `app_competitions`, `forum_comments`, private_*
4. Confirm storage bucket: `share-media` (public)

## Content sync rule
Any **add content** action with a cloud Sign-up session must:
1. Upload local `file://` media to Storage
2. Write to Supabase (profiles.content / app_competitions / forum_comments / …)
3. Show a clear error toast on failure — never silent local-only “success” for multi-device features

### Acceptance (two devices, cloud accounts)
- Organizer uploads competition/match media → follower sees it (General / Highlights if match-linked)
- User adds photo/post/analysis → other device sees it after refresh
- Forum text + video → other device sees HTTPS video URL
- Private friend + DM → both sides

## 2) Auth settings
Authentication → Providers → Email: enable Email  
**Required for testing:** turn OFF **Confirm email**.

### Password reset
Authentication → **URL Configuration**:
1. **Site URL** → `https://seellie.com`
2. **Redirect URLs**:
   - `https://seellie.com/**`
   - `https://seellie.com/reset-password`
   - `seellie://reset-password`
   - `seellie://**`

## 3) App env (already in `.env`)
EXPO_PUBLIC_SUPABASE_URL=https://sjfkdipgvivomllpfnkt.supabase.co  
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>

## 4) Restart Expo
npx expo start -c

## How it works
- App signup/login uses Supabase when configured — **no silent local account** if cloud signup fails
- Demo seed accounts still work for local login only when cloud auth fails with invalid credentials
- **إدارة المستخدمين** تسحب من `public.profiles`. إن وُجد المستخدم في Auth فقط نفّذ `supabase/sync-profiles-from-auth.sql`
- **طلبات + مسابقات سحابية:** نفّذ `supabase/FIX-CLOUD-SYNC.sql` ثم حسابات Sign up فقط
- Cross-device: both phones must use Supabase UUID accounts, not local demo users
