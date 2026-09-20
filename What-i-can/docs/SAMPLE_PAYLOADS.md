# Sample Payloads & Test Scenarios

Concrete examples สำหรับ test ทุก case ของ A5 evidence

---

## Consumer — POST /v1/cases (Helpdesk → Wellbeing)

### Basic (Test 1)

```bash
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/cases \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: ticket-TKT-001-case" \
  -H "X-Signature: t=1695371415000,v1=..." \
  -d '{"ticket_ref":"TKT-001","urgency":"medium"}'
```

### High urgency

```json
{
  "ticket_ref": "TKT-EMERGENCY-001",
  "urgency": "high"
}
```

### Result: 201 Created
```json
{
  "case_id": "wb-1695371415000-abc12",
  "status": "open",
  "urgency": "medium",
  "ticket_ref": "TKT-001",
  "created_at": "2026-09-22T10:30:15.000Z"
}
```

---

## Provider — POST /webhooks/wellbeing (Wellbeing → Helpdesk)

### Trigger via mock (Test 2)

```bash
curl -X POST https://wellbeing-mock.<sub>.workers.dev/internal/trigger-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "event": "wellbeing.case.opened",
    "data": {
      "case_id": "wb-12345",
      "ticket_ref": "TKT-002",
      "mood_score": 3
    },
    "idempotency_key": "evt-test-001"
  }'
```

### The actual webhook (what Helpdesk receives)

```http
POST /webhooks/wellbeing HTTP/1.1
Host: helpdesk-team14.<sub>.workers.dev
Content-Type: application/json
X-Signature: t=1695373522000,v1=8a7f3b2c9d4e1f6a5b8c2d3e4f5a6b7c

{
  "event": "wellbeing.case.opened",
  "data": {
    "case_id": "wb-12345",
    "ticket_ref": "TKT-002",
    "mood_score": 3
  },
  "timestamp": "2026-09-22T10:45:22.000Z",
  "idempotency_key": "evt-test-001"
}
```

### Expected response
```json
{"ok":true}
```

---

## Webhook Receiver — Test 3a (invalid sig → 401)

```bash
curl -X POST https://helpdesk-team14.<sub>.workers.dev/webhooks/wellbeing \
  -H "Content-Type: application/json" \
  -H "X-Signature: t=0,v1=invalid_garbage" \
  -d '{"event":"wellbeing.case.opened","idempotency_key":"evt-bad-001","data":{}}'
```

**Response 401:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid signature",
    "details": { "field": "X-Signature" }
  }
}
```

---

## Idempotency — Tests 5 + 5b

### First call
```bash
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/cases \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: ticket-TKT-005-case" \
  -d '{"ticket_ref":"TKT-005","urgency":"low"}'
```

**Response 201:**
```json
{
  "case_id": "wb-1695372001-aaa01",
  ...
}
```

### Replay (same key, same body)
```bash
# Same command, exactly
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/cases \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: ticket-TKT-005-case" \
  -d '{"ticket_ref":"TKT-005","urgency":"low"}'
```

**Response 200 (with replay header):**
```
HTTP/1.1 200 OK
X-Idempotent-Replay: true
Content-Type: application/json

{
  "case_id": "wb-1695372001-aaa01",  ← SAME as first call
  ...
}
```

**DB proof:**
```sql
SELECT COUNT(*) FROM webhook_outbox WHERE idempotency_key = 'ticket-TKT-005-case';
-- Expected: 1 (only first call created record)
```

---

## Degradation — Tests 6a/b/c/d

### 6a — Break partner
```bash
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/_debug/break
# → {"ok":true,"mode":"degraded"}
```

### 6b — Call fails (500)
```bash
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/cases \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: ticket-TKT-006-case" \
  -d '{"ticket_ref":"TKT-006","urgency":"medium"}'
```

**Response 500:**
```json
{
  "error": {
    "code": "DEGRADED",
    "message": "partner unavailable"
  }
}
```

**Helpdesk fallback:** ticket TKT-006 created locally with `wellbeing_status='pending_sync'`

### 6c — Heal
```bash
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/_debug/heal
# → {"ok":true,"mode":"healed"}
```

### 6d — Recovery
```bash
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/cases \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: ticket-TKT-007-case" \
  -d '{"ticket_ref":"TKT-007","urgency":"medium"}'
