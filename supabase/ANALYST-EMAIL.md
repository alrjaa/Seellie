# إرسال رمز المحلل بالبريد

التطبيق يوصل الرمز عبر:
1. **صفحة الفريد** (يظهر الرمز بعد الموافقة تلقائياً)
2. **الرسائل داخل التطبيق**
3. البريد عبر Edge Function إن فُعّل Resend

## إلزامي لحفظ موافقة المشرف في السحابة

نفّذ مرة واحدة في SQL Editor:

`supabase/SET-PROFILE-ANALYST.sql`

بدونها قد تُحفظ الموافقة محلياً عند المشرف فقط ولا يصل الرمز لحساب المتابع.

## بريد Resend (اختياري)

```bash
supabase secrets set RESEND_API_KEY=re_xxx --project-ref <ref>
supabase secrets set EMAIL_FROM="Seellie <onboarding@resend.dev>" --project-ref <ref>
supabase functions deploy send-email --project-ref <ref>
```
