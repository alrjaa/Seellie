#!/usr/bin/env bash
# Apply SHARE-CARDS-REALTIME.sql using a Database connection string.
# Usage:
#   export SEELLIE_DATABASE_URL='postgresql://...'
#   bash scripts/apply-share-cards-realtime.sh
# Never commit the URL. Never use service_role in the app client.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL="$ROOT/supabase/SHARE-CARDS-REALTIME.sql"
URL="${SEELLIE_DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  echo "SEELLIE_DATABASE_URL is required (Supabase → Settings → Database → URI)."
  exit 2
fi
if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found. Install PostgreSQL client or run the SQL in Supabase SQL Editor."
  exit 3
fi
echo "Applying SHARE-CARDS-REALTIME.sql (URL not printed)..."
psql "$URL" -v ON_ERROR_STOP=1 -f "$SQL"
echo "Verifying publication membership..."
psql "$URL" -v ON_ERROR_STOP=1 -c "select pubname, schemaname, tablename from pg_publication_tables where pubname='supabase_realtime' and tablename='share_cards';"
echo "Done."
