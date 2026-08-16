README.md — เวอร์ชันที่ผมแนะนำให้ใช้

ด้านล่างนี้กูจัดใหม่ให้เป็น README สำหรับคนในทีม ไม่ใช่ PRD ซ้ำทั้งไฟล์ แต่ต้องอ่านแล้วเข้าใจว่า PRD ล่าสุดของเรากำหนดอะไร / อาจารย์ต้องการอะไร / ระบบเชื่อมกันยังไง / ห้ามทีมตีความคนละแบบ

# Helpdesk Platform — Team 14


## Team Guide & PRD Overview


> `PRD.final.md` คือ **Product-level Source of Truth** ของทีม
>
> `README.md` ไฟล์นี้มีไว้ให้สมาชิกในทีมเข้าใจตรงกันว่าเรากำลังสร้างอะไร, อาจารย์กำหนดอะไรไว้, ระบบของเราเชื่อมกับ Platform อื่นอย่างไร และ Decision ไหนที่ไม่ควรเปลี่ยนโดยพลการ


---


# 1. โปรเจกต์เราคืออะไร?


เราไม่ได้กำลังสร้างแค่เว็บสำหรับแจ้งปัญหา แต่กำลังออกแบบ **Helpdesk Platform** สำหรับนักศึกษา อาจารย์ และบุคลากร


หน้าที่หลักของ Helpdesk คือ:


Create
   ↓
Triage
   ↓
Assign
   ↓
Track
   ↓
Communicate
   ↓
Resolve

ทุก Support Request จะถูกเปลี่ยนเป็น Ticket ที่มี:

Ticket ID
Requester
Assignee
Category
Priority
Status
Comments
History
Optional Maintenance Work Order ID

แนวคิดหลักของระบบคือ:

Helpdesk owns the Ticket domain. Other university platforms own their own domains.

Helpdesk จึงเป็นเจ้าของข้อมูล Ticket แต่จะไม่เข้าไปเป็นเจ้าของข้อมูลของ Platform อื่น

2. อาจารย์กำหนดอะไรให้เรา?

จาก Helpdesk brief ที่ใช้เป็น Product Requirement หลัก ระบบต้องสามารถ:

Create Ticket
View My Tickets
View Ticket Detail
Assign Ticket
Add Comments
Resolve Ticket
Link Maintenance Work Order
Consume maintenance.status_changed
Publish:
ticket.created
ticket.escalated
ticket.resolved
ใช้ AI เพื่อเสนอ:
Category
Priority
Route
มี Deterministic Fallback เมื่อ AI ใช้งานไม่ได้
มี Automated Tests อย่างน้อย 7 ด้าน

ดังนั้น PRD.final.md ต้องครอบคลุม requirement เหล่านี้ทั้งหมด

3. ทำไมโปรเจกต์นี้ถึงเป็น Platform?

ถ้าเป็น Application ธรรมดา:

Frontend
   ↓
Backend
   ↓
Database

แต่ Helpdesk ของเราไม่ได้อยู่โดดเดี่ยว

                         University Platform
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
       Identity             Maintenance        Notification Hub
          │                     │                     │
          │ SSO                 │ Event             │ Events
          ▼                     ▼                     ▲
                    ┌──────────────────────┐
Requester ─────────►│      HELPDESK        │
                    │      PLATFORM        │
                    └──────────┬───────────┘
                               │
                         ┌─────┴─────┐
                         ▼           ▼
                    Analytics   Security &
                                Compliance

ดังนั้นเราต้องคิดเรื่อง:

Domain Ownership
API Contracts
Authentication
Authorization
REST API
Webhooks
Events
Data Integration
Failure Handling
Security
Testing
AI-assisted capability

ไม่ใช่แค่ CRUD Ticket

4. ใครใช้ระบบ?
Requester

นักศึกษา / อาจารย์ / บุคลากรที่ต้องการความช่วยเหลือ

สามารถ:

