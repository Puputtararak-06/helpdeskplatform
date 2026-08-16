[README.md](https://github.com/user-attachments/files/31121697/README.md)
# helpdeskplatform# Helpdesk Platform — Team 14
## คู่มือทำความเข้าใจโปรเจกต์สำหรับสมาชิกในทีม

> `PRD.final.md` คือเอกสาร PRD หลักของทีม ส่วน `README.md` ไฟล์นี้มีไว้ช่วยให้สมาชิกอ่านแล้วเข้าใจว่าโปรเจกต์กำลังทำอะไร และแต่ละส่วนเชื่อมกันอย่างไร

---

## 1. โปรเจกต์เราคืออะไร?

เราไม่ได้ทำแค่เว็บแจ้งปัญหา แต่กำลังออกแบบ **Helpdesk Platform** สำหรับนักศึกษาและบุคลากร เพื่อให้ทุกปัญหาหรือคำขอความช่วยเหลือกลายเป็น **Ticket** ที่สามารถติดตามตั้งแต่สร้างจนแก้เสร็จ

Core flow:

```text
Create → Track → Triage → Assign → Communicate → Resolve → Integrate
```

แนวคิดหลักของระบบคือ:

> **Every support request has an ID, an owner, a status, and a traceable event trail.**

---

## 2. ทำไมมันเป็น Platform ไม่ใช่แค่ Application?

Helpdesk เป็นหนึ่งระบบใน University Platform Ecosystem และต้องเชื่อมกับระบบของทีมอื่น ๆ

```text
                    Identity Platform
                           │
                       Login / User
                           │
                           ▼
Student / Staff ──────> HELPDESK
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        Notification   Security     Analytics
             Hub       & Compliance
                           ▲
                           │
                  Maintenance Platform
                           │
              maintenance.status_changed
```

ดังนั้นเราต้องคิดทั้ง API, Authentication, Authorization, Data Ownership, Events, Integration, Failure Handling และ Testing

---

## 3. ใครใช้ระบบ?

### Requester
นักศึกษา / อาจารย์ / บุคลากร

- Login
- Create Ticket
- ดู Ticket ของตัวเอง
- ดู Status
- Comment
- Reopen ตามเงื่อนไข

### Agent
เจ้าหน้าที่ Helpdesk

- ดู Agent Queue
- Triage
- Assign Ticket
- เปลี่ยน Category / Priority
- Internal Comment
- Link Maintenance Work Order
- Resolve Ticket

### Admin
หัวหน้าหรือผู้ดูแล Helpdesk

- ทำสิ่งที่ Agent ทำได้
- Manage Category
- ดู Basic Counts
- Administrative Operations

---

## 4. Core Happy Path

ถ้าอาจารย์ถามว่า “ระบบนี้ทำอะไร?” ให้เริ่มจาก flow นี้:

```text
Requester
   ↓
Login
   ↓
Create Ticket
   ↓
Category/Priority Suggestion
   ↓
Ticket ID Created
   ↓
Agent Queue
   ↓
Triage / Assign
   ↓
Work / Comment
   ↓
Resolve
   ↓
Requester Sees Updated Status
```

นี่คือ **Core Happy Path** ของ MVP

---

## 5. Ticket คือหัวใจของระบบ

Ticket เป็น Core Business Entity ของ Helpdesk

```text
Ticket
├── Ticket ID
├── Requester
├── Assignee
├── Category
├── Priority
├── Status
├── Subject
├── Description
├── Maintenance Work Order ID
├── Resolution Note
└── Comments
```

Ticket lifecycle:

```text
Open
  ↓
Assigned
  ↓
InProgress
  ↓
Resolved
  ↓
Closed
```

- `Open` = สร้างแล้ว ยังไม่มี Agent รับผิดชอบ
- `Assigned` = มี Agent ถูก assign
- `InProgress` = Agent กำลังดำเนินการ
- `Resolved` = แก้ปัญหาแล้ว
- `Closed` = จบถาวรหลังหมดช่วง Reopen

Requester สามารถ Reopen Ticket ที่ Resolved ได้ภายใน 7 วันตาม Business Rule

---

## 6. AI ของเราคืออะไร?

PRD ระบุ concept ว่าระบบควรช่วยเสนอ:

- Category
- Priority
- Route

แต่ **MVP ไม่ใช้ LLM ใน request path**

MVP ใช้ **Deterministic Rules Engine**:

```text
Ticket Description + Urgency
            ↓
      Keyword / Rules
            ↓
 Suggested Category / Priority
```

Suggestion เป็นเพียงคำแนะนำ ผู้ใช้หรือ Agent มีสิทธิ์ตัดสินใจสุดท้าย

ถ้า Rule หา suggestion ที่เหมาะสมไม่ได้ Ticket ยังต้องสร้างได้ ไม่ควร block core workflow

LLM ถูกวางเป็น Future Improvement

---

## 7. Identity คืออะไร?

Identity Platform เป็นเจ้าของเรื่อง **“ผู้ใช้นี้คือใคร?”**

Helpdesk ใช้ Identity/SSO เพื่อ Authentication และไม่เก็บ Password เอง

จำง่าย ๆ:

- **Authentication:** มึงเป็นใคร?
- **Authorization:** มึงทำอะไรได้บ้าง?

Authorization ต้องตรวจที่ Backend/API และควรมี Database Policy/RLS ตามความเหมาะสม ไม่ใช่ให้ Frontend เป็นคนตัดสิน Security เอง

---

## 8. Maintenance เชื่อมกับเราอย่างไร?

สมมติ Ticket แจ้งว่าแอร์เสีย

```text
Helpdesk Ticket #T-001
        │
        │ maintenance_work_order_id
        ▼
Maintenance Work Order #M-123
```

Helpdesk **ไม่ copy repair record ทั้งหมด** เพราะ Maintenance เป็นเจ้าของ Work Order

Helpdesk เก็บแค่ Linked Work Order ID

เมื่อ Maintenance เปลี่ยนสถานะ:

```text
Maintenance
    ↓
maintenance.status_changed
    ↓
Helpdesk Webhook
    ↓
ตรวจสอบ Event
    ↓
หา Ticket ที่ link อยู่
    ↓
Update Ticket
    ↓
Publish Ticket Event ต่อ
```

นี่คือ **Data Ownership + Platform Integration** ที่สำคัญมากของงานนี้

---

## 9. REST API vs Event

### REST API
ใช้เมื่อระบบหนึ่งต้องการให้ Helpdesk ทำอะไร หรือขอข้อมูล

เช่น:

```text
POST /api/tickets
GET  /api/tickets/me
```

คิดง่าย ๆ ว่า:

> “ช่วยทำสิ่งนี้ให้หน่อย”

### Event
ใช้เมื่อ Helpdesk ประกาศว่าเหตุการณ์บางอย่างเกิดขึ้นแล้ว

เช่น:

```text
ticket.created
ticket.assigned
ticket.resolved
ticket.escalated
ticket.status_changed
ticket.work_order_linked
```

คิดง่าย ๆ ว่า:

> “กูเพิ่งทำสิ่งนี้เสร็จ ใครสนใจก็เอาไปใช้”

---

## 10. Event ส่งให้ใครบ้าง?

```text
                    Helpdesk
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    Notification    Security     Analytics
        Hub        & Compliance
```

- **Notification Hub** → ใช้ทำ Notification
- **Security & Compliance** → ใช้สำหรับ Audit / Security Review
- **Analytics** → ใช้วิเคราะห์ข้อมูล

Helpdesk ไม่ต้องสร้างระบบ Email/SMS หรือ Analytics เอง

---

## 11. Data Ownership

| Data | Owner |
|---|---|
| Authentication Credentials | Identity |
| Ticket | Helpdesk |
| Category | Helpdesk |
| Priority | Helpdesk |
| Assignee | Helpdesk |
| Comment | Helpdesk |
| Work Order | Maintenance |
| Notification Delivery | Notification Hub |
| Analytics Records | Analytics |

ถ้าอาจารย์ถามว่า “ทำไมไม่ copy Maintenance data?” ให้ตอบว่า:

> **Because Maintenance owns the work-order domain. Helpdesk only stores the linked work-order ID.**

---

## 12. Architecture ของเรา

### Logical Architecture

```text
                    Identity Platform
                           │
                           │ AuthN
                           ▼
┌──────────────┐      ┌───────────────┐
│ Student /    │─────▶│   HELPDESK    │
│ Staff        │      │   PLATFORM    │
└──────────────┘      └───────┬───────┘
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
        Notification     Security        Analytics
            Hub         & Compliance
                              ▲
                              │
                    Maintenance Platform
                              │
                  status_changed event
```

### ภายใน Helpdesk

```text
Browser
   ↓ HTTPS
Next.js
   ├── UI
   ├── API Routes
   ├── Business Rules
   ├── Authorization
   └── Integration Adapters
          ↓
Supabase PostgreSQL
   ├── Tickets
   ├── Users
   ├── Categories
   ├── Comments
   └── Event / Outbox
```

---

## 13. Technology Stack

PRD ปัจจุบันเสนอ:

```text
Frontend
Next.js + React + TypeScript + Tailwind CSS

Backend
Next.js Route Handlers

Database
Supabase PostgreSQL

Authentication
Campus Identity / SSO

Hosting
Vercel Free Tier
```

เหตุผลหลักคือทีมมีประมาณ 3–5 คน ทำภายในหนึ่ง Semester และมีเป้าหมาย Infrastructure Cost ที่ 0 THB/month

---

## 14. ทำไมไม่ใช้ Microservices?

เพราะ MVP ยังไม่จำเป็น

เราไม่ต้องสร้าง:

```text
10 Microservices
Kubernetes
Service Mesh
Message Broker Cluster
```

หลักคือ:

> **Simple enough to build, test, explain, and maintain.**

Architecture ที่ซับซ้อนเกิน requirement จะเพิ่มภาระให้ทีมโดยไม่จำเป็น

---

## 15. ถ้า External Platform ล่ม?

ตัวอย่าง Notification Hub ล่ม:

```text
Create Ticket
    ↓
Persist Ticket
    ↓
Record Event / Outbox
    ↓
Try External Delivery
    ↓
Retry / Handle Failure
```

หลักคือ External failure ไม่ควรทำลาย Core Ticket Record

---

## 16. Race Condition คืออะไร?

เช่น Agent สองคน Assign Ticket เดียวกันพร้อมกัน:

```text
Agent A ── assign Ticket ──┐
                           ├── Database
Agent B ── assign Ticket ──┘
```

ต้องป้องกัน Concurrent Update ด้วย Transaction, Database Constraint หรือ Concurrency Control ที่เหมาะสม

PRD จึงมี `409 VERSION_CONFLICT` สำหรับ Concurrent Update Conflict

---

## 17. Security ที่ต้องทำ

- HTTPS
- Authentication
- Authorization
- Server-side permission checks
- Database policies/RLS เมื่อรองรับ
- Webhook verification
- Environment secrets
- ห้าม commit password/API secrets ลง Git

---

## 18. Tests ขั้นต่ำ 7 ตัว

อาจารย์/PRD กำหนดให้มีอย่างน้อย:

```text
1. Create
2. Ownership
3. Assignment
4. Comment
5. Resolve
6. Maintenance Link
7. Escalation
```

ตัวอย่าง Escalation:

```text
Urgent
+
Open
+
Unassigned
+
> 1 hour
      ↓
ticket.escalated
```

---

## 19. MVP ไม่ทำอะไร?

เพื่อไม่ให้ Scope บาน อย่าเพิ่มสิ่งเหล่านี้เอง:

- Email-to-ticket
- LINE/Messenger/WhatsApp intake
- Phone logging
- Chatbot intake
- LLM ใน request path
- Custom workflow ต่อ Category
- Round-robin assignment
- Mobile App
- File attachments
- Real-time chat
- Full Analytics Dashboard
- CSAT/NPS
- Complex RBAC
- Public API
- Microservices
- Message Broker Cluster

ถ้าจะเพิ่มต้องคุยกับทีมและปรับ Scope อย่างเป็นทางการ

---

## 20. เอกสารใน Repo ควรมีบทบาทอย่างไร?

แนะนำ:

```text
PRD_HELPDESK/
│
├── PRD.final.md              ← PRD หลักของทีม
├── README.md                 ← คู่มือภาษาไทยสำหรับทีม
│
├── docs/
│   ├── architecture.md       ← Architecture Diagram / Detail
│   ├── data-model.md         ← Database / Entity Model
│   ├── api-contract.md       ← REST Contract
│   └── architecture-review.md← Review + Decisions
│
└── ...
```

ไฟล์เก่า เช่น `Problem.md`, `requirement.md`, `DataModel.md`, `architecture.md` สามารถเก็บไว้เป็น Workspace ได้ แต่ `PRD.final.md` ควรเป็นเอกสารกลางที่ทุกคนอ้างอิงร่วมกัน

---

## 21. Presentation ควรดึงอะไรจาก PRD?

**ไม่ต้องเอา PRD ทุกบรรทัดมาแปะลง Slide**

Presentation ควรเป็น Summary ของ PRD เช่น:

1. Problem
2. Product / Purpose
3. Users
4. Core Happy Path
5. MVP Scope
6. Ticket Lifecycle
7. Platform Architecture
8. APIs & Integrations
9. Security
10. AI / Rules
11. Testing
12. Architecture Decisions

PRD = รายละเอียดและ Source of Truth

Presentation = ใช้เล่าให้คนเข้าใจเร็ว

---

## 22. สิ่งที่ทีมต้องตกลงร่วมกันก่อน Implement

### 1. API Contract

Request / Response ต้องตรงกัน

### 2. Event Contract

ต้องตกลงอย่างน้อย:

```text
event_id
event_type
event_version
occurred_at
aggregate_id
payload
```

### 3. Role

ต้องใช้ Role เดียวกัน:

```text
Requester
Agent
Admin
```

### 4. Ticket State

ต้องใช้ Status เดียวกัน:

```text
Open
Assigned
InProgress
Resolved
Closed
```

### 5. External Integration

ต้องคุยกับทีมอื่นเรื่อง:

- Identity Contract
- Maintenance Event Payload
- Notification Event Contract
- Analytics Event Requirements
- Security/Audit Requirements

---

## 23. ถ้าอาจารย์ถาม “Why this architecture?”

ตอบประมาณนี้:

> We chose a simple web application with a managed relational database because the MVP is designed for a 3–5 person team, one academic semester, and a 0 THB/month budget. The architecture keeps Ticket ownership inside Helpdesk while treating Identity, Maintenance, Notification, Security, and Analytics as external contracts.

---

## 24. ถ้าอาจารย์ถาม “Why not microservices?”

> Microservices would introduce operational complexity that is not required by the MVP workload. We prefer a simpler architecture that the team can build, test, explain, and maintain within one semester.

---

## 25. ถ้าอาจารย์ถาม “What makes this a platform?”

> Helpdesk is not an isolated application. It owns the Ticket domain while integrating with external university services through authentication, REST APIs, webhooks, and events.

---

## 26. ถ้าอาจารย์ถาม “Who owns the data?”

ตอบ:

```text
Identity      → Authentication / Identity
Helpdesk      → Ticket
Maintenance   → Work Order
Notification  → Notification Delivery
Analytics     → Analytics
```

และ:

> Helpdesk stores a Maintenance work-order ID instead of duplicating Maintenance records.

---

## 27. เรื่องงาน Week 02 ที่ต้องไม่สับสน

จากสไลด์ Week 02 อาจารย์ให้กลุ่มทำ **Complete and finalize the group PRD** และให้สมาชิกแต่ละคน Review PRD จาก Role ที่ได้รับ โดย Individual submission เป็น **1 A4-page PDF** และมี Deadline 18 August 2026

Roles:

- Product Manager
- Frontend Developer
- Backend Developer
- Quality Assurance / Security
- Delivery / Documentation

ดังนั้น:

```text
PRD.final.md
     ↓
เอกสารกลางของทีม

Individual Review
     ↓
1 A4-page PDF
     ↓
มุมมองตาม Role ของสมาชิก
```

อย่าสับสน `PRD.final.md` กับ Individual Review PDF

---

# 28. สรุปแบบภาษาคน

> เรากำลังสร้าง Helpdesk Platform ที่เป็นเจ้าของ Ticket และเชื่อมกับ Platform อื่นของมหาวิทยาลัย
>
> นักศึกษา/บุคลากรสร้าง Ticket → Helpdesk จัดหมวดและความสำคัญ → Agent รับผิดชอบ → เชื่อม Maintenance ถ้าต้องซ่อม → ติดตามจน Resolve → ส่ง Event ให้ Notification, Security และ Analytics
>
> Identity เป็นคนจัดการ Login, Maintenance เป็นเจ้าของ Work Order, Helpdesk เป็นเจ้าของ Ticket
>
> MVP ใช้ Rules Engine แทน LLM เพื่อให้ core workflow ทำงานได้จริงภายในข้อจำกัดของทีม
>
> Architecture ตั้งใจให้เรียบง่าย: Web App + Relational Database + External Platform Contracts โดยไม่ใช้ Microservices/Kubernetes/Message Broker Cluster ใน MVP

---

## Reference

- `PRD.final.md` — เอกสาร Product Requirements Document หลัก
- `Wk02-Platform_Architecture.pdf` — สไลด์ Week 02 ที่ใช้เป็นกรอบคิดด้าน Platform Architecture และ PRD Review
