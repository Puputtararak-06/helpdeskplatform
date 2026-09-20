# Deploy Checklist — A5 Submission

ใช้ checklist นี้ก่อน submit เพื่อให้แน่ใจว่าครบทุกอย่าง

---

## ✅ Pre-deploy (ก่อนรัน wrangler deploy)

- [ ] Migration `0005_wellbeing_fields.sql` applied สำเร็จ
  ```powershell
  wrangler d1 execute helpdesk-db --remote --file=What-i-can\migrations\0005_wellbeing_fields.sql
  ```
- [ ] ตรวจ tables ครบ:
  ```powershell
  wrangler d1 execute helpdesk-db --remote --command ".tables"
  ```
  ควรเห็น: `tickets`, `webhook_events`, `webhook_outbox`, `partner_sync_health`
- [ ] `tickets` table มี columns ใหม่:
  ```powershell
  wrangler d1 execute helpdesk-db --remote --command "PRAGMA table_info(tickets)"
  ```
  ควรเห็น: `wellbeing_record_id`, `wellbeing_status`, `wellbeing_synced_at`, `wellbeing_webhook_secret`
- [ ] `wrangler.toml` มี `[vars] WELLBEING_API_URL` + `WELLBEING_WEBHOOK_SECRET`
- [ ] `wrangler.toml` มี `[triggers] crons = ["*/5 * * * *"]`
- [ ] Mock deployed และ URL ใช้งานได้:
  ```powershell
  curl https://wellbeing-mock.<sub>.workers.dev/v1/_debug/calls
  # → 200 + {"calls":[],"degraded":false,"count":0}
  ```
- [ ] Helpdesk deployed:
  ```powershell
  curl https://helpdesk-team14.<sub>.workers.dev/healthz
  # → 200 + {"data":{"status":"ok",...}}
  ```

---

## ✅ Pre-test (ก่อนรัน Postman/auto tests)

- [ ] Preflight ผ่านหมด:
  ```powershell
  node What-i-can\scripts\preflight.cjs
  # → 🎉 All preflight checks passed
  ```
- [ ] HMAC sanity check ผ่าน:
  ```powershell
  node What-i-can\scripts\hmac-test.cjs
  # → 🎉 HMAC ready for production deployment
  ```
- [ ] Secret ใน mock ตรงกับ secret ใน Helpdesk:
  ```powershell
  # Mock:
  wrangler secret list wellbeing-mock
  # Helpdesk:
  wrangler secret list helpdesk-team14
  ```
  หรือดูจาก `wrangler.toml` `[vars] WELLBEING_WEBHOOK_SECRET` (ถ้าไม่ได้ใช้ `wrangler secret`)
- [ ] URL ไม่มี typo — copy paste ตรงๆ จาก deploy output

---

## ✅ Tests (12 cases ควร pass)

- [ ] Auto-run all tests:
  ```powershell
  node What-i-can\scripts\run-tests.cjs
  ```
- [ ] ดู report: `What-i-can/test-results/latest-summary.md`
- [ ] Pass rate = 100% (หรือระบุ failing tests ใน evidence)
- [ ] Idempotency: test 5 + 5b → same `case_id`, X-Idempotent-Replay header present
- [ ] Degradation: 6a (break) → 6b (call fails 500) → 6c (heal) → 6d (recover 201)

---

## ✅ Evidence (ครบ 6 sections)

- [ ] Run evidence collector:
  ```powershell
  node What-i-can\scripts\collect-evidence.cjs
  ```
- [ ] เปิด `A5-Team14-Integration-Evidence-FILLED.md`
- [ ] Section 1 — Consumer Proof: test 1 response ครบ
- [ ] Section 2 — Provider Proof: test 2 + `wrangler tail` log
- [ ] Section 3 — Webhook Receiver: test 3a (401) + test 3b (200)
- [ ] Section 4 — Webhook Sender: test 4 + DB query
- [ ] Section 5 — Idempotency: tests 5 + 5b + COUNT(*) = 1
- [ ] Section 6 — Degradation: tests 6a-d + recovery log
- [ ] Architecture diagram included (ตอนนี้อยู่ใน doc แล้ว)
- [ ] Notes section อธิบายการใช้ mock + เหตุผล

---

## ✅ Final checks (ก่อน submit 30 นาที)

- [ ] PDF/MD export ของ evidence doc พร้อม
- [ ] File naming ถูกต้อง: `A5-Team14-Integration-Evidence.md` (หรือ .pdf)
- [ ] เปิดอ่านครั้งสุดท้าย — ครบ 6 sections, ไม่มี "_paste_" เหลือ
- [ ] Production URL ทำงาน:
  ```powershell
  curl https://helpdesk-team14.<sub>.workers.dev/healthz
  ```
- [ ] Mock URL ทำงาน (เผื่ออาจารย์ verify):
  ```powershell
  curl https://wellbeing-mock.<sub>.workers.dev/v1/_debug/calls
  ```

---

## 🚨 ถ้ามีข้อ fail

| ข้อ fail | Action |
|---|---|
| Migration apply fail | ดู error → แก้ SQL → รันใหม่ (อาจต้อง DROP TABLE ก่อน) |
| Preflight fail | ดูบรรทัดสีแดง → แก้ → รันใหม่ |
| Tests fail | ดู `test-results/latest-summary.md` → debug ตาม `TROUBLESHOOTING.md` |
| HMAC mismatch | ตรวจ secret ทั้ง 2 ฝั่ง — ต้องตรงกันเป๊ะ |
| Submit หมดเวลา | ส่งแบบ mock + อธิบายใน notes — ดีกว่าส่งไม่ทัน |

---

## 📤 Submit checklist

- [ ] Production URL: `https://helpdesk-team14.<your-sub>.workers.dev`
- [ ] Evidence file: `A5-Team14-Integration-Evidence.{md|pdf}`
- [ ] (optional) Source code link: GitHub repo URL
- [ ] Submit ก่อน **23:00** (เผื่อ 1 ชม. emergency)
