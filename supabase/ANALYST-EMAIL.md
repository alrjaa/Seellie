# إرسال رمز المحلل بالبريد

التطبيق يوصل الرمز دائماً عبر:
1. **صفحة الفريد** (يظهر الرمز بعد الموافقة)
2. **الرسائل داخل التطبيق**

وللبريد الحقيقي انشر دالة Edge + مفتاح Resend:

```bash
supabase secrets set RESEND_API_KEY=re_xxx --project-ref <ref>
# اختياري:
supabase secrets set EMAIL_FROM="Seellie <onboarding@resend.dev>" --project-ref <ref>
supabase functions deploy send-email --project-ref <ref>
```

بدون `RESEND_API_KEY` يبقى التوصيل عبر الرسائل + صفحة الفريد فقط.
