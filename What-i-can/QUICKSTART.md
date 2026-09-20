# QUICKSTART — 1 page

> **Deadline: 22 Sep 2026 23:59**
> **เวลาที่คุณมี:** ~10 ชม. พรุ่งนี้ (09:00-22:00)

---

## ⏰ ตื่นมา 09:00 — 5 ขั้นจบ 11:00

### 1. Apply migration (5 นาที)

```powershell
cd C:\Users\fluke\.openclaw\workspace\helpdeskplatform-main (1)\helpdesk-repo
wrangler d1 execute helpdesk-db --remote --file=What-i-can\migrations\0005_wellbeing_fields.sql
```

### 2. Deploy mock (10 นาที)

```powershell
cd What-i-can\mocks
wrangler init wellbeing-mock --type javascript
# replace src/index.js with content from wellbeing-mock-api.mjs (rename to .mjs)
# add to wrangler.toml: HELPDESK_WEBHOOK_URL pointing to your Helpdesk
wrangler secret put WELLBEING_MOCK_SECRET
# paste: mock-wellbeing-secret-change-me-when-real-team16-ready
wrangler deploy
# → copy URL: https://wellbeing-mock.<subdomain>.workers.dev
```

### 3. Copy code + register (10 นาที)

```powershell
cd ..\..
copy What-i-can\src\lib\hmac.ts             src\lib\hmac.ts
copy What-i-can\src\lib\wellbeing-sync.ts    src\lib\wellbeing-sync.ts
copy What-i-can\src\routes\webhooks.ts       src\routes\webhooks.ts
mkdir src\workers
copy What-i-can\src\workers\retry-worker.ts src\workers\retry-worker.ts
```

Add to your main `src/index.ts`:
```ts
import { handleWellbeingWebhook } from './routes/webhooks';
import { handleScheduled } from './workers/retry-worker';
app.post('/webhooks/wellbeing', handleWellbeingWebhook);
export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) { await handleScheduled(event, env, ctx); },
};
```

Add to `wrangler.toml`:
```toml
[vars]
WELLBEING_API_URL = "https://wellbeing-mock.<your-sub>.workers.dev"
WELLBEING_WEBHOOK_SECRET = "mock-wellbeing-secret-change-me-when-real-team16-ready"
[triggers]
crons = ["*/5 * * * *"]
```

Deploy Helpdesk: `wrangler deploy`

### 4. Run preflight + tests (15 นาที)

```powershell
# Create env file
$env:wellbeing_url="https://wellbeing-mock.<your-sub>.workers.dev"
$env:helpdesk_url="https://helpdesk-team14.<your-sub>.workers.dev"
'{"wellbeing_url":"' + $env:wellbeing_url + '","helpdesk_url":"' + $env:helpdesk_url + '"}' | Out-File What-i-can\scripts\.env.json -Encoding utf8

# Preflight check
node What-i-can\scripts\preflight.cjs
# Should see all ✅

# Run all 12 tests
node What-i-can\scripts\run-tests.cjs
# → generates test-results/latest-summary.md
code What-i-can\test-results\latest-summary.md
```

### 5. Collect evidence (15 นาที)

```powershell
node What-i-can\scripts\collect-evidence.cjs
code What-i-can\evidence\A5-Team14-Integration-Evidence-FILLED.md
```

ไฟล์นี้มี test outputs ครบ + summary table + appendix

---

## 🕐 บ่าย 13:00 — fill in 4 sections ที่เหลือ

Script auto-fill ทำได้แล้ว 6/6 — สิ่งที่ต้องทำเอง:

| Section | ต้องเพิ่มอะไร | ใช้เวลา |
|---|---|---|
| 2 (Provider) | `wrangler tail` log ตอน test 2 | 5 นาที |
| 3 (Receiver) | screenshot test 3a (401) | 5 นาที |
| 4 (Sender) | DB query outbox status='sent' | 5 นาที |
| 6 (Degradation) | screenshot test 6a-d | 10 นาที |

**คำสั่ง SQL:**
```sql
-- Webhook events ที่รับเข้ามา
SELECT event_key, event_type, source, received_at FROM webhook_events ORDER BY received_at DESC LIMIT 5;

-- Outbox ที่ส่งออก
SELECT idempotency_key, status, attempts, sent_at FROM webhook_outbox ORDER BY created_at DESC LIMIT 5;

-- Tickets ที่ sync แล้ว
SELECT id, ticket_ref, wellbeing_record_id, wellbeing_status FROM tickets WHERE wellbeing_record_id IS NOT NULL;
```

---

## 🕖 เย็น 21:00 — Submit

- เปิด `A5-Team14-Integration-Evidence-FILLED.md`
- ตรวจ 6 sections ครบ
- รัน final check ตาม `DEPLOY_CHECKLIST.md`
- Submit ก่อน **23:00**

---

## 🆘 ติดปัญหา?

```powershell
# ดูสถานะปัจจุบัน
node What-i-can\scripts\preflight.cjs

# ดู log จริง
wrangler tail helpdesk-team14 --format=pretty

# เปิด troubleshooting
code What-i-can\TROUBLESHOOTING.md
```

**หรือถามผม** — ส่ง error message + last 20 lines wrangler tail มา