Sign in ผ่าน Identity
Create Ticket
View My Tickets
View Ticket Status
View Ticket History
Add Public Comment
Track Resolution

Requester สามารถเข้าถึง Ticket ของตัวเองเท่านั้น

Agent

เจ้าหน้าที่ Helpdesk / Support Staff

สามารถ:

View Agent Queue
Triage Ticket
Change Category
Change Priority
Assign Ticket
Add Public Comment
Add Internal Comment
Link Maintenance Work Order
Resolve Ticket

Agent สามารถ override AI suggestion ได้

Admin

ผู้ดูแลระบบ Helpdesk

สามารถ:

ทำสิ่งที่ Agent ทำได้
Manage Categories
View Basic Ticket Counts
ทำ Administrative Operations ที่ได้รับอนุญาต
5. Core User Journey

นี่คือ Happy Path ที่ทีมควรเข้าใจตรงกัน:

Requester
    ↓
Sign in through Identity
    ↓
Create Ticket
    ↓
AI suggests:
Category + Priority + Route
    ↓
Human Review / Override
    ↓
Ticket Created
    ↓
Agent Queue
    ↓
Triage
    ↓
Assign
    ↓
Work / Comments
    ↓
(Optional) Link Maintenance Work Order
    ↓
Resolve
    ↓
Requester sees updated status
6. Ticket คือ Core Domain ของเรา

Ticket เป็น Core Business Entity ของ Helpdesk

Ticket
├── id
├── requester_id
├── assignee_id
├── category_id
├── subject
├── description
├── priority
├── status
├── maintenance_work_order_id
├── resolution_note
└── timestamps

Comment แยกเป็น Entity:

Comment
├── id
├── ticket_id
├── author_id
├── content
├── visibility
└── timestamp

Category:

Category
├── id
├── name
└── active/deactivated state
7. Ticket Lifecycle

Core Ticket lifecycle:

Open
  ↓
Assigned
  ↓
InProgress
  ↓
Resolved
  ↓
Closed

ความหมาย:

Open

Ticket ถูกสร้างแล้ว แต่ยังไม่มี Agent รับผิดชอบ

Assigned

Ticket มี Agent รับผิดชอบ

InProgress

Agent กำลังดำเนินการ

Resolved

ปัญหาได้รับการแก้ไขแล้ว

Closed

Ticket ถูกปิดและถือว่าจบกระบวนการ

ห้ามเพิ่ม Business Rule เช่น Reopen ภายใน 7 วันเข้าไปเอง ถ้าไม่ได้ตกลงและเพิ่มไว้ใน PRD

8. AI ของเราใช้ทำอะไร?
สำคัญมาก

AI เป็นส่วนหนึ่งของ MVP

ไม่ใช่แค่ Future Improvement

PRD กำหนดให้ AI ช่วยเสนอ:

Category
Priority
Route

ตัวอย่าง:

Ticket


Subject:
Air conditioner is broken


Description:
The air conditioner in classroom B-204
has stopped working.


Urgency:
High

AI อาจเสนอ:

Category: Facility
Priority: High
Route: Maintenance

แต่ AI ไม่ได้เป็นคนตัดสินใจสุดท้าย

9. Human-in-the-Loop

AI เป็นเพียง Triage Assistant

Flow:

Ticket Request
      ↓
   AI Triage
   /   |   \
  ↓    ↓    ↓
Category Priority Route
      ↓
 Human / Agent Review
      ↓
Final Ticket Values

ตัวอย่าง:

AI Suggestion


Category = Facility
Priority = High
Route = Maintenance

Agent สามารถเปลี่ยน:

Category = Facility
Priority = Urgent
Route = Maintenance

ค่าที่ Agent เลือกจะกลายเป็น Authoritative Ticket Data

หลักสำคัญ:

AI suggests. Human decides.

10. ถ้า AI ล่มทำอย่างไร?

ระบบต้องไม่พังเพราะ AI

