# Supabase setup for Seellie

## 1) Run SQL
1. Open Supabase Dashboard → **SQL Editor**
2. Paste and run: `supabase/schema.sql` (full)  
   **Or** if tables already exist, run only: `supabase/messages.sql`
3. Confirm tables: `profiles`, `share_cards`, `messages`
4. Confirm storage bucket: `share-media` (public)

## 2) Auth settings
Authentication → Providers → Email: enable Email  
**Required for testing:** turn OFF **Confirm email**.  
(Currently should show autoconfirm enabled — signup works without email.)

### Password reset (نسيت كلمة المرور)
Authentication → **URL Configuration**:
1. **Site URL** → ضع: `seellie://reset-password`  
   (لا تترك `http://localhost:3000` — يفتح المتصفح ويرفض الاتصال)
2. **Redirect URLs** أضف:
   - `seellie://reset-password`
   - `seellie://**`
   - إن استخدمت Expo Go: `exp://192.168.*:8081/--/reset-password` أو `exp://**`

ثم أعد إرسال رابط الاستعادة من التطبيق وافتح الرسالة **من الجوال** (مع فتح Expo/التطبيق)، وليس من متصفح الكمبيوتر.

## 3) App env (already in `.env`)
EXPO_PUBLIC_SUPABASE_URL=https://sjfkdipgvivomllpfnkt.supabase.co  
EXPO_PUBLIC_SUPABASE_ANON_KEY=<publishable key>

## 4) Restart Expo
npx expo start -c

## How it works
- App signup/login uses Supabase when configured — **no silent local account** if cloud signup fails
- Demo seed accounts still work for local login only when cloud auth fails with invalid credentials
- **إدارة المستخدمين** تسحب من `public.profiles` (زر «مزامنة من السحابة»). إن وُجد المستخدم في Auth فقط نفّذ `supabase/sync-profiles-from-auth.sql`
- **طلبات + مسابقات سحابية:** نفّذ مرة واحدة `supabase/FIX-CLOUD-SYNC.sql` ثم استخدم حسابات Sign up فقط (متابع/مشرف)
- Share cards + **messages** sync between two Supabase users (both must appear in `profiles`)
- Cross-device messages: both phones must use Supabase accounts (UUID), not the local demo superadmin
