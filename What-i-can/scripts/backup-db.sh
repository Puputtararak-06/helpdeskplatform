#!/bin/bash
# scripts/backup-db.sh
# Export D1 database tables to SQL for backup / inspection.
# Useful before destructive operations.
#
# Usage:
#   chmod +x scripts/backup-db.sh
#   ./scripts/backup-db.sh [--local]
#
# Output: backups/helpdesk-db-<timestamp>.sql

set -e

LOCAL_FLAG=""
if [ "$1" = "--local" ]; then
  LOCAL_FLAG="--local"
  echo "Backing up LOCAL database"
else
  echo "Backing up REMOTE database"
fi

DB_NAME="helpdesk-db"
BACKUP_DIR="$(dirname "$0")/../backups"
mkdir -p "$BACKUP_DIR"

TS=$(date +%Y%m%d-%H%M%S)
OUT_FILE="$BACKUP_DIR/${DB_NAME}-${TS}.sql"

TABLES=(
  "tickets"
  "webhook_events"
  "webhook_outbox"
  "partner_sync_health"
)

echo "Output: $OUT_FILE"
echo ""

{
  echo "-- Backup created $(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  echo "-- Database: $DB_NAME ($([ -z "$LOCAL_FLAG" ] && echo 'remote' || echo 'local'))"
  echo ""

  for table in "${TABLES[@]}"; do
    echo "-- ============================================"
    echo "-- Table: $table"
    echo "-- ============================================"
    echo ""

    # Check if table exists
    exists=$(wrangler d1 execute "$DB_NAME" $LOCAL_FLAG \
      --command="SELECT COUNT(*) as n FROM $table" --json 2>/dev/null | grep -o '"n":[0-9]*' | head -1)
    if [ -z "$exists" ]; then
      echo "-- (table doesn't exist or is empty)"
      continue
    fi

    # Get schema
    echo "-- Schema:"
    wrangler d1 execute "$DB_NAME" $LOCAL_FLAG \
      --command="SELECT sql FROM sqlite_master WHERE type='table' AND name='$table'" 2>/dev/null | \
      grep -v "^Executing\|⛅️\|🌀\|🪃" | sed 's/^/--   /'
    echo ""

    # Get data as INSERTs
    rows=$(wrangler d1 execute "$DB_NAME" $LOCAL_FLAG \
      --command="SELECT * FROM $table" --json 2>/dev/null)

    if [ -z "$rows" ]; then
      echo "-- (no rows)"
      continue
    fi

    # Parse JSON and generate INSERTs
    count=$(echo "$rows" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if isinstance(data, list) and data:
        rows = data[0].get('results', [])
        print(len(rows))
    else:
        print(0)
except:
    print(0)
" 2>/dev/null)

    if [ "$count" = "0" ] || [ -z "$count" ]; then
      echo "-- (no rows)"
      continue
    fi

    echo "-- $count rows:"
    echo "$rows" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if isinstance(data, list) and data:
        rows = data[0].get('results', [])
        for row in rows:
            cols = list(row.keys())
            vals = []
            for c in cols:
                v = row[c]
                if v is None:
                    vals.append('NULL')
                elif isinstance(v, (int, float)):
                    vals.append(str(v))
                else:
                    s = str(v).replace(\"'\", \"''\")
                    vals.append(f\"'{s}'\")
            cols_str = ', '.join(cols)
            vals_str = ', '.join(vals)
            print(f\"INSERT INTO $table ({cols_str}) VALUES ({vals_str});\")
except Exception as e:
    pass
" 2>/dev/null
    echo ""
  done
} > "$OUT_FILE"

LINES=$(wc -l < "$OUT_FILE")
SIZE=$(du -h "$OUT_FILE" | cut -f1)
echo "✅ Backup complete: $OUT_FILE ($LINES lines, $SIZE)"
