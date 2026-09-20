# Deploy Mock Wellbeing API

Mock นี้จำลอง Team 16 (Wellbeing) API จนกว่าจะมี contract จริง

---

## Setup (10 นาที)

### 1. สร้าง Worker ใหม่

```bash
# ไปที่ folder mock
cd C:\Users\fluke\.openclaw\workspace\helpdeskplatform-main (1)\helpdesk-repo\What-i-can\mocks

# init wrangler project ใหม่ (ชื่อ wellbeing-mock)
wrangler init wellbeing-mock --type javascript
```

### 2. Replace source file

ลบไฟล์ `src/index.js` (หรือ `index.js`) ที่ wrangler generate ให้
Copy เนื้อหา `wellbeing-mock-api.mjs` ไปวางแทน (เปลี่ยนชื่อเป็น `.mjs` หรือตาม main ที่ wrangler.toml ระบุ)

### 3. Configure wrangler.toml ของ mock

```toml
name = "wellbeing-mock"
main = "wellbeing-mock-api.mjs"
compatibility_date = "2026-09-01"

[vars]
# URL ของ Helpdesk webhook receiver — เปลี่ยนเป็น URL จริงของคุณ
HELPDESK_WEBHOOK_URL = "https://helpdesk-team14.<your-sub>.workers.dev/webhooks/wellbeing"
```

### 4. Set shared secret

```bash
wrangler secret put WELLBEING_MOCK_SECRET
# paste: mock-wellbeing-secret-change-me-when-real-team16-ready
```

### 5. Deploy

```bash
wrangler deploy
# → https://wellbeing-mock.<your-sub>.workers.dev
```

---

## Configure Helpdesk ให้ชี้ไป mock

ใน Helpdesk project `wrangler.toml`:
```toml
[vars]
WELLBEING_API_URL = "https://wellbeing-mock.<your-sub>.workers.dev"
WELLBEING_WEBHOOK_SECRET = "mock-wellbeing-secret-change-me-when-real-team16-ready"
```

Deploy Helpdesk ใหม่ → integrate ได้เลย

---

## Endpoints ที่ mock รองรับ

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/cases` | Helpdesk สร้าง wellbeing case (consumer proof) |
| `GET` | `/v1/cases/:id` | อ่าน case |
| `PATCH` | `/v1/cases/:id` | อัปเดต case |
| `POST` | `/internal/trigger-webhook` | Mock ส่ง webhook กลับ Helpdesk (provider proof) |
| `GET` | `/v1/_debug/calls` | ดู call log ทั้งหมด |
| `POST` | `/v1/_debug/reset` | ล้าง call log |
| `POST` | `/v1/_debug/break` | simulate degradation (returns 500) |
| `POST` | `/v1/_debug/heal` | กลับสู่ปกติ |

---

## Health check

```bash
curl https://wellbeing-mock.<your-sub>.workers.dev/v1/_debug/calls
# → {"calls":[],"degraded":false}
```

---

## เมื่อ Team 16 พร้อม

แค่เปลี่ยน 2 ค่าใน Helpdesk `wrangler.toml`:
```toml
[vars]
WELLBEING_API_URL = "https://api.wellbeing.mfu.ac.th"   # URL จริง
WELLBEING_WEBHOOK_SECRET = "<secret จริงจาก Team 16>"
```

ไม่ต้องแก้ code เลย — ทุกอย่างอ่านจาก env

---

## ข้อจำกัด

- State (call log, idempotency) อยู่ใน memory — ถ้า isolate cold start หาย
  - สำหรับ 1 วัน testing ไม่เป็นปัญหา
  - ถ้าจะ persistent ใช้ KV/D1 เพิ่ม
- Mock รัน 1 instance ต่อ region — ไม่ scale out
- ไม่มี rate limiting — testing อย่างเดียว
