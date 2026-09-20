# Troubleshooting Guide — A5 Integration

Common issues + fixes เมื่อรัน integration tests พรุ่งนี้

---

## 🔴 Mock ไม่ตอบ / Connection refused

**อาการ:** `curl https://wellbeing-mock.<sub>.workers.dev/v1/_debug/calls` → "Could not resolve" หรือ 404

**สาเหตุ + Fix:**
1. Mock ยังไม่ได้ deploy → `cd What-i-can/mocks && wrangler deploy`
2. Subdomain ผิด → ดู output ตอน `wrangler deploy` จะบอก URL ที่ถูกต้อง
3. Mock ถูก deploy แต่ URL เก่า → รัน `wrangler deployments list` ดู version ล่าสุด

---

## 🔴 Webhook: "invalid signature" (401)

**อาการ:** Mock ส่ง webhook → Helpdesk returns 401 `{"error":"invalid signature","reason":"invalid_signature"}`

**สาเหตุ + Fix:**
1. **Secret mismatch** — Helpdesk secret ≠ mock secret
   - Helpdesk `wrangler.toml`: `WELLBEING_WEBHOOK_SECRET = "..."`
   - Mock `wrangler secret put WELLBEING_MOCK_SECRET` ต้องเป็นค่าเดียวกัน
   - ทั้งคู่ตอน deploy ใหม่
2. **Timestamp expired (>5min)** — `reason: "expired"`
   - ทดสอบทันทีหลัง sign
3. **Body ไม่ตรงกับ signed payload** — JSON.stringify ต่างกัน
   - ตรวจว่า `await c.req.text()` ก่อน parse JSON ใน receiver

---

## 🔴 Webhook ไม่ถูกบันทึกใน webhook_events

**อาการ:** Trigger webhook แต่ DB ไม่มี row ใหม่

**สาเหตุ + Fix:**
1. Receiver route ไม่ได้ register → เช็ค `app.post('/webhooks/wellbeing', handleWellbeingWebhook)`
2. HMAC fail → receiver return 401 ก่อน insert → ดู `wrangler tail`
3. DB binding ไม่ตรง → `c.env.DB` ต้อง map ถึง D1 database
4. Table ไม่มี → run migration ก่อน

---

## 🔴 Idempotency: replay ไม่ทำงาน

**อาการ:** ส่ง request เดิม 2 ครั้ง → ได้ 201 ใหม่ทั้ง 2 ครั้ง (ควรได้ 1 ครั้งเป็น 201, อีกครั้งเป็น 200 + replay)

**สาเหตุ + Fix:**
1. **ไม่ได้ส่ง X-Idempotency-Key header** → ตรวจ Postman request headers
2. **Key เปลี่ยนทุกครั้ง** → ใช้ random, ต้อง derive จาก business data (เช่น `ticket-${ref}-case`)
3. **Mock state reset** → `_debug/reset` ล้าง cache → ส่ง key เดิม = create ใหม่
   - **ไม่ call reset ระหว่าง replay test**

---

## 🔴 Degradation: ไม่ recover

**อาการ:** Heal แล้ว retry ยังไม่ work

**สาเหตุ + Fix:**
1. **Retry worker ไม่ทำงาน** → cron ยังไม่ trigger (รอ 5 นาที)
   - **Manual trigger**: `curl https://helpdesk-team14.<sub>.workers.dev/admin/retry-now`
2. **MAX_ATTEMPTS reached** → status = 'failed' ไม่ใช่ 'retrying'
   - Reset: `UPDATE webhook_outbox SET status='pending', attempts=0 WHERE status='failed'`
3. **URL ยังชี้ mock เก่า** → ตรวจ `[vars] WELLBEING_API_URL` ใน Helpdesk wrangler.toml

---

## 🟡 TypeScript errors ตอน deploy

**อาการ:** `wrangler deploy` fail ด้วย type errors

**สาเหตุ + Fix:**
1. **Import path ไม่ตรง** → ตรวจ `./lib/hmac` vs `../lib/hmac` ตาม file depth
2. **Missing types** → `npm install @cloudflare/workers-types`
3. **strict mode** → อาจต้องเพิ่ม `as any` หรือปรับ types

วิธีตรวจ local ก่อน deploy:
```powershell
npx tsc --noEmit
```

---

## 🟡 wrangler tail ไม่เห็น log

**อาการ:** `wrangler tail` ไม่แสดง `[webhook]` log

**สาเหตุ + Fix:**
1. **Tail ผิด worker** → ตรวจ `wrangler tail <worker-name>` ใช้ name ตรง
2. **Log level** → tail default แสดง log ทั้งหมด แต่บางที filter format ต่าง
3. **Old deployment** → tail ตาม version ล่าสุด ลอง `wrangler tail --format=pretty`

---

## 🟡 DB query return ไม่ตรง

**อาการ:** `SELECT * FROM webhook_events` ว่างทั้งที่ trigger ไปแล้ว

**Fix:**
```powershell
# ตรวจว่า table มีจริง
wrangler d1 execute helpdesk-db --remote --command ".tables"

# ดู schema
wrangler d1 execute helpdesk-db --remote --command ".schema webhook_events"

# ดู rows ทั้งหมด (ไม่ใช่แค่ LIMIT 10)
wrangler d1 execute helpdesk-db --remote --command "SELECT * FROM webhook_events ORDER BY id DESC"
```

---

## 🟡 Debug UI ไม่โหลด

**อาการ:** เปิด debug-ui.html → "Cannot reach mock"

**Fix:**
1. URL ผิด → ใช้ `?mock=https://wellbeing-mock.<your-sub>.workers.dev` เป็น query param
2. Mock ยังไม่ตอบ → curl `/v1/_debug/calls` ดูว่าได้ JSON ไหม
3. CORS → mock อนุญาต `*` แล้ว แต่ถ้า serve UI จาก `file://` อาจมีปัญหา
   - **Fix**: serve ผ่าน HTTP server เช่น `npx serve What-i-can/mocks` แล้วเปิด `http://localhost:3000/debug-ui.html?mock=...`

---

## 🆘 ถ้าทุกอย่างพัง

```powershell
# 1. ดู state ของ mock
curl https://wellbeing-mock.<your-sub>.workers.dev/v1/_debug/calls

# 2. Reset ทุกอย่าง
curl -X POST https://wellbeing-mock.<your-sub>.workers.dev/v1/_debug/reset

# 3. Heal ถ้า degraded
curl -X POST https://wellbeing-mock.<your-sub>.workers.dev/v1/_debug/heal

# 4. ดู Helpdesk log แบบ real-time
wrangler tail helpdesk-team14 --format=pretty

# 5. ตรวจ D1 ตรงๆ
wrangler d1 execute helpdesk-db --remote --command "SELECT * FROM webhook_events ORDER BY id DESC LIMIT 5"
wrangler d1 execute helpdesk-db --remote --command "SELECT * FROM webhook_outbox ORDER BY id DESC LIMIT 5"
```

---

## 💬 ติดปัญหา — ถามผมได้

ส่งมาว่า:
1. error message (copy exact)
2. `wrangler tail` output (last 30 lines)
3. คำสั่งที่รัน

ผม debug ได้ทันที
