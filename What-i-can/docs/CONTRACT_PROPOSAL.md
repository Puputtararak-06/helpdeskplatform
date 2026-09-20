# Mock Contract Proposal — Helpspeed Team 14 → Wellbeing Team 16

> **Purpose:** Concrete spec Team 16 can review, agree to, or push back on
> **Status:** Pending Team 16 confirmation
> **Stop-gap:** Until confirmed, Team 14 uses mock implementation (see `mocks/`)

---

## Authentication — HMAC-SHA256

### Outgoing (Helpdesk → Wellbeing)

Every request includes header:
```
X-Signature: t=<unix_ms>,v1=<hex_sha256>
```

Where `hex_sha256 = HMAC-SHA256(shared_secret, "<unix_ms>.<raw_request_body>")`

Example:
- shared_secret: `a1b2c3d4...` (32+ chars)
- timestamp: `1695371415000`
- body: `{"ticket_ref":"TKT-001","urgency":"medium"}`
- signed_message: `"1695371415000.{\"ticket_ref\":\"TKT-001\",\"urgency\":\"medium\"}"`
- signature: `9f3a4b2c...`

### Incoming (Wellbeing → Helpdesk)

Same format — Helpdesk's webhook receiver at `POST /webhooks/wellbeing`:
```
X-Signature: t=<unix_ms>,v1=<hex_sha256>
```

**Replay protection:** timestamp must be within 5 minutes (300s) of current time

**Failure response:** `401 { "error": { "code": "VALIDATION_ERROR", "message": "invalid signature", "reason": "invalid_signature" } }`

---

## Idempotency

### Outgoing requests

Helpdesk sets header:
```
X-Idempotency-Key: <unique-string>
```

Rules:
- Helpdesk derives from business data (e.g., `ticket-${ticket_ref}-case`)
- Wellbeing caches response for same key
- Replay returns cached response with header `X-Idempotent-Replay: true`

### Incoming webhooks

Wellbeing sets in body:
```json
{
  "event": "wellbeing.case.opened",
  "idempotency_key": "evt-<unique>"
}
```

Helpdesk stores in `webhook_events` table with `UNIQUE(event_key)` constraint
Replay returns `200 { "ok": true, "replay": true }`

---

## Endpoints — Consumer (Helpdesk → Wellbeing)

### POST /v1/cases — Create case

**Request:**
```http
POST /v1/cases HTTP/1.1
Content-Type: application/json
X-Idempotency-Key: ticket-TKT-001-case
X-Signature: t=1695371415000,v1=abc123...

{
  "ticket_ref": "TKT-001",
  "urgency": "medium"
}
```

**Response 201:**
```json
{
  "case_id": "wb-1695371415000-abc12",
  "status": "open",
  "urgency": "medium",
  "ticket_ref": "TKT-001",
  "created_at": "2026-09-22T10:30:15.000Z"
}
```

### GET /v1/cases/:id

**Response 200:**
```json
{
  "case_id": "wb-1695371415000-abc12",
  "status": "open",
  "urgency": "medium",
  "ticket_ref": "TKT-001",
  "notes": "...",
  "last_updated": "2026-09-22T10:30:15.000Z"
}
```

### PATCH /v1/cases/:id

**Request:**
```json
{
  "status": "in_progress",
  "notes": "follow up scheduled"
}
```

**Response 200:** updated case object

---

## Webhook Events (Wellbeing → Helpdesk)

### POST /webhooks/wellbeing on Helpdesk

**Request:**
```http
POST /webhooks/wellbeing HTTP/1.1
Content-Type: application/json
X-Signature: t=1695371415000,v1=xyz789...

{
  "event": "wellbeing.case.opened",
  "data": {
    "case_id": "wb-1695371415000-abc12",
    "ticket_ref": "TKT-001",
    "mood_score": 3,
    "urgency": "medium"
  },
  "timestamp": "2026-09-22T10:30:15.000Z",
  "idempotency_key": "evt-1695371415000-abc12"
}
```

**Event types:**
- `wellbeing.case.opened` — new case created (by anyone, not just Helpdesk)
- `wellbeing.case.updated` — status/notes changed
- `wellbeing.case.closed` — case resolved

**Response 200:** `{ "ok": true }` (or `{ "ok": true, "replay": true }` if idempotent replay)

**Response 401:** invalid signature
**Response 400:** invalid JSON or missing fields

---

## Field Naming

| Concept | Field name | Type |
|---|---|---|
| Wellbeing case identifier | `case_id` | string (`wb-...`) |
| Helpdesk ticket reference | `ticket_ref` | string (`TKT-...`) |
| Mood score | `mood_score` | integer 1-5 |
| Urgency | `urgency` | `'low' \| 'medium' \| 'high'` |
| Status | `status` | `'open' \| 'in_progress' \| 'closed' \| 'referred'` |
| Notes | `notes` | string |

---

## Error Codes

Standard error envelope:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "human-readable description",
    "details": { "field": "field_name" }
  }
}
```

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid input (bad field, missing required) |
| `INVALID_SIGNATURE` | 401 | HMAC verification failed |
| `NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Duplicate or state conflict |
| `DEGRADED` | 500 | Partner temporarily unavailable |
| `INTERNAL_ERROR` | 500 | Unexpected error |

---

## Rate Limits (proposed)

| Endpoint | Limit |
|---|---|
| POST /v1/cases | 100 req/min per API key |
| Webhook receiver | 1000 events/min (batch later if needed) |

---

## Versioning

API version in URL: `/v1/...`
Breaking changes → `/v2/...`

---

## What Team 16 needs to confirm

1. **Endpoint paths**: `/v1/cases`, `/v1/cases/:id`, `/webhooks/wellbeing`?
2. **Field names**: `case_id`, `ticket_ref`, `urgency`, `status`?
3. **Auth scheme**: HMAC-SHA256 with `t=<ms>,v1=<hex>` header?
4. **Idempotency**: `X-Idempotency-Key` + `idempotency_key` in body?
5. **Event types**: `wellbeing.case.{opened,updated,closed}`?
6. **Status values**: `open`, `in_progress`, `closed`, `referred`?

If any field differs, Team 14 will adapt:
- Header names: 1-line change in `src/lib/hmac.ts`
- Field names: 1-3 lines in `src/lib/wellbeing-sync.ts` + `src/routes/webhooks.ts`
- Event names: 1 switch statement in `processEvent()`

Total adaptation cost: < 30 minutes via `docs/SWAP.md` playbook.

---

## What we agree to

- Replay protection: 5 minute window (configurable)
- Request body MUST be byte-identical between sign and verify (UTF-8, no re-serialization)
- Timestamps in UTC ISO 8601
- Both sides store audit logs

---

*Last updated: 2026-09-21 — Team 14 (Helpdesk)*