ถ้า:

AI service unavailable
AI timeout
AI response invalid
AI ให้ค่าที่ระบบไม่อนุญาต
AI ไม่สามารถให้คำแนะนำที่ใช้ได้

ให้ใช้ Deterministic Fallback Rules

Ticket
   ↓
AI Triage
   │
   ├── Success
   │      ↓
   │   Suggestions
   │
   └── Failed / Invalid
          ↓
   Deterministic Rules
          ↓
   Category
   Priority
   Route

Fallback ใช้ข้อมูล เช่น:

Category matching
Urgency
Keywords
Defined routing rules

ดังนั้น:

AI ช่วยให้ระบบฉลาดขึ้น แต่ AI ไม่ใช่ Single Point of Failure

11. AI Safety

AI ต้อง:

ให้คำแนะนำเท่านั้น
เลือกจาก Allowed Categories
เลือกจาก Allowed Priorities
เลือกจาก Allowed Routes
ไม่ bypass Authorization
ไม่เป็นเจ้าของ Ticket state
ไม่สามารถตัดสินใจแทน Agent โดยอัตโนมัติ

Human/Agent ยังคงเป็นผู้รับผิดชอบ Final Decision

12. Identity Platform

Identity เป็นเจ้าของเรื่อง:

Who is this user?

Helpdesk ใช้ Identity สำหรับ Authentication

User
  ↓
Identity
  ↓
Authentication
  ↓
Helpdesk

Helpdesk ไม่เก็บ Password

Identity เป็นเจ้าของ Authentication Credentials

Authentication vs Authorization
Authentication

มึงเป็นใคร?

Authorization

มึงมีสิทธิ์ทำอะไร?

Authorization ต้องตรวจที่ Backend/API

ไม่ควรให้ Frontend เป็นคนตัดสิน Security เพียงอย่างเดียว

13. Maintenance Integration

สมมติ User แจ้ง:

Air conditioner ในห้อง B-204 เสีย

Helpdesk สร้าง:

Ticket #T-001

จากนั้น Agent สามารถ link:

maintenance_work_order_id = M-123

ความสัมพันธ์:

Helpdesk
    │
    │ stores only ID
    ▼
maintenance_work_order_id
    │
    ▼
Maintenance Work Order
สำคัญ

Maintenance เป็นเจ้าของ Work Order

Helpdesk ไม่ copy repair record มาเก็บเอง

ดังนั้น:

Maintenance
    owns
Work Order

และ:

Helpdesk
    owns
Ticket

นี่คือหลัก Data Ownership

14. Maintenance Event

Helpdesk ต้อง consume:

maintenance.status_changed

Flow:

Maintenance
      ↓
maintenance.status_changed
      ↓
Helpdesk Webhook
      ↓
Verify Event
      ↓
Find Ticket
using Work Order ID
      ↓
Update Ticket
      ↓
Publish relevant Helpdesk Event

ดังนั้น Maintenance สามารถเปลี่ยนสถานะของ Work Order แล้ว Helpdesk สามารถตอบสนองต่อการเปลี่ยนแปลงนั้นได้

15. REST API

Required API ตาม PRD:

Method	Endpoint	Purpose
POST	/tickets	Create Ticket
GET	/tickets/me	List requester's tickets
GET	/tickets/{id}	Get Ticket detail
PATCH	/tickets/{id}	Update allowed fields
POST	/tickets/{id}/assign	Assign Ticket
POST	/tickets/{id}/comments	Add Comment
POST	/tickets/{id}/resolve	Resolve Ticket

Supporting integration endpoints อาจมี:

POST /tickets/{id}/link-maintenance


POST /webhooks/maintenance

AI assistance endpoint อาจมี:

POST /tickets/suggest

แต่ endpoint ที่เป็น required contract ต้องไม่ถูกเปลี่ยนโดยพลการ

16. REST vs Event

จำง่าย ๆ:

