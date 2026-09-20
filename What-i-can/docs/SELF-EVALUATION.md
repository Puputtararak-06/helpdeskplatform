# A5 Self-Evaluation — Check Against Grading Criteria

> ตรวจตัวเองก่อน submit ว่าครบทุก requirement
> Run: `node What-i-can/scripts/preflight.cjs` + check list นี้ก่อนส่ง

---

## A5 Evidence Categories — Required Content

### 1. Consumer Proof (Helpdesk → Team 16)
- [x] Partner URL (mock URL acceptable)
- [x] Request timestamp (in ISO 8601 UTC)
- [x] Response body captured
- [x] Evidence: test 1 output + screenshot/curl

### 2. Provider Proof (Team 16 → Helpdesk)
- [x] Your endpoint URL: `https://helpdesk-team14.<sub>.workers.dev/webhooks/wellbeing`
- [x] Internal request log (from `wrangler tail`)
- [x] Partner confirmation (test 2 response from mock)
- [x] Evidence: wrangler tail output

### 3. Webhook Receiver
- [x] Incoming payload shown
- [x] Secret verification result:
  - Test 3a: invalid sig → 401
  - Test 3b: valid sig → 200
- [x] Stored log: webhook_events table row
- [x] Evidence: 3a + 3b responses + DB query result

### 4. Webhook Sender
- [x] Internal trigger action (test 4)
- [x] Outgoing payload with HMAC signature
- [x] Partner response log (webhook_outbox row)
- [x] Evidence: test 4 response + outbox query

### 5. Idempotency Proof
- [x] Req 1 vs Req 2 with same key
- [x] DB proof of single creation (`COUNT(*) = 1`)
- [x] Mock response shows `X-Idempotent-Replay: true`
- [x] Evidence: tests 5 + 5b

### 6. Degradation Proof
- [x] Breakage timestamp (`/v1/_debug/break`)
- [x] Fallback JSON output (Helpdesk returns 200 with `wellbeing_status='pending_sync'`)
- [x] Automatic recovery log (cron retry worker restores)
- [x] Evidence: tests 6a-d + wrangler tail + DB query

---

## Additional Quality Markers

### Architecture documentation
- [x] System architecture diagram (in evidence doc)
- [x] Data flow explanation
- [x] Component responsibilities

### Security
- [x] HMAC-SHA256 signature verification
- [x] Replay protection (5-minute window)
- [x] Timestamp validation
- [x] Constant-time comparison (prevents timing attacks)
- [x] Shared secret handling (env vars, not hardcoded)

### Reliability
- [x] Idempotency (X-Idempotency-Key + idempotency_key in body)
- [x] Retry mechanism (cron-triggered worker)
- [x] Exponential awareness (max 5 attempts)
- [x] Status tracking (pending, retrying, sent, failed)
- [x] Outbox pattern (durable queue)

### Code quality
- [x] TypeScript strict mode
- [x] Error envelope consistency
- [x] Parameterized SQL (no injection)
- [x] Modular design (easy to swap mock → real)
- [x] Comprehensive comments
- [x] Type definitions for shared contracts

### Testing
- [x] Unit-style test for HMAC (`hmac-test.cjs`)
- [x] Integration test via Postman collection (12 cases)
- [x] Auto-runner for tests
- [x] Auto-collector for evidence
- [x] Load test capability
- [x] Schema verification

### Documentation
- [x] README with structure
- [x] Quick start guide
- [x] Integration plan with phases
- [x] Integration code snippet
- [x] Deploy checklist
- [x] Troubleshooting guide
- [x] FAQ
- [x] Swap playbook
- [x] Sample payloads

---

## What may get partial credit (be honest about)

| Item | Status | Mitigation |
|---|---|---|
| Real Team 16 integration | ❌ Mock used | Documented in evidence notes — explained why |
| Multiple webhook event types | ⚠️ Only `opened`, `updated`, `closed` implemented | Can extend if Team 16 requires more |
| Real JWT/OAuth | ❌ HMAC used | Documented rationale (HMAC is standard for webhooks) |
| Stress test (1000+ req/s) | ⚠️ Test script provided, not run | Can run on-demand |

---

## What we did WELL

1. **Didn't fabricate Team 16 contract** — explicit per Section 9 of A5 prep doc
2. **Mock-driven development** — could work in parallel, not blocked
3. **Production-quality retry logic** — not just demo code
4. **Comprehensive tooling** — preflight, load test, schema verify, etc.
5. **Documentation depth** — FAQ, swap playbook, troubleshooting
6. **Idempotency in both directions** — outgoing + incoming
7. **TypeScript strict types** — catches bugs at compile time

---

## What to mention in evidence "Reflection" section

- Mock-driven dev saved time
- HMAC vs OAuth trade-off for webhooks
- Idempotency as core design pattern
- Retry queue + cron for resilience
- Modular design enables quick swap
- TypeScript types document the contract

---

## Pre-submission final check

Run these in order:

```bash
# 1. All tests pass
node What-i-can/scripts/run-tests.cjs
# Expected: 12/12 passed

# 2. Schema correct
node What-i-can/scripts/verify-schema.cjs
# Expected: all checks pass

# 3. Preflight clean
node What-i-can/scripts/preflight.cjs
# Expected: 6/6 passed

# 4. Evidence file complete
cat What-i-can/evidence/A5-Team14-Integration-Evidence-FILLED.md | grep -c "Section"
# Expected: 6 (one per category)

# 5. No placeholder left
grep "_paste" What-i-can/evidence/A5-Team14-Integration-Evidence-FILLED.md
# Expected: empty (all replaced)

# 6. URLs accessible from public internet
curl https://helpdesk-team14.<sub>.workers.dev/healthz
# Expected: 200 OK

curl https://wellbeing-mock.<sub>.workers.dev/v1/_debug/calls
# Expected: 200 + JSON
```

If all 6 checks pass → submit ✅

---

## After submission

1. Document lessons learned (1 paragraph) for future iterations
2. If Team 16 responds later, follow `docs/SWAP.md`
3. Archive evidence to shared drive / Git
4. Brief team in next standup

---

*Self-evaluation by Team 14 (Helpdesk) — 2026-09-21*
