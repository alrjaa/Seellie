# Sports API — مخزن تشغيلي لآخر موسمين فقط

## أين تضع API Key؟

Supabase → Edge Functions → Secrets:

| Name | Value |
|------|--------|
| `API_FOOTBALL_KEY` | مفتاح API-Football |

أو:

```bash
supabase secrets set API_FOOTBALL_KEY=YOUR_KEY_HERE
supabase functions deploy sports-proxy
```

**ممنوع** وضع المفتاح في Expo / Frontend / Git.

## جداول Supabase التشغيلية

نفّذ مرة واحدة في SQL Editor:

`supabase/sports-data.sql`

الجداول:

- `sports_leagues`
- `sports_season_windows` — `current_season` + `previous_season` فقط
- `sports_season_payloads` — ترتيب/مباريات لكل موسم مسموح

عند ظهور موسم جديد متاح فعلياً:

1. يُدخل الموسم الجديد كـ current
2. يصبح current السابق = previous
3. يُحذف الموسم الأقدم عبر `sports_purge_season` فقط
4. فشل API المؤقت **لا يحذف** شيئاً

## الدوريات المدعومة

307 Saudi · 39 EPL · 140 La Liga · 135 Serie A · 78 Bundesliga · 61 Ligue 1

```bash
# مزامنة دوري
curl -X POST "$SUPABASE_URL/functions/v1/sports-proxy" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resource":"sync_league","leagueId":307}'

# مزامنة الكل
curl -X POST "$SUPABASE_URL/functions/v1/sports-proxy" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"resource":"sync_all"}'
```
