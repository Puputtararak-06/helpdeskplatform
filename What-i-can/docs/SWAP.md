# SWAP.md — Pivot from Mock to Real Team 16 API

> **When:** Team 16 delivers their actual contract (URL + secret + shape)
> **Time required:** ~30 minutes
> **Risk:** Low — designed for 1-line config change

---

## Background

เราใช้ mock เพราะ Team 16 ส่ง contract ไม่ทัน พอ Team 16 พร้อม เราแค่เปลี่ยน config 2 ค่าใน `wrangler.toml` ไม่ต้องแก้ code เลย

---

## Step 1 — Verify contract compatibility (5 นาที)

เปรียบเทียบ contract ที่ Team 16 ส่งมากับ mock contract ของเรา

**Check fields:**
- [ ] Create case endpoint: `POST /v1/cases`
- [ ] Request body: `{ ticket_ref, urgency }`?
- [ ] Response body: `{ case_id, status, urgency, ticket_ref, created_at }`?
- [ ] HMAC header format: `X-Signature: t=<ms>,v1=<hex>`?
- [ ] Idempotency: `X-Idempotency-Key` header?
- [ ] Event types: `wellbeing.case.opened`, `.updated`, `.closed`?

**ต่างจาก mock?** → ปรับ:
- Header name ใน `src/lib/hmac.ts` + `src/lib/wellbeing-sync.ts` + `src/routes/webhooks.ts`
- Field names ใน `src/types/events.ts`
- Event type names ที่เรา handle

---

## Step 2 — รับ secret จาก Team 16 (5 นาที)

ขอจาก Team 16:
- Production URL: `https://api.wellbeing.mfu.ac.th` (or whatever)
- Shared secret: 32+ random chars (เช่น `openssl rand -hex 32`)

**Verify** ผ่าน secure channel (1Password, encrypted email, face-to-face) — **ไม่** paste ใน LINE

---

## Step 3 — Update Helpdesk `wrangler.toml` (2 นาที)

```toml
[vars]
# OLD (mock):
# WELLBEING_API_URL = "https://wellbeing-mock.<your-sub>.workers.dev"
# WELLBEING_WEBHOOK_SECRET = "mock-wellbeing-secret-change-me-when-real-team16-ready"

# NEW (real Team 16):
WELLBEING_API_URL = "https://api.wellbeing.mfu.ac.th"
WELLBEING_WEBHOOK_SECRET = "<actual secret from Team 16>"
```

---

## Step 4 — Redeploy Helpdesk (1 นาที)

```powershell
cd C:\Users\fluke\.openclaw\workspace\helpdeskplatform-main (1)\helpdesk-repo
wrangler deploy
```

---

## Step 5 — Verify with preflight (2 นาที)

```powershell
# Update env.json to point at real API
$env:wellbeing_url = "https://api.wellbeing.mfu.ac.th"
'{"wellbeing_url":"' + $env:wellbeing_url + '","helpdesk_url":"https://helpdesk-team14.<your-sub>.workers.dev"}' | Out-File What-i-can\scripts\.env.json -Encoding utf8

# Run preflight
node What-i-can\scripts\preflight.cjs
```

ต้องเห็น:
```
✅ Mock URL responds            (or "Helpdesk /healthz responds")
✅ Helpdesk /healthz responds
✅ Helpdesk webhook endpoint exists
✅ Mock can sign with secret (sender path)
```

ถ้า "Mock can sign with secret" fail → secret mismatch → re-check Team 16's secret

---

## Step 6 — Run full test suite (5 นาที)

```powershell
node What-i-can\scripts\run-tests.cjs
```

ดู `test-results/latest-summary.md` ต้องผ่านทั้งหมด หรือแจ้ง Team 16 ถ้าเคสไหน fail

---

## Step 7 — Stop the mock (optional, 1 นาที)

ถ้าไม่ต้องการใช้ mock อีก:
```powershell
cd What-i-can\mocks
wrangler delete
```

หรือปล่อยไว้เป็น backup / dev environment

---

## Edge cases

### Case A: Team 16's API ไม่ตรงกับ contract

ถ้า field names ต่าง:
```ts
// src/lib/wellbeing-sync.ts — แก้ตรงนี้
body: {
  ticket_id: ticketRef,  // เปลี่ยน ticket_ref เป็น ticket_id ตาม Team 16
  urgency_level: urgency,  // เปลี่ยน urgency เป็น urgency_level
}
```

### Case B: Auth ไม่ใช่ HMAC

ถ้า Team 16 ใช้ Bearer token:
```ts
// src/lib/wellbeing-sync.ts
headers: {
  'Authorization': `Bearer ${token}`,  // แทน X-Signature
}
```

อาจต้องเปลี่ยน `src/routes/webhooks.ts` ให้ verify Bearer แทน HMAC

### Case C: Different signature scheme

ถ้า Team 16 ส่งใน body แทน header:
```ts
body: {
  payload: data,
  signature: computedSig,  // แทน X-Signature header
}
```

ปรับ `computeHmac()` ใน `hmac.ts` ตามสเปค

### Case D: ไม่มี idempotency

ถ้า Team 16 ไม่รองรับ idempotency key:
- ใช้ timestamp + ticket_ref เป็น unique key
- เสี่ยง duplicate — แต่มี receiver idempotency ช่วย

---

## Validation checklist (ก่อน assume swap สำเร็จ)

- [ ] ทุก test ใน Postman pass
- [ ] DB มี webhook events ที่ signature verify ผ่าน
- [ ] ไม่มี `invalid_signature` ใน wrangler tail
- [ ] ticket ที่ sync สำเร็จ — `wellbeing_record_id` ครบ
- [ ] webhook_outbox ทุก row มี status='sent'
- [ ] mock URL ใน `wrangler.toml` ถูก comment out (ไม่ลบ — backup)
- [ ] Secret ใน 1Password/secret manager (ไม่ใช่ local file)

---

## Rollback

ถ้า swap ไปแล้วมีปัญหา → rollback ได้ใน 2 นาที:

```toml
# Rollback wrangler.toml
WELLBEING_API_URL = "https://wellbeing-mock.<your-sub>.workers.dev"
WELLBEING_WEBHOOK_SECRET = "mock-wellbeing-secret-change-me-when-real-team16-ready"
```

```powershell
wrangler deploy
```

ทุกอย่างกลับมาใช้ mock — ไม่มี data loss
