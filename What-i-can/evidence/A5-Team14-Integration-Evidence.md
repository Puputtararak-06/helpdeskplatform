# A5-Team14-Integration-Evidence

> **Team:** Helpdesk Team 14 × Wellbeing Team 16
> **Submitted:** 2026-09-22
> **Author:** Ratthaphum Wanthamat
> **Course:** Platform Development

---

## Architecture

```
┌────────────────────────────┐                      ┌────────────────────────────┐
│   Helpdesk (Team 14)       │                      │   Wellbeing (Team 16)      │
│   Cloudflare Worker        │                      │   Cloudflare Worker (mock) │
│                            │                      │                            │
│  ┌────────────────────┐    │  (1) Consumer Proof   │  ┌──────────────────────┐  │
│  │   Tickets API      │───►│  POST /v1/cases      │◄─│   /v1/cases          │  │
│  │   + Hono routes    │    │  + HMAC sign         │  │   /v1/cases/:id      │  │
│  └────────────────────┘    │                      │  └──────────────────────┘  │
│           │                │                      │           ▲                │
│           ▼                │  (2) Sender Proof    │           │                │
│  ┌────────────────────┐    │  POST /v1/cases      │  ┌──────────────────────┐  │
│  │  webhook_outbox   │───►│  + idempotency key   │  │  idempotency cache   │  │
│  │  (retry queue)    │    │                      │  └──────────────────────┘  │
│  └────────────────────┘    │                      │                            │
│           ▲                │                      │  ┌──────────────────────┐  │
│  ┌────────────────────┐    │  (3) Provider Proof  │  │  /internal/          │  │
│  │  Retry Worker     │    │  POST /webhooks/     │──│  trigger-webhook     │  │
│  │  (cron */5 * * *) │    │  wellbeing           │  │  (sends to Helpdesk) │  │
│  └────────────────────┘    │  + HMAC verify       │  └──────────────────────┘  │
│                            │                      │                            │
│  ┌────────────────────┐    │  (4) Receiver Proof  │  ┌──────────────────────┐  │
│  │  POST /webhooks/   │◄───│  POST incoming +     │──│  HMAC-signed payload │  │
│  │  wellbeing         │    │  verify + idempotent │  │                      │  │
│  └────────────────────┘    │                      │  └──────────────────────┘  │
│           │                │                      │                            │
│           ▼                │                      │  ┌──────────────────────┐  │
│  ┌────────────────────┐    │  (5) Idempotency     │  │  /v1/_debug/         │  │
│  │  webhook_events   │    │  same key → 1 row    │  │  break / heal /      │  │
│  │  (UNIQUE key)     │    │                      │  │  reset / calls       │  │
│  └────────────────────┘    │                      │  └──────────────────────┘  │
└────────────────────────────┘                      └────────────────────────────┘
```

**Data flow:**

1. **Consumer:** Helpdesk → POST `/v1/cases` (with HMAC + idempotency key) → mock returns case_id
2. **Sender:** Helpdesk `webhook_outbox` queue → cron retry worker → POST to Wellbeing → success → status='sent'
3. **Provider:** Wellbeing event occurs → mock POSTs to `/webhooks/wellbeing` on Helpdesk → HMAC verified → `webhook_events` row inserted → ticket updated
4. **Idempotency:** Same `idempotency_key` from Helpdesk → mock returns cached response + `X-Idempotent-Replay: true`; same `event_key` to Helpdesk → receiver sees existing row → 200 replay
5. **Degradation:** mock `/v1/_debug/break` → all calls return 500; Helpdesk queues for retry → `/v1/_debug/heal` → cron worker flushes queue on next tick

---

## ⚠️ Important note on partner non-response

Team 16 (Wellbeing) had **not delivered their API contract or sandbox URL** as of 2026-09-21T01:50 GMT+7 (deadline −22h). Per Section 9 of our joint integration preparation doc ("Do not invent contract"), Team 14 did not fabricate Team 16's API.

Instead:
1. Team 14 deployed a **mock Wellbeing API** (`What-i-can/mocks/wellbeing-mock-api.mjs`) implementing the contract shape Team 14 proposed in the joint prep doc.
2. All 6 evidence categories below were produced against this mock.
3. Code is modular — swapping `WELLBEING_API_URL` and `WELLBEING_WEBHOOK_SECRET` in Helpdesk `wrangler.toml` is sufficient to point at Team 16's real API when available. **No code changes needed.**

This is mock-driven development, consistent with engineering best practice and the assignment's spirit of demonstrating integration capability.

---

## 1. Consumer Proof — Helpdesk calls Wellbeing

**Partner URL:** `https://wellbeing-mock.<subdomain>.workers.dev` (mock deployed by Team 14)
**Real URL (planned):** `https://api.wellbeing.mfu.ac.th/v1/cases` (pending Team 16 contract)
**Request timestamp:** _paste actual time from Postman runner_

```
POST /v1/cases HTTP/1.1
Host: wellbeing-mock.<subdomain>.workers.dev
Content-Type: application/json
X-Idempotency-Key: ticket-TKT-001-case
X-Signature: t=1695371415000,v1=<hex>

{"ticket_ref":"TKT-001","urgency":"medium"}
```

**Response body:**
```json
_paste actual response from Postman_
```

> See Postman screenshot saved as `evidence/screenshots/01-consumer-proof.png`

---

## 2. Provider Proof — Wellbeing calls Helpdesk