```

**Response 201:** case created normally

**Cron worker** (next 5min) processes pending retry queue → TKT-006 also syncs

---

## Validation — Bad payloads

### Missing required field
```bash
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/cases \
  -d '{"urgency":"medium"}'  # no ticket_ref
```
**Response 400:**
```json
{"error":{"code":"VALIDATION_ERROR","message":"required","details":{"field":"ticket_ref"}}}
```

### Invalid category (for ticket creation if applicable)
```bash
curl -X POST .../v1/cases -d '{"ticket_ref":"X","urgency":"URGENT_PLUS"}'
```
**Response 400:**
```json
{"error":{"code":"VALIDATION_ERROR","message":"must be one of low, medium, high","details":{"field":"urgency"}}}
```

### Malformed JSON
```bash
curl -X POST .../v1/cases -d '{not json'
```
**Response 400:** invalid JSON parse error

---

## Bulk testing

### 100 concurrent requests
```bash
node What-i-can/scripts/load-test.cjs --concurrency=20 --total=100
```

Expected output:
- All 100 succeed (or 99/100 with one idempotent replay)
- P95 latency < 500ms
- Throughput > 50 req/s

---

## DB inspection queries

### See synced tickets
```sql
SELECT ticket_ref, wellbeing_record_id, wellbeing_status, datetime(wellbeing_synced_at) as synced
FROM tickets WHERE wellbeing_record_id IS NOT NULL
ORDER BY wellbeing_synced_at DESC LIMIT 10;
```

### See received webhooks
```sql
SELECT id, event_key, event_type, source, datetime(received_at) as received, processed_at
FROM webhook_events ORDER BY id DESC LIMIT 10;
```

### See outbox
```sql
SELECT id, idempotency_key, ticket_id, status, attempts, datetime(sent_at) as sent
FROM webhook_outbox ORDER BY id DESC LIMIT 10;
```

### Idempotency proof
```sql
-- Should be 1 for unique key
SELECT idempotency_key, COUNT(*) as rows
FROM webhook_outbox
WHERE idempotency_key = 'ticket-TKT-005-case'
GROUP BY idempotency_key;
```

---

## Edge case scenarios (manual testing)

### Webhook arrives before Helpdesk creates the case
```
1. Wellbeing sends webhook for case that doesn't exist yet on Helpdesk
2. Helpdesk receiver processes webhook
3. processEvent() tries to UPDATE tickets WHERE ticket_ref = ?
4. UPDATE affects 0 rows (no matching ticket)
5. Receiver still returns 200 — we accept the event, just can't link it
```
**Expected:** webhook_events row inserted, ticket NOT updated. No error.

### Self-claim scenario
```
1. Student A reports lost item (status=lost) — wait, we removed "lost"
2. After our design simplification: only finders post (status=found)
3. Owner can't self-create, but can "claim" via PATCH
4. If owner = finder (same person reports finding their own), self-claim is OK in our design
```

### Concurrent updates
```
1. Two PATCH requests hit the same ticket simultaneously
2. Both compute different updates
3. SQLite serializes writes — last writer wins
4. updated_at reflects the later write
```
**Expected:** No corruption. Both succeed, final state = one of the two updates.

---

## Reference timestamps for evidence

| Test | Time (use these in evidence doc) |
|---|---|
| Test 1 (Consumer) | 2026-09-22T10:30:15Z |
| Test 2 (Provider) | 2026-09-22T10:35:22Z |
| Test 3a (Invalid sig) | 2026-09-22T10:40:01Z |
| Test 3b (Valid sig) | 2026-09-22T10:40:30Z |
| Test 4 (Sender) | 2026-09-22T10:45:00Z |
| Test 5 (Idem first) | 2026-09-22T10:50:00Z |
| Test 5b (Idem replay) | 2026-09-22T10:50:14Z |
| Test 6a (Break) | 2026-09-22T11:00:00Z |
| Test 6b (Fail) | 2026-09-22T11:00:30Z |
| Test 6c (Heal) | 2026-09-22T11:05:00Z |
| Test 6d (Recover) | 2026-09-22T11:05:30Z |

(Update these with actual timestamps from your test run)
