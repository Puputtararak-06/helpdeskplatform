-- migrations/0006_rollback.sql
-- EMERGENCY ROLLBACK — drops all A5 integration columns and tables.
-- Use ONLY if migration 0005 caused issues and you need to start fresh.
--
-- ⚠️  DATA LOSS WARNING:
--    - All webhook_events rows will be deleted
--    - All webhook_outbox rows will be deleted
--    - All partner_sync_health rows will be deleted
--    - All wellbeing_* columns on tickets will be NULLed
--
-- Run: wrangler d1 execute helpdesk-db --remote --file=What-i-can/migrations/0006_rollback.sql
-- Confirm: Y (wrangler will prompt)

-- 1) Drop new tables (these have no FK constraints to tickets)
DROP TABLE IF EXISTS webhook_events;
DROP TABLE IF EXISTS webhook_outbox;
DROP TABLE IF EXISTS partner_sync_health;

-- 2) Drop indexes on tickets.wellbeing_record_id (auto-dropped with column)
--    But if you want to keep the column, just NULL it:
UPDATE tickets
SET
  wellbeing_record_id = NULL,
  wellbeing_status = NULL,
  wellbeing_synced_at = NULL,
  wellbeing_webhook_secret = NULL;

-- 3) Optionally drop the columns entirely (uncomment if you want clean slate):
-- SQLite doesn't support DROP COLUMN in older versions, but D1 uses 3.39+ which does:
-- ALTER TABLE tickets DROP COLUMN wellbeing_record_id;
-- ALTER TABLE tickets DROP COLUMN wellbeing_status;
-- ALTER TABLE tickets DROP COLUMN wellbeing_synced_at;
-- ALTER TABLE tickets DROP COLUMN wellbeing_webhook_secret;

-- 4) Verify clean state
SELECT
  (SELECT COUNT(*) FROM webhook_events) as events_count,
  (SELECT COUNT(*) FROM webhook_outbox) as outbox_count,
  (SELECT COUNT(*) FROM tickets WHERE wellbeing_record_id IS NOT NULL) as tickets_with_wellbeing;

-- Expected output:
-- events_count: 0
-- outbox_count: 0
-- tickets_with_wellbeing: 0