REST

"Do this."

ตัวอย่าง:

POST /tickets

หมายถึง:

ช่วยสร้าง Ticket ให้หน่อย

Event

"This happened."

ตัวอย่าง:

ticket.created

หมายถึง:

Ticket ถูกสร้างแล้ว

17. Required Events

PRD กำหนด Core Outbound Events 3 ตัว:

ticket.created
ticket.escalated
ticket.resolved

Events เหล่านี้สามารถถูก consume โดย:

Helpdesk
   │
   ├── Notification Hub
   ├── Security & Compliance
   └── Analytics
Additional Domain Events

ระบบอาจมี supporting events เช่น:

ticket.assigned
ticket.status_changed
ticket.work_order_linked

แต่ต้องเข้าใจว่า:

สามตัวนี้เป็น Additional Domain Events ไม่ใช่สาม Core Events ที่อาจารย์กำหนดเป็น requirement หลัก

18. Escalation

Ticket จะเข้าเงื่อนไข Escalation เมื่อ:

Priority = Urgent
AND
Status = Open
AND
No Assignee
AND
Waiting > 1 hour

จากนั้น:

ticket.escalated

จะถูก publish

Flow:

Urgent
  +
Open
  +
Unassigned
  +
> 1 hour
       ↓
ticket.escalated
19. Data Ownership

นี่คือหลักที่ทุกคนในทีมต้องเข้าใจตรงกัน:

Data	Owner
Authentication Credentials	Identity
Ticket	Helpdesk
Category	Helpdesk
Comment	Helpdesk
Maintenance Work Order	Maintenance
Notification Delivery	Notification Hub
Analytics Records	Analytics

หลัก:

Each platform domain owns its own data.

Helpdesk ใช้ Integration Contract และ External Reference แทนการ copy data ของ Platform อื่น

20. Platform Architecture
                         University Platform
                                │
          ┌─────────────────────┼─────────────────────┐
          │                     │                     │
       Identity             Maintenance        Notification Hub
          │                     │                     │
         SSO              status_changed             │
          │                     │                     │
          ▼                     ▼                     ▲
                  ┌────────────────────────┐
                  │    HELPDESK PLATFORM    │
                  │                        │
                  │ Web UI                 │
                  │    ↓                   │
                  │ API / Application      │
                  │    ↓                   │
                  │ AI Triage              │
                  │    ↓                   │
                  │ Fallback Rules         │
                  │    ↓                   │
                  │ Helpdesk Data Store    │
                  │                        │
                  │ Ticket                 │
                  │ Category               │
                  │ Comment                │
                  └───────────┬────────────┘
                              │
                       ┌──────┴──────┐
                       ▼             ▼
                   Analytics    Security &
                                Compliance

Architecture หลักของเราต้องแสดง:

Domain Ownership
API Contracts
Authentication Delegation
Event Integration
Maintenance Webhook
AI-assisted Capability
Security Boundaries

โดยไม่จำเป็นต้องสร้าง Microservices ที่ซับซ้อนเกิน MVP

21. ทำไมไม่ใช้ Microservices?

MVP ไม่จำเป็นต้องใช้:

Microservices
Kubernetes
Service Mesh
Message Broker Cluster

เพราะเพิ่ม Operational Complexity

หลักของทีมคือ:

Simple enough to build, test, explain, and maintain.

เราเน้นให้ Architecture รองรับ Platform Integration โดยไม่สร้าง Infrastructure ที่เกิน Scope

22. Technology Direction

PRD ปัจจุบันกำหนดทิศทางไว้ว่า:

Frontend
Next.js + TypeScript + Tailwind


Backend / API
Next.js Route Handlers


Database
PostgreSQL ผ่าน Managed Platform


Authentication
University Identity Integration


Hosting
ทีมเลือก Deployment Platform ที่ตกลงกัน


Testing
Unit / Integration / E2E ตามความเหมาะสม

