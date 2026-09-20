# FAQ — A5 Integration

คำถามที่อาจเจอตอนทำงาน — รวบรวมไว้ที่เดียว

---

## Q: Mock คืออะไร? ทำไมต้องใช้?

**A:** Mock คือ Wellbeing API จำลองที่ผม (Team 14) เขียนขึ้นมาเพราะ Team 16 ส่ง contract ไม่ทัน

มันจำลอง contract ที่เรา **propose ไว้ใน A5 prep doc** — ทั้ง REST endpoints + webhook sender + debug

ตอน Team 16 พร้อม → แค่เปลี่ยน URL + secret ใน Helpdesk `wrangler.toml` ไม่ต้องแก้ code

---

## Q: ทำไม HMAC ไม่ใช่ OAuth / Bearer token?

**A:** HMAC เป็น webhook auth ที่:
- ไม่ต้อง round-trip (verify locally)
- Stateless (server ไม่ต้องเก็บ token)
- ป้องกัน replay (timestamp + tolerance window)
- Industry standard (Stripe, GitHub, Slack ใช้แบบนี้)

OAuth/Bearer เหมาะ user-facing API, ไม่เหมาะ webhook

---

## Q: ทำไม status enum ลดเหลือแค่ found/claimed?

**A:** หลังจากทดสอบเจอ design issue — `lost` status ทำให้ field `finder_student_id` สับสน (คนทำของหาย = owner, ไม่ใช่ finder)

Simplify design:
- คนเจอ post → status=found
- เจ้าของ search → contact คนเจอ
- คนเจอ update → status=claimed

ผลลัพธ์: data model ง่ายขึ้น, validator ลด 30%, code อ่านง่ายขึ้น

---

## Q: `idempotency_key` ต่างจาก `event_key` ยังไง?

**A:**

| Field | Where | Purpose | Lifetime |
|---|---|---|---|
| `idempotency_key` | Outgoing (Helpdesk → Wellbeing) | ป้องกันสร้าง case ซ้ำ | Until case created (then irrelevant) |
| `event_key` | Incoming (Wellbeing → Helpdesk) | ป้องกัน process event ซ้ำ | Stored forever in webhook_events |

ตัวอย่าง:
- Helpdesk ส่ง POST /v1/cases ด้วย `idempotency_key=ticket-TKT-001-case` → Wellbeing เช็ค key นี้ใน cache → replay → คืน case เดิม
- Wellbeing ส่ง webhook มา Helpdesk ด้วย `event_key=evt-abc-123` → Helpdesk เช็ค key นี้ใน webhook_events → ถ้ามีแล้ว → return 200 ไม่ process ซ้ำ

---

## Q: ทำไม retry worker ต้องมี?

**A:** Production webhook systems **ต้อง** มี retry เพราะ:
- Network blip → request fail
- Partner ล่มชั่วคราว → 5xx → เราต้อง retry ตอนเขากลับมา
- Deploy restart → request ค้าง

ถ้าไม่มี retry → ticket สร้างใน Helpdesk แต่ไม่เคย sync ไป Wellbeing → ข้อมูลไม่ตรงกัน → คนร้องเรียน

ใน A5 evidence เราโชว์ว่า **fallback path ทำงาน** (เห็นจาก test 6b → 6d)

---

## Q: ทำไม `?force=true` ใน DELETE ถึงต้องมี?

**A:** เพื่อป้องกันลบของที่ถูกเคลมไปแล้วโดยไม่ตั้งใจ

Pattern เดียวกับ `rm -rf` ที่ถาม confirm — ไม่ใช่ security แต่เป็น UX safety

---

## Q: ถ้า Team 16 ส่ง contract ตอนเช้าวันพรุ่งนี้ ทำอะไร?

**A:** ดู `docs/SWAP.md` — มี 5-step pivot procedure

