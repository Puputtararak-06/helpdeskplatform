# Contract Diff — Mock vs Likely Real Team 16 API

> **Purpose:** Predict where Team 16's actual API might differ from our mock
> **When to use:** When Team 16 sends their real contract — compare and adapt

---

## Likely Differences (and our fallback plan)

### 1. URL prefix

| Mock | Real (predicted) | Action |
|---|---|---|
| `/v1/cases` | `/v1/cases` or `/api/cases` or `/wellbeing/v1/cases` | Change 1 line in mock + Helpdesk |
| `/webhooks/wellbeing` | `/webhooks/wellbeing` or `/api/webhooks/wellbeing` | Update Helpdesk receiver route |
| `/internal/trigger-webhook` | Not applicable (mock-only) | N/A |

**Adaptation:** Update paths in `src/lib/wellbeing-sync.ts` + `src/routes/webhooks.ts`

---

### 2. Auth scheme

| Mock | Real possibilities | Adaptation cost |
|---|---|---|
| HMAC-SHA256 + shared secret | (a) HMAC (same) — low effort | 0 lines |
| | (b) JWT (RS256) | Replace `hmac.ts` with JWT verify (~50 lines) |
| | (c) OAuth2 + Bearer | ~30 lines + token refresh logic |
| | (d) mTLS (cert pinning) | High complexity — recommend mock |

**Most likely:** HMAC remains for webhooks (industry standard); JWT for user-facing API

---

### 3. Header names

| Mock | Real possibilities | Adaptation |
|---|---|---|
| `X-Signature: t=<ms>,v1=<hex>` | Same | 0 lines |
| | `X-Webhook-Signature: sha256=<hex>` (Stripe-style) | Update `src/lib/hmac.ts` |
| | `Authorization: HMAC <hex>` | Update `src/lib/hmac.ts` |
| `X-Idempotency-Key` | Same | 0 lines |
| | `Idempotency-Key` (no X- prefix) | Update `src/lib/wellbeing-sync.ts` |
| | `X-Request-Id` (UUID, not business key) | Different pattern |

---

### 4. Payload field names

| Concept | Mock | Real possibilities | Adaptation |
|---|---|---|---|
| Case ID | `case_id` | same / `id` / `wb_id` | 1 line per occurrence |
| Ticket ref | `ticket_ref` | same / `external_id` / `helpdesk_id` | 1 line |
| Urgency | `urgency: low/medium/high` | same / `priority` / `severity` | Field + enum values |
| Status | `status: open/in_progress/closed/referred` | same / different enum names | Map values |
| Mood | `mood_score: 1-5` | same / `mood` / `rating` | 0-1 line |

**Recommendation:** If Team 16 uses different names, create a translation layer:
```ts
// src/lib/wellbeing-sync.ts
const urgencyMap = { low: 'low', medium: 'normal', high: 'urgent' };  // adapt to their enum
const translatedUrgency = urgencyMap[ourUrgency] || ourUrgency;
```

---

### 5. Response envelope

| Mock | Real possibilities | Adaptation |
|---|---|---|
| `201 { case_id, status, ... }` | same / `{ data: {...} }` / `{ result: {...} }` | Wrap/unwrap in sync code |
| Error: `{ error: { code, message, details } }` | same / `{ error: "...", code: "..." }` | Update error handling |

---

### 6. Webhook event structure

| Mock | Real possibilities |
|---|---|
| `{ event, data, timestamp, idempotency_key }` | Usually same |
| Event types: `wellbeing.case.{opened,updated,closed}` | Team 16 might add more (e.g., `.assigned`, `.escalated`) |
| Payload in `data` | Some APIs put everything at top level |

**Adaptation:** Update `src/types/events.ts` + `processEvent()` switch in `src/routes/webhooks.ts`

---

### 7. Idempotency behavior

| Mock | Real possibilities |
|---|---|
| Same key → cached response with `X-Idempotent-Replay: true` | Same / different header name / different status |
| | Some APIs return 409 instead of replay |
| TTL: forever (in-memory) | Real APIs usually 24h TTL |

**Adaptation:** Update verification logic + adjust timeout

---

### 8. Rate limits

| Mock | Real |
|---|---|
| None | Probably 60-100 req/min |
| | 429 Too Many Requests + Retry-After header |

**Adaptation:** Add rate limit handling in `wellbeing-sync.ts`:
```ts
if (result.status === 429) {
  const retryAfter = result.headers.get('Retry-After') || '60';
  // Re-queue with longer delay
}
```

---

### 9. Error semantics

| Mock | Real |
|---|---|
| `400 VALIDATION_ERROR` for bad fields | same |
| `500 DEGRADED` for `/v1/_debug/break` | Real API may return different errors |
| Always JSON error envelope | Real APIs may return HTML error pages sometimes |

---

### 10. Versioning strategy

| Mock | Real |
|---|---|
| `/v1/...` | Could be `/v2/...` or no versioning |
| Breaking change = new path | Real APIs may use header versioning (`Accept: application/vnd.wellbeing.v2+json`) |

---

## Highest-Risk Differences (top 3 to ask Team 16 first)

1. **Auth scheme** — biggest code change if different from HMAC
2. **Field names** — affects every request/response
3. **Webhook event types** — affects event processing

## Lowest-Risk Differences (won't break much)

1. URL path (just 1-2 line change)
2. Header names (config update)
3. Response envelope wrapping (unwrap code change)

---

## Verification Process

When Team 16 delivers contract:

```bash
# 1. Save their OpenAPI spec / docs to docs/team16-contract/
cp ~/Downloads/wellbeing-api.yaml docs/team16-contract/

# 2. Run diff
diff -u mocks/wellbeing-mock-api.mjs docs/team16-contract/wellbeing-api.yaml | head -100
# (manual review)

# 3. Update What-i-can/src/lib/wellbeing-sync.ts + src/routes/webhooks.ts

# 4. Update mock to match (so tests stay valid):
#    Either:
#    a) Modify mocks/wellbeing-mock-api.mjs to call Team 16 directly (remove mock)
#    b) Keep mock as a fixture for testing edge cases
```

---

## What we hold firm on

These are non-negotiable from Team 16 (if they want integration):

1. **Webhook events with timestamps** — for replay protection
2. **Idempotency mechanism** — to prevent duplicate processing
3. **Some form of authentication** — even if not HMAC (security requirement)
4. **Predictable error format** — to handle programmatically

---

## Decision matrix when Team 16 responds

| Difference | Effort | Decision |
|---|---|---|
| Same field names | 0 | Swap URL + secret, done |
| Different field names but same semantic | 30 min | Add translation layer |
| Different auth scheme | 2-4 hours | Negotiate — prefer HMAC if possible |
| Missing idempotency | 1 hour | Add client-side idempotency |
| Different webhook payload shape | 1-2 hours | Update `processEvent()` + types |
| Different URL structure | 30 min | Update paths |
| Different event types | 1 hour | Map to our handlers |

---

*Document prepared 2026-09-21 by Team 14 (Helpdesk)*