Technology สามารถเปลี่ยนได้ตาม Implementation Decision

แต่สิ่งที่ ห้ามเปลี่ยนเพราะ Technology เปลี่ยน คือ:

Ticket Ownership
API Contract
Data Ownership
Integration Contract
Security Boundary
Required Events
AI + Fallback Requirement
23. ถ้า External Platform ล่ม?

External Platform ไม่ควรทำให้ Core Ticket Data หาย

ตัวอย่าง:

Create Ticket
      ↓
Persist Ticket
      ↓
Record Event
      ↓
Try External Delivery
      ↓
Retry / Failure Handling

หลัก:

External integration failure must not destroy the core Ticket record.

ระบบควรมีวิธีจัดการ Event Delivery Failure และสามารถตรวจสอบสถานะของ Failure ได้

24. Security

ระบบต้องมี:

Authentication ผ่าน Identity
Authorization
Server-side permission checks
Ticket ownership protection
Internal Comment visibility
Webhook verification
Secret management
HTTPS
ไม่เก็บ Password ใน Helpdesk
ไม่ commit API secrets / credentials ลง Git
25. Comment Visibility

Comment มีอย่างน้อย 2 แบบ:

Public Comment
Internal Comment
Public Comment

Requester และ Authorized Agent สามารถเห็นได้

Internal Comment

สำหรับ Agent/Admin

Requester ห้ามเห็น

นี่เป็น Business Rule สำคัญของระบบ

26. Required Automated Tests

PRD กำหนดขั้นต่ำ 7 ด้าน:

1. Create Ticket
2. Ticket Ownership / Access Control
3. Assignment
4. Comment
5. Resolve
6. Maintenance Link
7. Escalation Event

Recommended เพิ่มเติม:

AI suggestion validation
AI fallback behavior
Internal comment visibility
Maintenance webhook verification
Duplicate event handling
Unauthorized ticket access
Invalid AI output
Event publishing failure
27. MVP Scope
In Scope
Create Ticket
My Tickets
Ticket Detail / Status
Agent Queue
Assignment
Public Comments
Internal Comments
Resolution
Maintenance Work-order Linking
Category Management
Basic Ticket Counts
Identity Integration
REST API
AI-assisted Category/Priority/Route
Deterministic Fallback
Maintenance Status Integration
Outbound Events
Notification Integration
Security
Authorization
Automated Testing
28. Out of Scope

MVP ไม่รวม:

Native iOS / Android App
Real-time Chat
Email-to-Ticket
LINE / Messenger / WhatsApp Intake
Full Enterprise Workflow Engine
Microservices / Kubernetes Deployment
Full Analytics Dashboard
Helpdesk-owned Maintenance Work Orders
Helpdesk-owned Authentication Credentials
Autonomous AI Decisions without Human Control

ถ้าจะเพิ่ม Feature เหล่านี้ ต้องคุยกับทีมและปรับ Scope/PRD ก่อน

29. Acceptance Criteria

MVP ถือว่าทำงานครบเมื่อ:

Requester สามารถ Authenticate
Requester สามารถ Create Ticket
ระบบสร้าง Unique Ticket ID
AI สามารถเสนอ Category / Priority / Route
Fallback ทำงานเมื่อ AI unavailable
Requester เห็น Ticket ของตัวเอง
Agent เข้าถึง Queue
Agent Assign Ticket ได้
Agent เปลี่ยน Category/Priority ได้
Public/Internal Comments ทำงานตาม Visibility
Link Maintenance Work Order ได้
maintenance.status_changed สามารถ update linked ticket
ticket.created ถูก publish
ticket.escalated ถูก publish ตาม rule
ticket.resolved ถูก publish
Downstream consumers รับ events ได้
Unauthorized users เข้าถึง Ticket คนอื่นไม่ได้
Required automated tests อย่างน้อย 7 ตัวผ่าน
30. Decisions ที่ทีมไม่ควรเปลี่ยนเอง