ใช้เวลา ~30 นาที:
1. Verify contract shape ตรงกับ mock
2. Swap 2 vars ใน Helpdesk `wrangler.toml` (URL + secret)
3. Redeploy Helpdesk
4. Run preflight (verify mock/Helpdesk + HMAC)
5. Re-run tests against real API

---

## Q: ทำไมผมต้องเขียน mock เอง? ไม่ใช่ให้ Team 16 เขียน?

**A:** 3 เหตุผล:

1. **Timeline:** Team 16 ช้า → ถ้ารอ → ไม่ทัน deadline 22 Sep
2. **Mock-driven dev** เป็น best practice — dev ฝั่ง consumer ไม่ควร block โดยฝั่ง provider
3. **Discipline:** เราไม่ fabricate Team 16's API — เรา implement contract ที่เราเสนอ และบอกใน evidence ว่าใช้ mock เพราะเหตุนี้

หลังส่ง A5 → ถ้า Team 16 ส่ง contract จริง → เรา swap ใน 30 นาที

---

## Q: scripts/ มี 6 ไฟล์ — ต้องรันอันไหนบ้าง?

**A:** เรียงตามลำดับที่ควรรัน:

```bash
# 1. Setup env (ครั้งเดียว)
cp What-i-can/.env.example What-i-can/scripts/.env.json
# แก้ URL ในไฟล์

# 2. Verify everything before tests
node What-i-can/scripts/hmac-test.cjs       # crypto works?
node What-i-can/scripts/verify-schema.cjs   # DB schema OK?
node What-i-can/scripts/preflight.cjs       # URLs + HMAC end-to-end OK?

# 3. Run tests
node What-i-can/scripts/run-tests.cjs

# 4. Generate evidence
node What-i-can/scripts/collect-evidence.cjs

# 5. (optional) Debug
node What-i-can/scripts/inspect-mock.cjs --tail    # watch mock state
node What-i-can/scripts/inspect-queue.cjs          # see outbox queue
node What-i-can/scripts/load-test.cjs             # burst load test

# 6. Reset between runs
node What-i-can/scripts/cleanup.cjs --include-mock
```

---

## Q: Mock อยู่ที่ไหน deploy?

**A:** Cloudflare Workers — แยกจาก Helpdesk เพื่อความชัดเจน

URL pattern: `https://wellbeing-mock.<your-subdomain>.workers.dev`

Deploy ครั้งเดียว → ใช้ได้ตลอด A5 cycle

---

## Q: ถ้า tests fail ตอน 21:00 (1 ชม. ก่อน deadline)?

**A:** Emergency triage:

1. **ดู test-results/latest-summary.md** — ดูว่า case ไหน fail
2. **ดู mock + helpdesk logs** — `wrangler tail`
3. **fix smallest thing** — ไม่ใช่เวลา refactor
4. **ถ้า 1 case fail ที่ไม่ critical** → เขียน note ใน evidence อธิบาย + ส่ง
5. **ถ้า >2 cases fail** → ตรวจ secret mismatch ก่อน (90% ของ bug)

---

## Q: Webhook ถูก retry กี่ครั้ง?

**A:** Config ใน `src/workers/retry-worker.ts`:
- `MAX_ATTEMPTS = 5`
- `RETRY_BACKOFF_SEC = 60` (1 นาที)
- ใช้ cron `*/5 * * * *` (ทุก 5 นาที)

Total: ~25 นาที (5 attempts × 5 min cron, แต่ลอง 1 min backoff = 5+1+1+1+1 = 9 นาที)

ถ้า 5 ครั้งยัง fail → status='failed', ต้อง manual retry

---

## Q: ทำไม mock ไม่ validate payload?

**A:** Intentional — เพื่อ test ทั้ง happy path และ edge cases

ถ้า mock validate เหมือน production → ทดสอบ bug ของเราเองยาก

แต่ production code (`src/routes/webhooks.ts`) validate ครบ — ดู `isWebhookPayload()` ใน `src/types/events.ts`
