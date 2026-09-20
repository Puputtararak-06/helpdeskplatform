# FRIEND-GUIDE.md — How to Complete A5 Integration

> **สำหรับ:** เพื่อนที่จะทำ A5 ต่อ
> **จาก:** Ratthaphum (Team 14 / Helpdesk)
> **เมื่อ:** หลัง commit + push เสร็จ
> **Deadline:** 22 Sep 2026 23:59
> **เวลาที่ควรใช้:** 3–4 ชั่วโมง (ถ้าคุ้น tools)
> **Repo:** https://github.com/Puputtararak-06/helpdeskplatform.git

---

## TL;DR — 4 phases + 1 parallel

| Phase | เวลา | สิ่งที่ต้องทำ |
|---|---|---|
| 1. Setup | 30 min | Pull repo, ติดตั้ง tools, อ่าน 3 docs สำคัญ |
| 2. Cloudflare keys | 1 hr | **สร้าง account + secrets** (ผมทำไม่ได้) |
| 3. Deploy + test | 1.5 hr | apply migration, deploy mock, run tests |
| 4. Submit | 30 min | auto-collect evidence, ส่งอาจารย์ |
| **5. Team 16 (parallel)** | ongoing | ping Team 16 ขอ contract |

---

## Prerequisites — ติดตั้งก่อนเริ่ม

### Software

```powershell
# 1. Node.js 18+
node --version
# ถ้ายังไม่มี: https://nodejs.org → LTS version

# 2. Git
git --version
# ถ้ายังไม่มี: https://git-scm.com/download/win

# 3. wrangler CLI
npm install -g wrangler
wrangler --version
# ควรเป็น 3.78+ (มี TypeScript + D1 + cron support)
```

### Accounts

- [ ] **Cloudflare account** (free tier พอ) — https://dash.cloudflare.com/sign-up
- [ ] **GitHub access** ที่ https://github.com/Puputtararak-06/helpdeskplatform.git
  - Ratthaphum น่าจะ add เป็น collaborator แล้ว (ถ้ายังไม่มี → add ตอนนี้)

---

## Phase 1: Setup (30 min)

### 1.1 Clone repo

```powershell
cd C:\Users\<your-username>\.openclaw\workspace

# ถ้ายังไม่ clone
git clone https://github.com/Puputtararak-06/helpdeskplatform.git helpdesk-clone
cd helpdesk-clone

# ถ้า clone แล้ว → pull latest
cd helpdesk-clone
git pull
```

### 1.2 ดูภาพรวม

```powershell
cd What-i-can
dir
```

ควรเห็น ~75 ไฟล์

### 1.3 อ่าน 3 docs ก่อน (15 นาที)

**อ่านตามลำดับ:**

1. **`QUICKSTART.md`** — 1 page, "ตื่นมาทำอะไร"
2. **`README.md`** — folder structure
3. **`FINAL_STATUS.md`** — อะไรเสร็จแล้ว, อะไรเหลือ

ถ้ามีเวลามากกว่านั้น:
- `INTEGRATION_PLAN.md` — phases + timeline
- `DEMO.md` — ถ้าจะ demo ให้อาจารย์

### 1.4 Setup env file

```powershell
copy .env.example scripts\.env.json
notepad scripts\.env.json
```

ตอนนี้ใส่ URL ว่างไว้ก่อน จะกลับมาแก้ตอน deploy mock เสร็จ

```json
{
  "wellbeing_url": "",
  "helpdesk_url": ""
}
```

---

## Phase 2: Cloudflare keys (1 ชม. ครั้งแรก)

**ส่วนที่ Ratthaphum ทำไม่ได้ — ต้องเป็นคุณ**

### 2.1 Login

```powershell
wrangler login
```

→ เปิด browser → login Cloudflare → Allow

### 2.2 ดู account info

```powershell
wrangler whoami
```

จดไว้: **Account ID** (UUID ยาวๆ)

### 2.3 ตั้ง workers.dev subdomain (ครั้งแรก)

ถ้ายังไม่มี → wrangler จะถามตอน deploy ครั้งแรก ใส่ชื่อที่ต้องการ เช่น `team14helpdesk`

URL จะออกมาเป็น: `https://<worker-name>.<your-sub>.workers.dev`

### 2.4 Setup mock Worker

