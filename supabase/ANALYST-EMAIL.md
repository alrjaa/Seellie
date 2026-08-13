# إرسال رمز المحلل بالبريد

التطبيق يوصل الرمز عبر:
1. **صفحة الفريد** (رمز المالك عبر RPC آمن بعد الموافقة)
2. **الرسائل داخل التطبيق**
3. البريد عبر Edge Function إن فُعّل Resend

الرمز **لا يُخزَّن** في `profiles.content` بعد FIX-01.

## إلزامي (FIX-01)

نفّذ بالترتيب في SQL Editor:

1. `supabase/SET-PROFILE-ANALYST.sql` (إن لم يُنفَّذ سابقاً)
2. **`supabase/FIX-01-ANALYST-SECRETS.sql`** ← يعزل accessCode في جدول سري + تحقق server-side
3. اختياري: `supabase/FIX-01-STORAGE-ORPHAN-NOTES.sql`

بدون (2) سيفشل حفظ موافقة المحلل / تفعيل الرمز من السحابة.

## بريد Resend (اختياري)

```bash
supabase secrets set RESEND_API_KEY=re_xxx --project-ref <ref>
supabase secrets set EMAIL_FROM="Seellie <onboarding@resend.dev>" --project-ref <ref>
supabase functions deploy send-email --project-ref <ref>
```
