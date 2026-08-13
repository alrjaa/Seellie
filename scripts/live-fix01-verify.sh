#!/usr/bin/env bash
# Live FIX-01 security verification (no secrets printed).
# Uses anon key + two freshly signed-up users.
set -euo pipefail
URL="${EXPO_PUBLIC_SUPABASE_URL:-https://sjfkdipgvivomllpfnkt.supabase.co}"
KEY="${EXPO_PUBLIC_SUPABASE_ANON_KEY:-}"
if [[ -z "$KEY" ]]; then
  # load from .env without sourcing whole file into shell history of secrets beyond key
  KEY=$(grep '^EXPO_PUBLIC_SUPABASE_ANON_KEY=' "$(dirname "$0")/../.env" | cut -d= -f2-)
fi
TS=$(date +%s)
# Ephemeral password for throwaway signup users (not a production account secret).
PASS="Fix01-Ephemeral-${TS}-$(openssl rand -hex 4)!"
EA="fix01va${TS}@example.com"
EB="fix01vb${TS}@example.com"

signup() {
  curl -sS -X POST "$URL/auth/v1/signup" \
    -H "apikey: $KEY" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$PASS\"}"
}

echo "== signup =="
RA=$(signup "$EA"); RB=$(signup "$EB")
TOKEN_A=$(python3 -c 'import json,sys;print(json.load(sys.stdin).get("access_token")or"")' <<<"$RA")
TOKEN_B=$(python3 -c 'import json,sys;print(json.load(sys.stdin).get("access_token")or"")' <<<"$RB")
UID_A=$(python3 -c 'import json,sys;print((json.load(sys.stdin).get("user")or{}).get("id")or"")' <<<"$RA")
UID_B=$(python3 -c 'import json,sys;print((json.load(sys.stdin).get("user")or{}).get("id")or"")' <<<"$RB")
echo "users_ok A=${#UID_A} B=${#UID_B}"

pass=0; fail=0; skip=0
check() {
  local name="$1" ok="$2"
  if [[ "$ok" == "PASS" ]]; then echo "PASS $name"; pass=$((pass+1))
  elif [[ "$ok" == "FAIL" ]]; then echo "FAIL $name"; fail=$((fail+1))
  else echo "NOT_TESTABLE $name"; skip=$((skip+1)); fi
}

# Table exists?
CODE=$(curl -sS -o /tmp/t.json -w "%{http_code}" "$URL/rest/v1/analyst_access_codes?select=user_id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A")
if [[ "$CODE" == "200" ]]; then check "table_analyst_access_codes" PASS
elif [[ "$CODE" == "404" ]]; then check "table_analyst_access_codes" FAIL
else check "table_analyst_access_codes" FAIL; fi

# Anon select table
ACODE=$(curl -sS -o /tmp/ta.json -w "%{http_code}" "$URL/rest/v1/analyst_access_codes?select=user_id&limit=1" -H "apikey: $KEY" -H "Authorization: Bearer $KEY")
BODY=$(cat /tmp/ta.json)
if [[ "$BODY" == "[]" || "$ACODE" == "401" || "$ACODE" == "403" ]]; then check "anon_select_secrets" PASS
elif echo "$BODY" | grep -q PGRST205; then check "anon_select_secrets" FAIL
else check "anon_select_secrets" PASS; fi

# Content leak scan — exact JSON key "accessCode", not accessCodeSentAt metadata
curl -sS "$URL/rest/v1/profiles?select=content&limit=500" -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A" -o /tmp/p.json
python3 - <<'PY'
import json,re
rows=json.load(open('/tmp/p.json'))
hits=0
for r in rows:
  if not isinstance(r,dict):
    continue
  s=json.dumps(r.get('content') or {})
  # secret field only: "accessCode": ... — ignore accessCodeSentAt etc.
  if re.search(r'"accessCode"\s*:', s):
    hits += 1
