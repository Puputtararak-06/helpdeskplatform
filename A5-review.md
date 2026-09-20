# A5 Doc Review — Helpdesk Team 14

**เรียน:** เพื่อน Team 16 (Wellbeing) / ทุกคนที่เกี่ยวข้องกับ A5 Integration
**จาก:** Ratthaphum (Helpdesk Team 14)
**วันที่:** 20 September 2026
**หัวข้อ:** Feedback on "A5 Integration Preparation" doc

---

## TL;DR

A5 doc เป็น **framework/preparation ที่ดี** แต่ **implement ยังไม่ได้** — ขาด contract จริงจาก Team 16, ขาด auth decision, ไม่มี timeline

**คะแนนความพร้อม: 60–70%**

---

## ✅ ดี — สิ่งที่ทำได้ดี

| จุด | ทำไม่ดี |
|---|---|
| **Bilingual TH/EN** | ทั้งสองทีมอ่านตรงกัน |
| **Domain ownership ชัด** | "Helpdesk เป็นเจ้าของ Ticket" — ตรงกับ PRD §1.4 |
| **Section 9: "Do not invent contract"** | กัน fabricate ข้อมูล Wellbeing — discipline ที่ดีมาก |
| **W1–W5 / H1–H9** | แบ่ง responsibility ชัด, ไม่ overlap |
| **6 evidence categories map ตรง ASSIGN5** | §7 ตรงกับภาพ evidence audit ทุกช่อง |
| **Joint Test Plan 7 cases** | ครอบคลุม normal + invalid + duplicate + unknown + failure |

---

## ⚠️ ขาด — เรียงตามความ critical

### 🔴 Blocker (ทำให้ start ไม่ได้)

1. **Wellbeing API contract ยังไม่มีจริง** — doc list 12 สิ่งที่ Helpdesk ต้องการจาก Wellbeing แต่ยังเป็น `...` ทั้งหมด
2. **สถานะ Team 16 ไม่ชัด** — เพื่อนมี contract แล้วหรือยัง? deadline ส่ง contract ตอนไหน?

### 🟡 สำคัญ (ต้องปิดก่อน implement ลงรอย)

3. **Authentication mechanism ยังไม่ lock** — "HMAC or equivalent" กว้างไป → code ไม่ได้
4. **Field names ไม่ specific** — `event_id`, `resource_id`, status values ทุกตัวยังเป็น placeholder
5. **ไม่มี mock API strategy** — ถ้ารอ Team 16 จริง → block; ถ้ามี mock → dev คู่ขนานได้
6. **ไม่มี timeline** — A5 Evidence ส่งเมื่อไหร่?

### 🟢 Nice-to-have

7. **Reference field ไม่ระบุ** — `wellbeing_record_id` ใส่ตรงไหนใน `tickets` table? schema migration ต้องคิด
8. **Evidence ownership ไม่ชัด** — 6 categories ใครเก็บอะไร (implicit ใน W1–W5 / H1–H9 แต่ไม่ explicit)
9. **W3 conditional** — "ถ้า contract กำหนด..." → ambiguity ว่า Helpdesk ส่ง webhook ออกไปหรือไม่

---

## 🎯 แนะนำ — ทำทันที 5 อย่าง

| # | Action | ใคร | ผลลัพธ์ |
|---|---|---|---|
| 1 | ถาม Team 16 ตรงๆ: "contract ส่งเมื่อไหร่?" | คุณ + เพื่อน | unblock implementation |
| 2 | สร้าง **mock Wellbeing API** (Cloudflare Worker + JSON) | คุณ | dev คู่ขนานโดยไม่รอจริง |
| 3 | Lock auth = **HMAC-SHA256 + shared secret** (default, ปรับได้ทีหลัง) | ทั้งสองทีม | code ได้ทันที |
| 4 | Decide field ชื่อ — เลือก `wellbeing_record_id` + status enum เบื้องต้น (4–5 ค่า) | ทั้งสองทีม | schema update ได้ |
| 5 | Pre-build evidence template — Postman collection + log query script | คุณ | รวบ evidence เร็วตอน integrate เสร็จ |

---

## ❓ ถามเพื่อน 4 ข้อ

1. **Team 16 อยู่ที่ไหนใน contract?** — มีแล้ว / กำลังทำ / ยังไม่เริ่ม?
2. **Mock API ทำได้ไหม?** — ถ้าได้ → dev คู่ขนาน → ส่ง A5 เร็วขึ้น
3. **Deadline A5 จริงๆ คือเมื่อไหร่?** — เผื่อ rework
4. **Field ชื่อ Wellbeing reference** — `wellbeing_record_id` / `case_id` / `appointment_id` (เลือกสักตัว)

---

## สรุป

A5 doc เป็น **checklist ที่ดี** (โครงสร้างครบ, responsibility ชัด, do-not-invent ดี) แต่ **ยังเป็น "what needs to happen" ไม่ใช่ "what we will build"**

- ถ้าปิด 5 จุดในตารางข้างบนได้ → พร้อม integrate จริง
- ถ้า deadline ใกล้ → focus ที่ข้อ 1, 2, 3 ก่อน (dev ได้ทันทีแม้ contract จริงยังไม่มา)

---

*ถ้ามีจุดไหนตีความต่างกัน หรือเพื่อน Team 16 มีข้อมูลเพิ่ม คุยกันได้เลย*
