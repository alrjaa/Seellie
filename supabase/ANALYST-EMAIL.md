# إرسال رمز المحلل بالبريد

التطبيق يوصل الرمز عبر:
1. **صفحة الفريد** (رمز المالك عبر RPC آمن بعد الموافقة)
2. **الرسائل داخل التطبيق**
3. البريد عبر Edge Function إن فُعّل Resend

الرمز **لا يُخزَّن** في `profiles.content` بعد FIX-01.

## إلزامي (FIX-01) — يجب تنفيذه في SQL Editor الآن

1. افتح: https://supabase.com/dashboard/project/sjfkdipgvivomllpfnkt/sql/new  
2. الصق محتوى الملف **`supabase/FIX-01-ANALYST-SECRETS.sql`** (نسخة محصّنة)  
3. اضغط **Run**  
4. يجب أن تظهر notice: `leaked_in_content=0`

بدون هذه الخطوة يبقى `set_profile_analyst` القديم يسمح برفع الحالة إلى `active` مع بقاء الرمز في `profiles.content`.

اختياري بعد النجاح: `FIX-01-STORAGE-ORPHAN-NOTES.sql`

## بريد Resend (اختياري)

```bash
supabase secrets set RESEND_API_KEY=re_xxx --project-ref <ref>
supabase secrets set EMAIL_FROM="Seellie <onboarding@resend.dev>" --project-ref <ref>
supabase functions deploy send-email --project-ref <ref>
```