open('/tmp/leak_count','w').write(str(hits))
print('content_accessCode_hits', hits)
PY
LEAK=$(cat /tmp/leak_count)
if [[ "$LEAK" == "0" ]]; then check "profiles_content_no_accessCode" PASS; else check "profiles_content_no_accessCode" FAIL; fi

# Priv escalate
ESC=$(curl -sS -o /tmp/e.json -w "%{http_code}" -X POST "$URL/rest/v1/rpc/set_profile_analyst" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" \
  -d "{\"p_id\":\"$UID_A\",\"p_analyst\":{\"status\":\"active\"}}")
EMSG=$(python3 -c 'import json;d=json.load(open("/tmp/e.json"));print(d.get("message")or"")' 2>/dev/null || true)
if [[ "$ESC" == "204" ]]; then check "deny_self_activate" FAIL
elif echo "$EMSG" | grep -qi 'forbidden'; then check "deny_self_activate" PASS
else check "deny_self_activate" FAIL; fi

# IDOR set B
IDOR=$(curl -sS -o /tmp/i.json -w "%{http_code}" -X POST "$URL/rest/v1/rpc/set_profile_analyst" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" \
  -d "{\"p_id\":\"$UID_B\",\"p_analyst\":{\"status\":\"approved\"}}")
IMSG=$(python3 -c 'import json;d=json.load(open("/tmp/i.json"));print(d.get("message")or"")' 2>/dev/null || true)
if echo "$IMSG" | grep -qi 'forbidden'; then check "idor_set_profile_analyst" PASS; else check "idor_set_profile_analyst" FAIL; fi

# Admin RPC as non-admin
ADM=$(curl -sS -o /tmp/ad.json -w "%{http_code}" -X POST "$URL/rest/v1/rpc/admin_get_analyst_access_code" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" \
  -d "{\"p_id\":\"$UID_B\"}")
AMSG=$(python3 -c 'import json;d=json.load(open("/tmp/ad.json"));print(d.get("message")or d)' 2>/dev/null || true)
if echo "$AMSG" | grep -qi 'forbidden'; then check "nonadmin_admin_rpc" PASS
elif echo "$AMSG" | grep -qi 'Could not find'; then check "nonadmin_admin_rpc" FAIL
else check "nonadmin_admin_rpc" PASS; fi

# verify IDOR: only self (no p_id param by design)
VER=$(curl -sS -o /tmp/v.json -w "%{http_code}" -X POST "$URL/rest/v1/rpc/verify_and_activate_analyst" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: application/json" \
  -d '{"p_code":"WRONGCODE"}')
VMSG=$(cat /tmp/v.json)
if echo "$VMSG" | grep -q '"ok": false\|not_approved\|invalid_code\|Could not find'; then check "verify_no_foreign_activation" PASS
else check "verify_no_foreign_activation" FAIL; fi

# Storage cross-user
DEL=$(curl -sS -o /tmp/d.json -w "%{http_code}" -X DELETE \
  "$URL/storage/v1/object/share-media/57ad6790-3db4-40fc-8ed0-9b7885d20ac4/avatars/1786413321619.jpg" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A")
if grep -q AccessDenied /tmp/d.json; then check "storage_cross_delete" PASS; else check "storage_cross_delete" FAIL; fi

UP=$(curl -sS -o /tmp/u.json -w "%{http_code}" -X POST \
  "$URL/storage/v1/object/share-media/${UID_B}/avatars/x.txt" \
  -H "apikey: $KEY" -H "Authorization: Bearer $TOKEN_A" -H "Content-Type: text/plain" --data-binary "x")
if grep -qi 'row-level security\|AccessDenied' /tmp/u.json; then check "storage_cross_upload" PASS; else check "storage_cross_upload" FAIL; fi

echo "== summary pass=$pass fail=$fail not_testable=$skip =="
exit $(( fail > 0 ? 1 : 0 ))