```powershell
cd What-i-can\mocks
wrangler init wellbeing-mock --type javascript
```

ตอบ prompt:
- **Type:** `javascript`
- **Use git:** `no`

### 2.5 Copy mock code

1. เปิดไฟล์ `src/index.js` ที่ wrangler init สร้างให้
2. **ลบเนื้อหาทั้งหมด**
3. **Paste เนื้อหาจาก** `What-i-can/mocks/wellbeing-mock-api.mjs`
4. Save as `src/index.js` (หรือ rename เป็น .mjs ตาม main ที่ wrangler.toml ระบุ)

### 2.6 Configure mock wrangler.toml

แก้ไข `wrangler.toml` ใน folder `mocks/`:

```toml
name = "wellbeing-mock"
main = "src/index.js"  # หรือชื่อไฟล์จริง
compatibility_date = "2026-09-01"

[vars]
HELPDESK_WEBHOOK_URL = "https://helpdesk-team14.<YOUR-SUB>.workers.dev/webhooks/wellbeing"
```

(เปลี่ยน `<YOUR-SUB>` เป็น subdomain จริงของคุณ)

### 2.7 สร้าง secret (สำคัญ!)

```powershell
wrangler secret put WELLBEING_MOCK_SECRET
```

ตอบ prompt ใส่:
```
mock-wellbeing-secret-change-me-when-real-team16-ready
```

> **สำคัญ:** Secret นี้ต้องใช้ค่าเดียวกันใน Helpdesk!
> เก็บไว้ใน password manager (1Password, Bitwarden, etc.)
> ถ้าลืม → wrangler secret put ใหม่ทั้ง 2 ฝั่ง

### 2.8 Deploy mock

```powershell
wrangler deploy
```

Output ที่ควรเห็น:
```
Uploaded wellbeing-mock (X.XX sec)
Published wellbeing-mock (X.XX sec)
  https://wellbeing-mock.<YOUR-SUB>.workers.dev
```

**SAVE URL นี้** — จะต้องใช้หลายที่

### 2.9 Verify mock

```powershell
curl https://wellbeing-mock.<YOUR-SUB>.workers.dev/v1/_debug/calls
```

ควรได้ JSON: `{"calls":[],"degraded":false,"count":0}`

ถ้าได้ → mock พร้อม
ถ้า error → รอ 1-2 นาที (SSL cert provision) แล้วลองใหม่

---

## Phase 3: Deploy + test (1.5 ชม.)

### 3.1 Update .env.json

```powershell
notepad What-i-can\scripts\.env.json
```

```json
{
  "wellbeing_url": "https://wellbeing-mock.<YOUR-SUB>.workers.dev",
  "helpdesk_url": "https://helpdesk-team14.<YOUR-SUB>.workers.dev"
}
```

### 3.2 Apply D1 migration

```powershell
cd ..\..   # back to repo root (helpdesk-repo)
wrangler d1 execute helpdesk-db --remote --file=What-i-can/migrations/0005_wellbeing_fields.sql
```

ถ้า error "table already exists" → migration เคย apply แล้ว ข้ามได้

### 3.3 Verify schema

```powershell
node What-i-can/scripts/verify-schema.cjs
```

ควรเห็น ✅ ทุกข้อ

### 3.4 Set Helpdesk secret

```powershell
wrangler secret put WELLBEING_WEBHOOK_SECRET
```

ใส่ secret **เดียวกับ** mock: `mock-wellbeing-secret-change-me-when-real-team16-ready`

### 3.5 Update Helpdesk wrangler.toml

แก้ `wrangler.toml` ที่ root ของ repo:

```toml
# เพิ่มใน [vars]
[vars]
WELLBEING_API_URL = "https://wellbeing-mock.<YOUR-SUB>.workers.dev"
WELLBEING_WEBHOOK_SECRET = "***"  # หรือใช้ wrangler secret put

# เพิ่ม cron trigger
[triggers]
crons = ["*/5 * * * *"]
```

### 3.6 Copy code ไป main Helpdesk app

```powershell
copy What-i-can\src\lib\hmac.ts             src\lib\hmac.ts
copy What-i-can\src\lib\wellbeing-sync.ts    src\lib\wellbeing-sync.ts
copy What-i-can\src\routes\webhooks.ts       src\routes\webhooks.ts
mkdir src\workers 2>nul
copy What-i-can\src\workers\retry-worker.ts src\workers\retry-worker.ts
```

