# Sports API (API-Football) — إعداد آمن

## أين تضع API Key؟

**لا تضعه في تطبيق Expo / أي ملف Frontend / `.env` العام للعميل.**

ضعه كـ Secret في مشروع Supabase:

```bash
# من جهازك بعد تثبيت Supabase CLI وربطه بالمشروع
cd native   # أو مجلد Seellie
supabase login
supabase link --project-ref YOUR_PROJECT_REF

supabase secrets set API_FOOTBALL_KEY=YOUR_KEY_HERE

supabase functions deploy sports-proxy
```

أو من لوحة Supabase:
**Project Settings → Edge Functions → Secrets →** أضف:

| Name | Value |
|------|--------|
| `API_FOOTBALL_KEY` | مفتاح حسابك من API-Football |

## ماذا يفعل التطبيق؟

- يستدعي الدالة `sports-proxy` عبر `supabase.functions.invoke`
- الدالة فقط تتصل بـ `v3.football.api-sports.io` بالمفتاح
- العميل يستلم بيانات مختصرة (ترتيب / مباريات) بلا مفتاح

## التحقق

```bash
# صحة الإعداد (configured: true إن وُجد السر)
curl -X POST "$SUPABASE_URL/functions/v1/sports-proxy" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resource":"health"}'

# حزمة الدوري السعودي (307)
curl -X POST "$SUPABASE_URL/functions/v1/sports-proxy" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resource":"bundle","leagueId":307}'
```

إن فشل الـ API، الرئيسية تبقى تعمل وجداول المنصة كما هي.
