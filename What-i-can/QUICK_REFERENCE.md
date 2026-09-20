# Quick Reference Card — A5 Integration

> **Print this page or save as PDF for quick reference during deploy**

---

## 🚀 5 commands to deploy (total ~15 min)

```bash
# 1. Apply migration (5 min)
wrangler d1 execute helpdesk-db --remote --file=What-i-can/migrations/0005_wellbeing_fields.sql

# 2. Deploy mock (5 min)
cd What-i-can/mocks
wrangler init wellbeing-mock --type javascript
# paste content of wellbeing-mock-api.mjs as src/index.mjs
wrangler secret put WELLBEING_MOCK_SECRET
# type: mock-wellbeing-secret-change-me-when-real-team16-ready
wrangler deploy
# → copy URL https://wellbeing-mock.YOUR-SUB.workers.dev

# 3. Copy code to main app (2 min)
cd ../..
copy What-i-can\src\lib\hmac.ts             src\lib\hmac.ts
copy What-i-can\src\lib\wellbeing-sync.ts    src\lib\wellbeing-sync.ts
mkdir src\routes 2>nul & copy What-i-can\src\routes\webhooks.ts    src\routes\webhooks.ts
mkdir src\workers 2>nul & copy What-i-can\src\workers\retry-worker.ts src\workers\retry-worker.ts

# 4. Update wrangler.toml + main src/index.ts (2 min)
# Add [vars] WELLBEING_API_URL + WELLBEING_WEBHOOK_SECRET
# Add [triggers] crons = ["*/5 * * * *"]
# Add webhook route import + registration

# 5. Deploy Helpdesk + verify (2 min)
wrangler deploy
node What-i-can/scripts/preflight.cjs
```

---

## 🧪 3 commands to test

```bash
# Auto-run all 12 tests
node What-i-can/scripts/run-tests.cjs

# Auto-fill evidence doc
node What-i-can/scripts/collect-evidence.cjs

# Open filled evidence
code What-i-can/evidence/A5-Team14-Integration-Evidence-FILLED.md
```

---

## 🔑 Environment variables

```toml
# Helpdesk wrangler.toml
[vars]
WELLBEING_API_URL = "https://wellbeing-mock.YOUR-SUB.workers.dev"
WELLBEING_WEBHOOK_SECRET = "<shared secret>"
```

```bash
# Mock secrets
wrangler secret put WELLBEING_MOCK_SECRET
# Mock wrangler.toml [vars]
HELPDESK_WEBHOOK_URL = "https://helpdesk-team14.YOUR-SUB.workers.dev/webhooks/wellbeing"
```

---

## 📋 6 evidence categories checklist

- [x] Consumer Proof — test 1 (POST /v1/cases)
- [x] Provider Proof — test 2 (mock triggers webhook)
- [x] Webhook Receiver — test 3a (401), 3b (200)
- [x] Webhook Sender — test 4 (Helpdesk → POST /v1/cases)
- [x] Idempotency — test 5 (first), 5b (replay)
- [x] Degradation — tests 6a (break), 6b (fail), 6c (heal), 6d (recover)

---

## 🚨 If something breaks

| Symptom | Fix |
|---|---|
| 401 invalid signature | Check `WELLBEING_WEBHOOK_SECRET` matches in both apps |
| 404 on webhook receiver | Register route: `app.post('/webhooks/wellbeing', handleWellbeingWebhook)` |
| Mock degraded | `curl -X POST $MOCK_URL/v1/_debug/heal` |
| Cron not running | Check `wrangler.toml` has `[triggers] crons` |
| Schema missing | Re-run `0005_wellbeing_fields.sql` |
| HMAC mismatch | Run `node scripts/hmac-test.cjs` |

---

## ⏱️ Timeline (Sep 21, ~02:00 AM)

| Time | What |
|---|---|
| 02:00 - 02:30 | ✓ Wrote all docs, code, scripts |
| (sleep) | |
| 09:00 - 11:00 | Deploy mock + apply migration + copy code |
| 11:00 - 13:00 | Run preflight + tests + collect evidence |
| 13:00 - 15:00 | Fill remaining sections + DB queries |
| 15:00 - 17:00 | Buffer / sleep |
| 17:00 - 22:00 | Final review + submit |

---

## 📞 Emergency contacts

- Stuck on Cloudflare? → https://www.cloudflarestatus.com/
- Stuck on code? → re-read What-i-can/TROUBLESHOOTING.md
- Stuck on tests? → run `node What-i-can/scripts/preflight.cjs`

---

*Keep this card open in another tab during deploy*