ถ้าจะเปลี่ยนเรื่องเหล่านี้ต้องคุยกับทีมก่อน:

1. Data Ownership
Helpdesk → Ticket
Maintenance → Work Order
Identity → Authentication
2. Maintenance Integration

Helpdesk เก็บ:

maintenance_work_order_id

ไม่ copy Work Order

3. AI
AI → Suggest
Human / Agent → Decide
4. AI Fallback
AI unavailable
      ↓
Deterministic Rules
5. Required Events
ticket.created
ticket.escalated
ticket.resolved
6. Required API Contracts

ห้ามเปลี่ยน Endpoint โดยไม่ตกลงกัน

7. Security

Requester ต้องไม่เข้าถึง Ticket ของคนอื่น

8. Testing

ต้องมีอย่างน้อย 7 Required Test Areas

31. ถ้าอาจารย์ถามว่า “What makes this a Platform?”

ตอบ:

Helpdesk is not an isolated CRUD application. It owns the Ticket domain while integrating with other university platforms through authentication, REST APIs, webhooks, and events.

32. ถ้าอาจารย์ถามว่า “Who owns the data?”

ตอบ:

Identity
    → Authentication Credentials


Helpdesk
    → Ticket
    → Category
    → Comment


Maintenance
    → Work Order


Notification Hub
    → Notification Delivery


Analytics
    → Analytics Records

และพูดต่อว่า:

Helpdesk stores only the Maintenance Work Order ID instead of duplicating Maintenance records.

33. ถ้าอาจารย์ถามว่า “How do you use AI?”

ตอบ:

We use AI as an assisted triage capability. When a ticket is created, AI analyzes the ticket information and proposes a category, priority, and route. The suggestion is validated and can be accepted or overridden by the authorized user or Agent. If AI is unavailable or returns invalid output, the system falls back to deterministic rules.

จำง่าย ๆ:

AI = Assistant
Human = Final Decision
Rules = Fallback
34. ถ้าอาจารย์ถามว่า “What if AI is down?”

ตอบ:

We use deterministic fallback rules based on category, urgency, and routing rules, so ticket creation and triage can continue without depending completely on the AI service.

35. ถ้าอาจารย์ถามว่า “Why not Microservices?”

ตอบ:

Microservices would introduce operational complexity that is not required by the MVP. We prefer a simpler architecture that the team can build, test, explain, and maintain within one semester.

36. ถ้าอาจารย์ถามว่า “Why don't you copy Maintenance data?”

ตอบ:

Because Maintenance owns the Work Order domain. Helpdesk only stores the linked Work Order ID, preventing duplicate records and conflicting sources of truth.

37. Source of Truth

ลำดับความสำคัญของเอกสาร:

Professor's Helpdesk Brief
          ↓
      PRD.final.md
          ↓
Architecture / API / Data Model / Tests
          ↓
README.md

ดังนั้น:

PRD.final.md = Product-level Source of Truth

README มีหน้าที่อธิบาย PRD ให้ทีมเข้าใจง่าย ไม่ควรสร้าง Requirement ใหม่ที่ไม่มีใน PRD

38. Final Concept

โปรเจกต์ของเราสรุปได้ว่า:

Helpdesk is the owner of the Ticket domain. AI assists triage, humans remain in control, and other university platforms communicate through stable contracts and events.

หรือพูดแบบง่าย ๆ:

เราสร้าง Platform ที่รับและจัดการ Ticket เป็นเจ้าของข้อมูล Ticket เอง เชื่อม Identity สำหรับ Login เชื่อม Maintenance ด้วย Work Order ID และ Event เชื่อม Notification, Security และ Analytics ผ่าน Platform Contracts โดยใช้ AI ช่วยจัดหมวด Priority และ Route แต่ยังให้คนเป็นผู้ตัดสินใจ และมี Rule-based Fallback เมื่อ AI ใช้งานไม่ได้



