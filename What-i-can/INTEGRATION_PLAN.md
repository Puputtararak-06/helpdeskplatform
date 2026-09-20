# Integration Plan — ขั้นตอนพรุ่งนี้

**Deadline:** 22 Sep 2026, 23:59
**เวลาคุณ:** มี ~10 ชม. ตั้งแต่ 09:00 น. (หลังตื่น) → 22:00 (เผื่อ 2 ชม. fix ฉุกเฉิน)

---

## Phase 1 — Setup (30 นาที, 09:00–09:30)

```powershell
cd C:\Users\fluke\.openclaw\workspace\helpdeskplatform-main (1)\helpdesk-repo

# 1. Apply schema migration
wrangler d1 execute helpdesk-db --remote --file=What-i-can/migrations/0005_wellbeing_fields.sql

# 2. Copy code ไป main app
copy What-i-can\src\lib\hmac.ts src\lib\hmac.ts
copy What-i-can\src\lib\wellbeing-sync.ts src\lib\wellbeing-sync.ts
copy What-i-can\src\routes\webhooks.ts src\routes\webhooks.ts
```

**เพิ่มใน `src/index.ts` ของคุณ:**
```ts
import { handleWellbeingWebhook } from './routes/webhooks';
app.post('/webhooks/wellbeing', handleWellbeingWebhook);
```

**เพิ่มใน `wrangler.toml` ของคุณ:**
```toml
[vars]
WELLBEING_API_URL = "https://wellbeing-mock.<your-sub>.workers.dev"
WELLBEING_WEBHOOK_SECRET = "mock-wellbeing-secret-change-me-when-real-team16-ready"

[[d1_databases]]
binding = "DB"
database_name = "helpdesk-db"
database_id = "<existing>"
```

---

## Phase 2 — Deploy Mock (30 นาที, 09:30–10:00)

ดู `MOCK_DEPLOY.md` ทีละขั้น

Deployment ใช้เวลา ~30 วินาที, set secret ใช้เวลา ~1 นาที

**Optional but recommended** — ทดสอบ HMAC ก่อน:
```bash
node What-i-can/scripts/hmac-test.cjs
# ควรเห็น ✅ 7 cases passed
```

---

## Phase 3 — Run Tests (30 นาที, 10:00–10:30) ⚡ เร็วกว่าเดิม 1 ชม.

**อย่าใช้ Postman คลิกเอง** — ใช้ script ที่ผมเตรียมไว้:

```bash
# 1. สร้าง env file
echo '{"wellbeing_url":"https://wellbeing-mock.<your-sub>.workers.dev","helpdesk_url":"https://helpdesk-team14.<your-sub>.workers.dev"}' > What-i-can/scripts/.env.json

# 2. รัน tests ทั้งหมด (12 cases) — ใช้เวลา ~30 วินาที
node What-i-can/scripts/run-tests.cjs

# 3. ดู report
code What-i-can/test-results/latest-summary.md
```

หรือถ้าอยาก local dev:
```powershell
.\What-i-can\scripts\start-dev.ps1
# เปิด mock + helpdesk + debug UI พร้อมกัน
```

ถ้าต้องการ Postman UI (เพื่อ screenshot):
Import `What-i-can/postman/A5-collection.json` เข้า Postman แล้วรันตามลำดับ 12 requests

---

## Phase 4 — Compile Evidence (15 นาที, 13:00–13:15) ⚡

**อัตโนมัติ** — script ทำให้:

```bash
# 1. รันหลังจาก tests เสร็จ
node What-i-can/scripts/collect-evidence.cjs

# 2. เปิดไฟล์ที่ generate
code What-i-can/evidence/A5-Team14-Integration-Evidence-FILLED.md
```

ไฟล์นี้มี:
- Test outputs ทุกตัว (JSON format, ready to paste)
- Summary table (pass/fail count)
- เติม placeholder ทั้งหมดที่ script detect ได้

**สิ่งที่ต้องทำเอง** (5–10 นาที):
- รัน DB queries เพื่อยืนยัน (ดูด้านล่าง)
- เปิด `wrangler tail` log มา paste ใน Section 2 (Provider Proof)
- ใส่ screenshot จาก Postman หรือ debug UI (ถ้าต้องการ)
- ตรวจสอบความครบของ 6 sections

**Database queries ที่ต้องรัน:**
```sql
-- ดู tickets ที่ sync แล้ว
SELECT id, ticket_ref, wellbeing_record_id, wellbeing_status, wellbeing_synced_at
FROM tickets WHERE wellbeing_record_id IS NOT NULL;

-- ดู webhook events ที่รับเข้ามา
SELECT event_key, event_type, source, received_at FROM webhook_events ORDER BY received_at DESC LIMIT 10;

-- ดู outbox (ขาออก)
SELECT idempotency_key, status, attempts, sent_at FROM webhook_outbox ORDER BY created_at DESC LIMIT 10;

-- ตรวจ idempotency
SELECT COUNT(*) AS rows FROM webhook_outbox WHERE idempotency_key = 'ticket-TKT-005-case';
-- Expected: 1
```

---

## Phase 5 — Polish + Submit (1 ชม., 21:00–22:00)

- Format evidence doc (Markdown → PDF ผ่าน Pandoc หรือ VS Code)
- Final review: ทุก 6 sections ครบ?
- Submit ก่อน **23:00** เผื่อ 1 ชม. emergency

---

## ⚠️ Rollback plan

ถ้า integration fail ที่ phase ใดก็ตาม:
- ไฟล์อยู่ใน `What-i-can/` — main app ไม่ถูกแตะ
- Revert migration:
  ```sql
  ALTER TABLE tickets DROP COLUMN wellbeing_record_id;
  ALTER TABLE tickets DROP COLUMN wellbeing_status;
  ALTER TABLE tickets DROP COLUMN wellbeing_synced_at;
  ALTER TABLE tickets DROP COLUMN wellbeing_webhook_secret;
  DROP TABLE IF EXISTS webhook_events;
  DROP TABLE IF EXISTS webhook_outbox;
  ```
- Production ไม่กระทบ

---

## ถ้าติดปัญหา

บอกผม — ผมอ่าน workspace ได้ (tested แล้ว) ช่วย debug ได้ทันที