### 3.7 Register webhook route ใน main `src/index.ts`

เปิด `src/index.ts` แล้วเพิ่ม:

```typescript
import { handleWellbeingWebhook } from './routes/webhooks';
import { handleScheduled } from './workers/retry-worker';

// ในไฟล์ main ของคุณ — เพิ่ม route นี้
app.post('/webhooks/wellbeing', handleWellbeingWebhook);

// แก้ default export เดิมเป็น:
export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    await handleScheduled(event, env, ctx);
  },
};
```

### 3.8 Deploy Helpdesk

```powershell
wrangler deploy
```

Output:
```
Published helpdesk-team14 (X.XX sec)
  https://helpdesk-team14.<YOUR-SUB>.workers.dev
```

**SAVE URL นี้**

### 3.9 Run preflight

```powershell
node What-i-can/scripts/preflight.cjs
```

ควรเห็น ✅ ทั้งหมด ถ้าไม่ → ดู `TROUBLESHOOTING.md`

### 3.10 Run integration tests

```powershell
node What-i-can/scripts/run-tests.cjs
```

ควรเห็น `Total: 12 | Passed: 12 | Failed: 0`

ถ้า fail → ดู `test-results/latest-summary.md`

### 3.11 Collect evidence

```powershell
node What-i-can/scripts/collect-evidence.cjs
```

Output:
```
✅ Wrote filled evidence: What-i-can/evidence/A5-Team14-Integration-Evidence-FILLED.md
```

---

## Phase 4: Submit (30 นาที)

### 4.1 Review evidence doc

เปิด `What-i-can/evidence/A5-Team14-Integration-Evidence-FILLED.md`

ตรวจ 6 sections:
- [ ] **1. Consumer Proof** — test 1 response
- [ ] **2. Provider Proof** — test 2 + wrangler tail
- [ ] **3. Webhook Receiver** — tests 3a + 3b
- [ ] **4. Webhook Sender** — test 4 + DB query
- [ ] **5. Idempotency** — same case_id 2 ครั้ง + COUNT=1
- [ ] **6. Degradation** — 6a → 6b → 6c → 6d

### 4.2 Run SQL queries (paste outputs to evidence)

```powershell
wrangler d1 execute helpdesk-db --remote --command "SELECT ticket_ref, wellbeing_record_id, wellbeing_status FROM tickets WHERE wellbeing_record_id IS NOT NULL"
wrangler d1 execute helpdesk-db --remote --command "SELECT event_key, event_type, source, datetime(received_at) FROM webhook_events ORDER BY received_at DESC LIMIT 5"
wrangler d1 execute helpdesk-db --remote --command "SELECT idempotency_key, status, attempts, datetime(sent_at) FROM webhook_outbox ORDER BY created_at DESC LIMIT 5"
```

Copy outputs → paste into evidence Sections 4 and 5

### 4.3 Final verification

```bash
bash What-i-can/scripts/verify-all.sh <YOUR-SUB>
```

ควรเห็น `🎉 All checks passed`

### 4.4 Submit

ส่งอาจารย์:
- Production URL: `https://helpdesk-team14.<YOUR-SUB>.workers.dev`
- Evidence file: `A5-Team14-Integration-Evidence-FILLED.md` (rename เป็น `.pdf` ถ้าต้องการ)
- (optional) GitHub repo URL

**Submit ก่อน 22:00** (1 hr buffer)

---

## Phase 5 (parallel): Ask Team 16

ทำคู่ไปกับ Phase 3-4 เลย — ส่ง message นี้ทันที:

### Message template

```
Subject: A5 Integration — please confirm contract

Hi Team 16,

เรากำลังทำ A5 integration ฝั่ง Team 14 (Helpdesk) ครับ
ก่อน deadline 22 Sep ขอ confirm หรือส่ง:

1. API base URL (production or sandbox)
2. Shared HMAC secret สำหรับ webhook signing
3. Endpoint paths (POST /v1/cases, etc.)
4. Field names (case_id, ticket_ref, urgency, status)
5. Event types (opened/updated/closed?)

ถ้าส่งไม่ทัน เราจะ submit ด้วย mock + อธิบายใน evidence

Detailed spec proposal: ดู CONTRACT_PROPOSAL.md ที่แนบ
Comparison with our mock: ดู CONTRACT_DIFF.md

ขอบคุณครับ
```