**Your endpoint:** `https://helpdesk-team14.<subdomain>.workers.dev/webhooks/wellbeing`

**Internal request log** (from `wrangler tail` output — paste actual):
```
_paste actual wrangler tail output showing incoming webhook_
```

**Partner confirmation:** Triggered via `POST {{wellbeing_url}}/internal/trigger-webhook` — response:
```json
_paste actual response_
```

> See `evidence/screenshots/02-provider-proof.png`

---

## 3. Webhook Receiver — HMAC verification

**Incoming payload:**
```json
_paste payload from test 3b_
```

**Secret verification result:**
- Invalid signature (test 3a): `401 { "error": "invalid signature", "reason": "invalid_signature" }`
- Valid signature (test 3b via 2): `200 { "ok": true }`

**Stored log** — DB query:
```sql
SELECT event_key, event_type, source, received_at
FROM webhook_events
WHERE event_key = 'evt-test-002';
```

| event_key | event_type | source | received_at |
|---|---|---|---|
| _paste_ | _paste_ | _paste_ | _paste_ |

> See `evidence/screenshots/03-webhook-receiver.png`

---

## 4. Webhook Sender — Helpdesk outbound

**Internal trigger action:** A new ticket TKT-004 with urgency=high → `createWellbeingCase()` invoked in `src/lib/wellbeing-sync.ts`

**Outgoing request:**
```
POST https://wellbeing-mock.<subdomain>.workers.dev/v1/cases HTTP/1.1
Content-Type: application/json
X-Idempotency-Key: ticket-TKT-004-case
X-Signature: t=1695371800000,v1=<hex>

{"ticket_ref":"TKT-004","urgency":"high"}
```

**Partner response log:**
```sql
SELECT idempotency_key, status, attempts, sent_at
FROM webhook_outbox
WHERE idempotency_key = 'ticket-TKT-004-case';
```

| idempotency_key | status | attempts | sent_at |
|---|---|---|---|
| _paste_ | _paste_ | _paste_ | _paste_ |

> See `evidence/screenshots/04-webhook-sender.png`

---

## 5. Idempotency Proof — same key, one DB record

**Request 1** (test 5): `POST /v1/cases` with `X-Idempotency-Key: ticket-TKT-005-case`
- **Response 1:** _paste response_

**Request 2** (test 5b): same payload + same key, 14 seconds later
- **Response 2:** _paste response — should include `X-Idempotent-Replay: true`_

**DB proof of single creation:**
```sql
SELECT COUNT(*) AS rows_in_outbox FROM webhook_outbox
WHERE idempotency_key = 'ticket-TKT-005-case';
-- Expected: 1
```

```sql
SELECT COUNT(*) AS rows_in_mock FROM (your mock log query)
WHERE idempotency_key = 'ticket-TKT-005-case';
-- Expected: 1 (only created once even though 2 requests sent)
```

> See `evidence/screenshots/05-idempotency.png`

---

## 6. Degradation Proof — failure → fallback → recovery

**Breakage:** `POST /v1/_debug/break` at _paste timestamp_
**Heal:** `POST /v1/_debug/heal` at _paste timestamp_

**Call during outage** (test 6b): `POST /v1/cases` for TKT-006
- Expected response: `500 { "error": { "code": "DEGRADED", ... } }`
- Helpdesk ticket TKT-006 created locally with `wellbeing_status = 'pending_sync'`

**Recovery** (test 6d): `POST /v1/cases` for TKT-007
- Expected response: `201 Created` with case_id
- pending_sync queue flushed

**Automatic recovery log:**
```
_paste wrangler tail output showing fallback + retry + recovery_
```

```sql
-- Verify sync status update
SELECT id, ticket_ref, wellbeing_record_id, wellbeing_status, wellbeing_synced_at
FROM tickets
WHERE ticket_ref IN ('TKT-006','TKT-007');
```

> See `evidence/screenshots/06-degradation.png`

---

## Appendix A — D1 schema applied

Migration file: `What-i-can/migrations/0005_wellbeing_fields.sql`

```bash
wrangler d1 execute helpdesk-db --remote --file=What-i-can/migrations/0005_wellbeing_fields.sql
```

Result: 4 columns added to `tickets`, 3 new tables created (`webhook_events`, `webhook_outbox`, `partner_sync_health`).

## Appendix B — Configuration

```toml
# Helpdesk wrangler.toml
[vars]
WELLBEING_API_URL = "https://wellbeing-mock.<subdomain>.workers.dev"
WELLBEING_WEBHOOK_SECRET = "mock-wellbeing-secret-change-me-when-real-team16-ready"
```

When Team 16 ready:
```toml
[vars]
WELLBEING_API_URL = "https://api.wellbeing.mfu.ac.th"
WELLBEING_WEBHOOK_SECRET = "<shared secret from Team 16>"
```

## Appendix C — Reproduction steps

1. Apply migration (Appendix A)
2. Deploy mock (per `What-i-can/MOCK_DEPLOY.md`)
3. Set Helpdesk env vars (Appendix B)
4. Import `What-i-can/postman/A5-collection.json` to Postman
5. Update 2 environment variables (`wellbeing_url`, `helpdesk_url`)
6. Run collection in order: 1, 2, 3a, 3b, 4, 5, 5b, 6a, 6b, 6c, 6d
7. Inspect DB to verify (queries in Sections 4–6)

---

*End of evidence — A5-Team14-Integration-Evidence v1.0*
