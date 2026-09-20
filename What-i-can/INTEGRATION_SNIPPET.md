# Integration Snippet — Wire Up to Your Main App

**เป้าหมาย:** นำ code จาก `What-i-can/src/` ไปใช้กับ Helpdesk main app ของคุณ

---

## ขั้นที่ 1 — Copy ไฟล์

```powershell
cd C:\Users\fluke\.openclaw\workspace\helpdeskplatform-main (1)\helpdesk-repo

# Pure utilities (ไม่ต้องแก้)
copy What-i-can\src\lib\hmac.ts            src\lib\hmac.ts
copy What-i-can\src\lib\wellbeing-sync.ts   src\lib\wellbeing-sync.ts
copy What-i-can\src\routes\webhooks.ts      src\routes\webhooks.ts

# Retry worker (NEW)
mkdir src\workers -ErrorAction SilentlyContinue
copy What-i-can\src\workers\retry-worker.ts src\workers\retry-worker.ts
```

## ขั้นที่ 2 — Apply migration

```powershell
wrangler d1 execute helpdesk-db --remote --file=What-i-can\migrations\0005_wellbeing_fields.sql
```

## ขั้นที่ 3 — wrangler.toml

```toml
# เพิ่มใน [vars]
[vars]
WELLBEING_API_URL = "https://wellbeing-mock.<your-subdomain>.workers.dev"
WELLBEING_WEBHOOK_SECRET = "mock-wellbeing-secret-change-me-when-real-team16-ready"

# เพิ่ม cron trigger (รัน retry worker ทุก 5 นาที)
[triggers]
crons = ["*/5 * * * *"]
```

## ขั้นที่ 4 — แก้ src/index.ts

```ts
import { Hono } from 'hono';
import { handleWellbeingWebhook } from './routes/webhooks';
import { processOutbox, handleScheduled } from './workers/retry-worker';

export interface Env {
  DB: D1Database;
  WELLBEING_API_URL: string;
  WELLBEING_WEBHOOK_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

// ... existing routes ...

// Webhook receiver (เพิ่มบรรทัดเดียว)
app.post('/webhooks/wellbeing', handleWellbeingWebhook);

// Optional: admin endpoint สำหรับ trigger retry ด้วยตัวเอง (testing)
app.get('/admin/retry-now', async (c) => {
  const stats = await processOutbox(c.env);
  return c.json(stats);
});

// Export Worker พร้อม fetch + scheduled handlers
export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    await handleScheduled(event, env, ctx);
  },
};
```

## ขั้นที่ 5 — Trigger sync จาก ticket creation

ในไฟล์ที่สร้าง ticket (สมมติชื่อ `src/routes/tickets.ts`):

```ts
import { createWellbeingCase } from '../lib/wellbeing-sync';

app.post('/api/tickets', async (c) => {
  const body = await c.req.json();

  // ... existing validation + insert logic ...
  const ticketRef = `TKT-${Date.now()}`;
  await c.env.DB.prepare(
    'INSERT INTO tickets (id, ticket_ref, title, status, category) VALUES (?, ?, ?, ?, ?)',
  ).bind(ticketRef, ticketRef, body.title, 'open', body.category || 'other').run();

  // NEW: sync to Wellbeing if needed
  if (body.category === 'wellbeing' || body.urgency === 'high') {
    const config = {
      apiUrl: c.env.WELLBEING_API_URL,
      secret: c.env.WELLBEING_WEBHOOK_SECRET,
    };
    const result = await createWellbeingCase(
      config,
      c.env.DB,
      ticketRef,
      body.urgency || 'medium',
    );
    console.log(`[tickets] wellbeing sync: ${result.caseId || 'failed: ' + result.error}`);
  }

  return c.json({ ticket_ref: ticketRef }, 201);
});
```

## ขั้นที่ 6 — Deploy + test

```powershell
# Deploy Helpdesk
wrangler deploy

# Test locally first (optional but recommended)
# Terminal 1: mock
cd What-i-can\mocks && wrangler dev --port 8788

# Terminal 2: helpdesk (with mock URL)
$env:WELLBEING_API_URL="http://localhost:8788"
wrangler dev

# Terminal 3: call
curl -X POST http://localhost:8787/api/tickets \
  -H "Content-Type: application/json" \
  -d '{"title":"Counseling referral","category":"wellbeing","urgency":"high"}'

# Check mock log
curl http://localhost:8788/v1/_debug/calls
```

## ขั้นที่ 7 — Verify in production

```powershell
# Health check
curl https://helpdesk-team14.<your-sub>.workers.dev/healthz

# Trigger webhook from mock → helpdesk
curl -X POST https://wellbeing-mock.<your-sub>.workers.dev/internal/trigger-webhook \
  -H "Content-Type: application/json" \
  -d '{"event":"wellbeing.case.opened","data":{"case_id":"wb-prod-1","ticket_ref":"TKT-001"},"idempotency_key":"evt-prod-001"}'

# Tail helpdesk logs
wrangler tail helpdesk-team14
# → should see [webhook] received event=wellbeing.case.opened

# Check Helpdesk DB
wrangler d1 execute helpdesk-db --remote --command \
  "SELECT ticket_ref, wellbeing_record_id, wellbeing_status FROM tickets WHERE wellbeing_record_id IS NOT NULL"
```

---

## ถ้ามี main app ที่มี structure ต่างจากนี้

Adapter checklist:
- ❓ routes อยู่ที่ไหน → `src/routes/` หรืออื่น?
- ❓ DB binding ชื่ออะไร (default: `DB`)
- ❓ มี cron trigger อยู่แล้วไหม?
- ❓ webhook.ts import path ตรงกับ main app ไหม?

ถ้า structure ต่าง → ปรับ import paths ใน webhooks.ts, retry-worker.ts ให้ตรงกับของคุณ