### ลำดับความสำคัญของสิ่งที่ขอ

| ลำดับ | Item | ต้องมีไหม? |
|---|---|---|
| 1 | API base URL | Yes — แต่ถ้าไม่มี ใช้ mock |
| 2 | Shared HMAC secret | Yes — แต่ถ้าไม่มี ใช้ mock secret |
| 3 | Endpoint paths | Optional — mock มีครบแล้ว |
| 4 | Field names | Optional — assume mapping |
| 5 | Event types | Optional — mock มี 3 types แล้ว |

### ถ้า Team 16 ตอบกลับ

→ Follow `What-i-can/docs/SWAP.md` (in-place swap ใช้เวลา ~30 นาที)

ถ้า contract ใกล้เคียง → แก้แค่ 2 vars ใน wrangler.toml:
```toml
WELLBEING_API_URL = "<real URL from Team 16>"
WELLBEING_WEBHOOK_SECRET = "<real secret from Team 16>"
```

Deploy ใหม่ → เสร็จ

### ถ้า Team 16 ไม่ตอบ

→ Submit ด้วย mock + อธิบายใน evidence (Section 2 ของ evidence template มี note เรื่องนี้แล้ว)

---

## Emergency — เมื่อติดปัญหา

### 1. เช็คสถานะ

```powershell
# URLs alive?
curl https://helpdesk-team14.<YOUR-SUB>.workers.dev/healthz
curl https://wellbeing-mock.<YOUR-SUB>.workers.dev/v1/_debug/calls

# Mock state
node What-i-can/scripts/inspect-mock.cjs

# Outbox queue
node What-i-can/scripts/inspect-queue.cjs

# Live logs
wrangler tail helpdesk-team14 --format=pretty
```

### 2. ดู docs

- `What-i-can/TROUBLESHOOTING.md` — common errors + fixes
- `What-i-can/FAQ.md` — FAQ
- `What-i-can/docs/RUNBOOK.md` — Day-2 operations

### 3. ติดต่อ Ratthaphum

ส่ง:
- Error message (copy exact)
- Last 30 lines wrangler tail
- คำสั่งที่รัน
- คาดว่าจะเกิดอะไร vs เกิดอะไร

---

## Time budget

| Phase | เวลา | Note |
|---|---|---|
| 1. Setup | 30 min | รวมอ่าน docs |
| 2. Cloudflare keys | 1 ชม. | ครั้งแรก, ครั้งต่อไป 5 นาที |
| 3. Deploy + test | 1.5 ชม. | รวม fix typo |
| 4. Submit | 30 min | |
| **Total** | **~3.5 ชม.** | +1 hr buffer = 4.5 ชม. |

**Recommended completion: 22 Sep 21:00** (3hr buffer ก่อน deadline)

---

## Final checklist

ก่อน submit:
- [ ] Mock deployed + URL works
- [ ] Helpdesk deployed + `/healthz` returns d1:ok
- [ ] All 12 integration tests pass
- [ ] HMAC sanity check passes
- [ ] Schema verified
- [ ] Evidence doc FILLED (6 sections)
- [ ] DB queries pasted
- [ ] Team 16 pinged (even if no response)

ถ้าทุกข้อ ✅ → submit

---

## หลัง submit แล้ว

1. **Submit evidence** to professor
2. **Ping Ratthaphum** บอกว่าเสร็จ (ผมจะนอนใจสบายขึ้น)
3. **Archive mock** ถ้าไม่ต้องการ: `cd What-i-can/mocks && wrangler delete wellbeing-mock`
4. **Integrate code** เข้า main app (ดู `What-i-can/HANDOFF.md`)
5. **Coordinate with Team 16** ถ้าตอบช้า → follow up

---

*ขอบคุณมากที่ช่วย complete A5! 🙏*

*ถ้าติดอะไร ping มาเลย ผมตอบกลับเร็วที่สุด*

*— Ratthaphum (Team 14 Helpdesk)*

*P.S. ถ้าติดปัญหาเวลา 2-3 ข้ามคืน ผมอาจหลับอยู่ — ส่งมาก่อนได้ ผมตอบตอนตื่น*
