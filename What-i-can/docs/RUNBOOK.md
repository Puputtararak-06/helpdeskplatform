# Day-2 Operations Runbook

> **Audience:** Future maintainers (after A5 submission)
> **Purpose:** What to do when something breaks or needs changes

---

## Daily checks (optional)

```powershell
# Show recent outbox activity
node What-i-can/scripts/inspect-queue.cjs

# Should show no "failed" or stuck "pending" rows
# If pending > 10: cron worker may not be running
```

---

## Common Day-2 tasks

### Update shared secret (rotation)

**When:** Quarterly, or after suspected leak

```powershell
# 1. Generate new secret
openssl rand -hex 32
# → e.g., abc123...xyz789

# 2. Update Helpdesk secret
wrangler secret put WELLBEING_WEBHOOK_SECRET
# Paste new secret

# 3. Update mock secret
cd What-i-can/mocks
wrangler secret put WELLBEING_MOCK_SECRET
# Paste same new secret

# 4. Redeploy both
cd ../..
wrangler deploy
cd What-i-can/mocks && wrangler deploy

# 5. Verify
node What-i-can/scripts/preflight.cjs
# Should show: ✅ Mock can sign with secret (sender path)
```

### Replay pending webhooks

```powershell
# Manual trigger (don't wait for cron)
curl https://helpdesk-team14.<sub>.workers.dev/admin/retry-now

# Or wait 5 minutes for cron
```

### View recent errors

```powershell
# Real-time tail
wrangler tail helpdesk-team14 --format=pretty

# Filter for errors only
wrangler tail helpdesk-team14 --format=pretty | Select-String -Pattern "ERROR|error|invalid"

# Last 100 lines
wrangler tail helpdesk-team14 --format=pretty | Select-Object -Last 100
```

### Reset everything (development)

```powershell
node What-i-can/scripts/cleanup.cjs --include-mock
# Clears webhook_events, webhook_outbox
# Resets mock call log + idempotency cache
# Does NOT delete tickets
```

### Restore from backup

```bash
# List backups
ls -la What-i-can/backups/

# Restore
# Note: D1 doesn't have direct SQL restore. Instead:
# 1. Read backup SQL file
# 2. Run wrangler d1 execute with --file=backup.sql
# 3. Or manually INSERT the rows you need
```

---

## When something breaks

### Symptom: Webhooks stop being processed

```powershell
# 1. Check Helpdesk logs
wrangler tail helpdesk-team14 --format=pretty | Select-Object -Last 50

# 2. Check D1 schema (migration may have failed)
node What-i-can/scripts/verify-schema.cjs

# 3. Check outbox (stuck items)
node What-i-can/scripts/inspect-queue.cjs

# 4. Manual retry
curl https://helpdesk-team14.<sub>.workers.dev/admin/retry-now
```

### Symptom: HMAC errors (401)

```powershell
# 1. Verify secret matches
wrangler secret list helpdesk-team14 | grep WELLBEING_WEBHOOK_SECRET
wrangler secret list wellbeing-mock | grep WELLBEING_MOCK_SECRET

# 2. Run HMAC sanity check
node What-i-can/scripts/hmac-test.cjs

# 3. Verify a specific signature
node What-i-can/scripts/verify-sig.cjs --secret=XXX --header="t=...,v1=..." --body='...'
```

### Symptom: Mock degraded

```powershell
# Heal it
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/_debug/heal

# Verify
curl https://wellbeing-mock.<sub>.workers.dev/v1/_debug/calls
# → should show degraded: false
```

### Symptom: Tickets not syncing to Wellbeing

```sql
-- Check what's stuck
SELECT * FROM webhook_outbox WHERE status != 'sent' ORDER BY created_at DESC LIMIT 10;

-- Force retry
UPDATE webhook_outbox SET status = 'pending', attempts = 0 WHERE status = 'failed';

-- Cron will pick them up in 5 min
```

---

## Performance tuning

### If webhook receiver is slow

Check D1 latency:
```bash
wrangler d1 execute helpdesk-db --remote --command "EXPLAIN QUERY PLAN SELECT * FROM webhook_events WHERE event_key = 'abc'"
```

Check indexes:
```bash
wrangler d1 execute helpdesk-db --remote --command "SELECT name FROM sqlite_master WHERE type='index'"
```

### If cron worker is falling behind

Increase batch size in `src/workers/retry-worker.ts`:
```ts
const BATCH_SIZE = 50;  // default 20
```

Then redeploy.

### If duplicate webhooks received

Check `webhook_events` for `UNIQUE(event_key)` constraint
```sql
SELECT sql FROM sqlite_master WHERE type='table' AND name='webhook_events';
-- Should include: event_key TEXT UNIQUE NOT NULL
```

If missing, re-run migration 0005.

---

## Capacity planning

| Metric | Free tier limit | When to worry |
|---|---|---|
| D1 rows | 100,000 total | > 50k tickets |
| D1 writes | 5M/day | > 500k |
| Worker requests | 100k/day | > 50k |
| Cron triggers | Unlimited | n/a |

Current usage (test data):
- 8 seed rows + maybe 20 test rows = 28
- Well within limits

---

## Schema migration checklist (for next migration)

When you need to change schema again:

1. Create `migrations/0006_<name>.sql`
2. Use SQLite ALTER pattern (recreate table) for breaking changes
3. Add to `package.json` `db:migrate:*` scripts
4. Test locally first
5. Apply to remote
6. Update `verify-schema.cjs` expected list

---

## Disaster recovery

### Total loss of mock

Mock is just a Worker — recreate in 5 minutes:

```bash
cd What-i-can/mocks
wrangler init wellbeing-mock --type javascript
# paste wellbeing-mock-api.mjs content
wrangler secret put WELLBEING_MOCK_SECRET
# paste secret
wrangler deploy
# update DNS if subdomain changed
```

### Total loss of Helpdesk

More complex — Helpdesk has main app + integration code.

1. Redeploy main app from git
2. Redeploy with What-i-can code copied in
3. Re-apply migration
4. Re-set secrets
5. Re-seed data (if needed)

Recovery time: ~30 min if you have git history

### Schema corruption

If migration applied wrong:
```sql
-- Check current schema
SELECT sql FROM sqlite_master WHERE type='table';

-- Restore from backup
wrangler d1 execute helpdesk-db --remote --file=What-i-can/backups/<latest>.sql
```

(But you need a backup first! Run `backup-db.sh` regularly.)

---

## When Team 16 responds

Follow `docs/SWAP.md` playbook.

Quick checklist:
- [ ] Compare their contract to ours (CONTRACT_DIFF.md)
- [ ] Update mock to match (or remove mock)
- [ ] Swap 2 vars in wrangler.toml
- [ ] Update validators if field names changed
- [ ] Run preflight + tests
- [ ] Document the swap

---

## Contact / escalation

If something breaks and you can't fix it:

1. Check `TROUBLESHOOTING.md` and `FAQ.md`
2. Run `wrangler tail` to see live logs
3. Run scripts/preflight.cjs to identify issue
4. Search Cloudflare status: https://www.cloudflarestatus.com/
5. Check D1 status in dashboard

---

*Document version 1.0 — created 2026-09-21*
