-- migrations/0005_wellbeing_fields.sql
-- A5 Integration: add wellbeing fields to tickets + tracking tables
-- Run: wrangler d1 execute helpdesk-db --remote --file=./migrations/0005_wellbeing_fields.sql

-- 1) Extend tickets table with wellbeing linkage
ALTER TABLE tickets ADD COLUMN wellbeing_record_id TEXT;
ALTER TABLE tickets ADD COLUMN wellbeing_status TEXT
  CHECK(wellbeing_status IN ('open','in_progress','closed','referred','pending_sync'));
ALTER TABLE tickets ADD COLUMN wellbeing_synced_at TEXT;
ALTER TABLE tickets ADD COLUMN wellbeing_webhook_secret TEXT;

CREATE INDEX IF NOT EXISTS idx_tickets_wellbeing_record_id
  ON tickets(wellbeing_record_id);

-- 2) Webhook events table (incoming) — used for idempotency + audit
CREATE TABLE IF NOT EXISTS webhook_events (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  event_key    TEXT    UNIQUE NOT NULL,
  event_type   TEXT    NOT NULL,
  payload      TEXT    NOT NULL,
  source       TEXT    NOT NULL DEFAULT 'wellbeing',
  received_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_key
  ON webhook_events(event_key);

CREATE INDEX IF NOT EXISTS idx_webhook_events_type_time
  ON webhook_events(event_type, received_at DESC);

-- 3) Webhook outbox (outgoing) — retry queue with idempotency
CREATE TABLE IF NOT EXISTS webhook_outbox (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  idempotency_key  TEXT    UNIQUE NOT NULL,
  ticket_id        TEXT,
  destination      TEXT    NOT NULL,
  endpoint         TEXT    NOT NULL,
  payload          TEXT    NOT NULL,
  status           TEXT    NOT NULL DEFAULT 'pending'
                            CHECK(status IN ('pending','sent','failed','retrying')),
  attempts         INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  last_attempt_at  TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
  sent_at          TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_outbox_status
  ON webhook_outbox(status);

CREATE INDEX IF NOT EXISTS idx_webhook_outbox_ticket
  ON webhook_outbox(ticket_id);

-- 4) Sync health (for degradation detection)
CREATE TABLE IF NOT EXISTS partner_sync_health (
  partner         TEXT PRIMARY KEY,
  last_success_at TEXT,
  last_failure_at TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'unknown'
                   CHECK(status IN ('healthy','degraded','down'))
);
