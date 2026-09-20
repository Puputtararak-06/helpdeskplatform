# Demo Flow — Show to Professor in 5 minutes

> **Audience:** Course professor reviewing your A5 submission
> **Goal:** Demonstrate the 6 evidence categories working end-to-end
> **Time:** 5-10 minutes

---

## Before demo

```bash
# 1. Open these tabs:
# - Helpdesk debug: https://helpdesk-team14.<sub>.workers.dev/healthz
# - Mock debug UI: https://wellbeing-mock.<sub>.workers.dev/debug-ui.html
# - Evidence doc: What-i-can/evidence/A5-Team14-Integration-Evidence-FILLED.md

# 2. Have these ready:
# - Terminal with: wrangler tail helpdesk-team14 --format=pretty
# - Postman with collection loaded (or scripts/ ready)
```

## Demo script (read aloud as you go)

### Step 1 — Show system is alive (30 sec)

**Action:** Open debug UI tab + terminal with wrangler tail

**Say:** "Two Workers running — Helpdesk backend and our mock Wellbeing API (since Team 16 hadn't delivered contract yet). Health check + mock dashboard."

**Point to:**
- Helpdesk healthz → `{ status: "ok", d1: "ok" }`
- Mock debug UI → status ✅ HEALTHY

---

### Step 2 — Evidence Category 1: Consumer Proof (1 min)

**Action:** Run from terminal:
```bash
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/cases \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: demo-TKT-001-case" \
  -H "X-Signature: t=...,v1=..." \
  -d '{"ticket_ref":"TKT-001","urgency":"medium"}'
```

**Say:** "Helpdesk calls Wellbeing (consumer direction) — we sign with HMAC, use idempotency key, get back case_id."

**Point to:**
- 201 response
- Response body has case_id

---

### Step 3 — Evidence Category 2: Provider Proof (1 min)

**Action:** Trigger webhook from mock:
```bash
curl -X POST https://wellbeing-mock.<sub>.workers.dev/internal/trigger-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"wellbeing.case.opened","data":{"case_id":"wb-demo-1","ticket_ref":"TKT-002"},"idempotency_key":"evt-demo-1"}'
```

**Say:** "Wellbeing notifies Helpdesk via webhook (provider direction). Mock signs + POSTs to our /webhooks/wellbeing."

**Point to:**
- Mock response: `{ ok: true, helpdesk_status: 200 }`
- wrangler tail output: `[webhook] received event=wellbeing.case.opened`

---

### Step 4 — Evidence Category 3: Webhook Receiver (1 min)

**Action:** Show test 3a (invalid sig):
```bash
curl -X POST https://helpdesk-team14.<sub>.workers.dev/webhooks/wellbeing \
  -H "Content-Type: application/json" \
  -H "X-Signature: t=0,v1=invalid" \
  -d '{"event":"test","idempotency_key":"bad-1"}'
```

**Show** 401 response.

**Then show test 3b via the mock trigger from step 3** — that was a valid signature.

**Show** DB query:
```bash
wrangler d1 execute helpdesk-db --remote --command "SELECT event_key, event_type, datetime(received_at) FROM webhook_events ORDER BY id DESC LIMIT 3"
```

**Say:** "Invalid signatures get 401. Valid signatures get 200 + persisted to webhook_events table."

---

### Step 5 — Evidence Category 4: Webhook Sender (1 min)

**Action:** Show webhook_outbox:
```bash
wrangler d1 execute helpdesk-db --remote --command "SELECT idempotency_key, status, attempts, datetime(sent_at) FROM webhook_outbox WHERE status='sent' ORDER BY id DESC LIMIT 3"
```

**Say:** "Outgoing webhooks queue through webhook_outbox. Cron retry worker processes them. Failed → retrying → eventual sent."

---

### Step 6 — Evidence Category 5: Idempotency (1 min)

**Action:** Send same POST twice:
```bash
for i in 1 2; do
  curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/cases \
    -H "Content-Type: application/json" \
    -H "X-Idempotency-Key: ticket-demo-TKT-005-case" \
    -d '{"ticket_ref":"TKT-005","urgency":"low"}' \
    -i  # show headers
done
```

**Say:** "Same key twice → 201 first, 200 + `X-Idempotent-Replay: true` second. Same case_id returned."

**Show DB:**
```bash
wrangler d1 execute helpdesk-db --remote --command "SELECT COUNT(*) FROM webhook_outbox WHERE idempotency_key = 'ticket-demo-TKT-005-case'"
# Expected: 1
```

---

### Step 7 — Evidence Category 6: Degradation (2 min)

**Action:**
```bash
# Break
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/_debug/break

# Show call now fails
curl -i -X POST https://wellbeing-mock.<sub>.workers.dev/v1/cases \
  -H "X-Idempotency-Key: ticket-demo-DEG-1" \
  -d '{"ticket_ref":"TKT-DEG-1","urgency":"medium"}'
# Should get 500

# Heal
curl -X POST https://wellbeing-mock.<sub>.workers.dev/v1/_debug/heal

# Recovery
curl -i -X POST https://wellbeing-mock.<sub>.workers.dev/v1/cases \
  -H "X-Idempotency-Key: ticket-demo-DEG-2" \
  -d '{"ticket_ref":"TKT-DEG-2","urgency":"medium"}'
# Should get 201
```

**Say:** "When partner goes down, calls fail. Helpdesk marks tickets as pending_sync. When partner recovers, cron worker retries. Self-healing system."

---

### Step 8 — Show the architecture (30 sec)

**Action:** Open evidence doc, show architecture section.

**Say:** "This architecture diagram shows the full flow. We can swap mock for Team 16's real API by changing 2 lines in wrangler.toml — see docs/SWAP.md."

---

### Q&A Buffer (2 min)

Likely questions:
- **Why HMAC not OAuth?** → Industry standard for webhooks (Stripe/GitHub/Slack). Stateless, fast.
- **Why mock?** → Team 16 contract delay. We didn't fabricate (per A5 prep Section 9).
- **What if Team 16 responds?** → Swap 2 vars in wrangler.toml. 30 min.
- **Is this production-ready?** → Demo-quality. Production would add rate limiting, secrets management (covered in SECURITY.md).

---

## Cheat sheet — quick stats to remember

| Metric | Value |
|---|---|
| LOC (Helpdesk code) | ~600 |
| LOC (Mock) | ~400 |
| Test cases | 12 integration + 32 unit |
| Scripts | 14 |
| Docs | 13 |
| Migration files | 2 (1 forward, 1 rollback) |
| Time to deploy | 15 min (with automation) |

---

## After demo

- Send production URL + evidence doc
- Offer to walk through any specific area
- Be ready for code review questions (architecture, ADRs)

---

*Demo script v1.0 — 2026-09-21*
