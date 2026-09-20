# A5 Integration Preparation — Helpdesk Team 14 × Wellbeing Team 16

> Purpose: align both teams on the Helpdesk PRD, partner responsibilities, integration flow, contract requirements, testing, and A5 evidence.
>
> Important: this document does not invent Wellbeing's API contract. Endpoint names, payload fields, status values, authentication, and event names must be confirmed from Team 16's actual contract.

---

# PART A — ภาษาไทย

## 1. ทวน PRD ของ Helpdesk Team 14

Helpdesk เป็นระบบสำหรับให้นักศึกษา อาจารย์ และบุคลากรสร้าง support request และให้ Agent จัดการ ticket ตั้งแต่รับเรื่อง, triage, assign, priority/category, comment, link external work/request, resolve และติดตามสถานะ

หลักการสำคัญของ PRD:

> **Helpdesk เป็นเจ้าของ Ticket domain ส่วนระบบอื่นเป็นเจ้าของ domain ของตัวเอง**

ดังนั้น Helpdesk ควรเก็บ external reference ที่จำเป็น แทนการ copy ข้อมูล domain ของระบบอื่นทั้งหมดเข้ามา

### Roles

| Role | หน้าที่ |
|---|---|
| Requester | สร้าง Ticket, ดู Ticket ของตัวเอง, ดูสถานะ, เพิ่ม public comment |
| Agent | ดู queue, triage, assign, เปลี่ยน category/priority, comment, link external record, resolve |
| Admin | จัดการ category, ดู ticket counts และงาน administrative |

### MVP ที่เกี่ยวข้องกับ A5

- Create Ticket
- My Tickets / Ticket Detail
- Agent Queue
- Assignment
- Public / Internal Comments
- Resolution / Reopen
- Category / Priority
- REST API
- Rule-based / AI-assisted suggestion
- External integration
- Outbound events
- Notification integration
- Security / Authorization
- Automated testing

---

## 2. Integration ที่ PRD เดิมระบุ

PRD Final ของ Helpdesk ระบุ Maintenance integration โดยตรง:

```text
POST /api/tickets/{id}/link-maintenance
POST /api/webhooks/maintenance
```

Incoming event:

```text
maintenance.status_changed
```

Helpdesk outbound events ที่ระบุไว้:

```text
ticket.created
ticket.assigned
ticket.resolved
ticket.escalated
ticket.status_changed
ticket.work_order_linked
```

### Existing Maintenance flow จาก PRD

```text
Agent links Ticket to Maintenance Work Order
                ↓
        Maintenance updates Work Order
                ↓
       maintenance.status_changed
                ↓
          Helpdesk Webhook
                ↓
            Verify Event
                ↓
        Find linked Work Order
                ↓
           Update Ticket
                ↓
     Publish ticket.status_changed
                ↓
       Requester sees status
```

### เมื่อเปลี่ยน Partner เป็น Wellbeing

PRD เดิมระบุ Maintenance-specific integration ไม่ได้ระบุ Wellbeing-specific contract ดังนั้น:

- หลักการของ Helpdesk domain ยังเหมือนเดิม
- ต้องตกลง integration contract ใหม่กับ Wellbeing
- ห้ามสมมติว่า Wellbeing ใช้ `maintenance.status_changed`
- ห้ามเดาชื่อ endpoint, field, status หรือ authentication
- ต้องตกลงว่า Ticket จะ reference Wellbeing record ตัวใด
- ต้องระบุใน A5 ว่าเป็น cross-team integration ที่ implement ระหว่าง Team 14 และ Team 16

Concept:

```text
Helpdesk Ticket
      ↓
Reference Wellbeing record
      ↓
Wellbeing status/event
      ↓
Helpdesk integration endpoint
      ↓
Verify + validate
      ↓
Find linked Ticket
      ↓
Update Ticket
      ↓
Publish Helpdesk event
```

---

# 3. สิ่งที่ Helpdesk ต้องการจาก Wellbeing

ก่อนเขียน integration ทั้งสองทีมต้องตกลง contract ก่อน

Wellbeing ต้องส่งให้ Helpdesk:

1. API endpoint
2. HTTP method
3. Authentication method
4. Request headers
5. Request body
6. Response body
7. Error response
8. External resource ID
9. Status values
10. Event names
11. Webhook payload
12. Idempotency identifier

ตัวอย่างโครง payload ด้านล่างเป็นเพียง placeholder ไม่ใช่ contract บังคับ:

```json
{
  "event_id": "...",
  "event_type": "...",
  "occurred_at": "...",
  "resource_id": "...",
  "status": "..."
}
```

---

# 4. Wellbeing Team 16 ต้องทำอะไร

## W1 — ส่ง API Contract

ระบุ endpoint, method, request, response, resource ID, status, event, webhook payload, authentication, error และ idempotency

## W2 — เตรียม API ที่ Helpdesk ต้องเรียก

ถ้า contract กำหนดให้ Helpdesk เป็น Consumer:

```text
Helpdesk → Wellbeing API → Response
```

Wellbeing ต้องมี endpoint ที่ใช้งานได้และตัวอย่าง request/response

## W3 — ทำ Webhook Sender เมื่อ Contract กำหนด

ถ้า Wellbeing เป็นผู้ส่ง event:

```text
Wellbeing
   ↓ trigger
Create outgoing payload
   ↓
Authenticate
   ↓
Send to Helpdesk webhook
   ↓
Store request/response log
```

## W4 — ช่วยทดสอบ Idempotency

ส่ง event เดิมซ้ำ:

```text
Request 1 → processed
Request 2 → duplicate handled
```

## W5 — ช่วยทดสอบ Degradation/Recovery

ถ้า A5 contract กำหนด:

```text
Partner unavailable
      ↓
Helpdesk handles failure
      ↓
Fallback/error
      ↓
Recovery
```

---

# 5. Helpdesk Team 14 ต้องทำอะไร

## H1 — Review Wellbeing Contract

ตรวจ endpoint, method, fields, external ID, status, authentication, event ID และ error format ให้ตรงกัน

## H2 — กำหนด Ticket Reference

Conceptually:

```text
Helpdesk Ticket
      │
      └── external Wellbeing record ID
```

เก็บเฉพาะ reference ที่จำเป็น ไม่ copy Wellbeing domain ทั้งชุด

## H3 — Implement Consumer ถ้าต้องเรียก Wellbeing

```text
Helpdesk → Wellbeing API → Response
```

เก็บ URL, timestamp, request, response และ HTTP status

## H4 — Implement Provider/Webhook Receiver ถ้า Wellbeing ส่ง event

```text
Wellbeing
    ↓
Helpdesk Webhook
    ↓
Authenticate
    ↓
Validate
    ↓
Find linked Ticket
    ↓
Update Ticket
```

## H5 — Authentication

Valid request → process

Invalid request → reject

## H6 — Payload Validation

ตรวจ field ตาม contract เช่น event ID, event type, external ID, status, timestamp และ required fields

## H7 — Idempotency

```text
event_id = EVT-001

Request #1 → Process
Request #2 → Detect duplicate → No duplicate DB effect
```

## H8 — Update Ticket

```text
Wellbeing event
      ↓
Find external ID
      ↓
Find linked Ticket
      ↓
Apply permitted update
      ↓
Save
```

## H9 — Publish Helpdesk Event

หลัง update สำเร็จ ให้ publish event ที่ตกลงกัน เช่น `ticket.status_changed`

---

# 6. Consumer / Provider

Role ขึ้นกับ interaction แต่ละตัว ไม่ใช่กำหนดว่าทีมหนึ่งเป็น Consumer ตลอดงาน

| Interaction | Consumer | Provider |
|---|---|---|
| Helpdesk calls Wellbeing API | Helpdesk | Wellbeing |
| Wellbeing calls Helpdesk Webhook | Wellbeing | Helpdesk |
| Helpdesk publishes event | Event consumers | Helpdesk |
| Wellbeing publishes event | Event consumers | Wellbeing |

---

# 7. A5 Evidence ที่ต้องเก็บ

อาจารย์กำหนด 6 ส่วน:

## 1. Consumer Proof

- Partner URL
- Request timestamp
- Response body screenshot

## 2. Provider Proof

- Your endpoint URL
- Internal request log
- Partner confirmation

## 3. Webhook Receiver

- Incoming payload
- Secret/authentication verification result
- Stored/processing log

## 4. Webhook Sender

- Internal trigger action
- Outgoing payload
- Partner response log

## 5. Idempotency Proof

- Request 1
- Request 2
- DB/result proving a single effect

## 6. Degradation Proof

- Failure timestamp
- Fallback/error JSON
- Recovery log

---

# 8. Joint Test Plan

### Test 01 — Normal API Request

```text
Helpdesk → Wellbeing API → Expected response
```

### Test 02 — Link / Reference

```text
Helpdesk Ticket → Wellbeing external ID → Verify stored reference
```

### Test 03 — Webhook Success

```text
Wellbeing → Valid event → Helpdesk → Verify → Update Ticket
```

### Test 04 — Invalid Authentication

```text
Invalid credentials → Helpdesk → Reject
```

### Test 05 — Duplicate Event

```text
Same event
Request #1 → processed
Request #2 → duplicate handled
```

### Test 06 — Unknown External ID

```text
Unknown Wellbeing ID → Helpdesk → Reject / handle error
```

### Test 07 — Partner Failure

```text
Wellbeing unavailable → Helpdesk failure handling → Fallback/error → Recovery
```

---

# 9. ห้ามเดาข้อมูลเหล่านี้

ต้องรอ Team 16 ยืนยัน:

```text
- Wellbeing endpoint names
- HTTP methods
- Event names
- Resource ID names
- Status values
- Payload fields
- Authentication format
- Error codes
- Idempotency identifier
```

ตัวอย่าง `appointment_id`, `request_id`, `case_id` เป็นเพียง placeholder

---

# 10. Definition of Done

## Helpdesk Team 14

- [ ] Review Wellbeing API contract
- [ ] Agree external resource/ID
- [ ] Implement required consumer call
- [ ] Implement required provider/webhook endpoint
- [ ] Implement authentication verification
- [ ] Validate payload
- [ ] Implement idempotency
- [ ] Update linked Ticket
- [ ] Publish required Helpdesk event
- [ ] Test normal flow
- [ ] Test invalid authentication
- [ ] Test duplicate event
- [ ] Test invalid external ID
- [ ] Test degradation/recovery where required
- [ ] Collect A5 evidence

## Wellbeing Team 16

- [ ] Provide API contract
- [ ] Provide endpoint(s)
- [ ] Provide request/response examples
- [ ] Define external resource ID
- [ ] Define event(s)
- [ ] Define status values
- [ ] Define authentication
- [ ] Implement required outbound request/webhook
- [ ] Provide request/response logs
- [ ] Test with Helpdesk
- [ ] Test duplicate event
- [ ] Test failure/recovery where required
- [ ] Confirm successful integration
- [ ] Provide partner confirmation evidence

---

# 11. Final Joint Workflow

```text
1. Helpdesk shares PRD requirements
        ↓
2. Wellbeing shares API contract
        ↓
3. Both teams compare contracts
        ↓
4. Agree endpoint + method + payload + ID
   + event + status + authentication + errors
        ↓
5. Both teams implement their own side
        ↓
6. Connect the systems
        ↓
7. Test normal API flow
        ↓
8. Test webhook flow
        ↓
9. Test authentication/security
        ↓
10. Test idempotency
        ↓
11. Test degradation/recovery
        ↓
12. Collect Evidence 1–6
        ↓
13. Prepare A5-Team14-Integration-Evidence.md
```

---

# PART B — ENGLISH

## 1. Helpdesk Team 14 — PRD Summary

The Helpdesk Platform allows students, faculty, and staff to create support requests. Agents triage, assign, prioritize, communicate, link external records, resolve, and track Tickets.

Core principle:

> **Helpdesk owns the Ticket domain. Other university platforms own their own domains.**

Helpdesk should reference external-domain data rather than copying the external domain into its own database.

### Relevant MVP capabilities

- Ticket creation and tracking
- Agent queue
- Assignment
- Public/internal comments
- Resolution/reopening
- Category/priority
- REST API
- Rule-based / AI-assisted suggestion
- External integration
- Outbound events
- Notification integration
- Security/authorization
- Automated testing

---

## 2. Existing Helpdesk Integration

The current Helpdesk PRD explicitly defines Maintenance integration:

```text
POST /api/tickets/{id}/link-maintenance
POST /api/webhooks/maintenance
```

Incoming event:

```text
maintenance.status_changed
```

Outbound Helpdesk events:

```text
ticket.created
ticket.assigned
ticket.resolved
ticket.escalated
ticket.status_changed
ticket.work_order_linked
```

Existing flow:

```text
Agent links Ticket to Maintenance Work Order
        ↓
Maintenance updates Work Order
        ↓
maintenance.status_changed
        ↓
Helpdesk Webhook
        ↓
Verify Event
        ↓
Find linked Work Order
        ↓
Update Ticket
        ↓
Publish ticket.status_changed
        ↓
Requester sees status
```

If Wellbeing is selected for A5, this Maintenance-specific contract must not simply be copied. The two teams must agree a Wellbeing-specific contract.

---

## 3. What Helpdesk Needs from Wellbeing

Wellbeing should provide:

1. API endpoint
2. HTTP method
3. Authentication
4. Request headers
5. Request body
6. Response body
7. Error response
8. External resource ID
9. Status values
10. Event names
11. Webhook payload
12. Idempotency identifier

Example payload only:

```json
{
  "event_id": "...",
  "event_type": "...",
  "occurred_at": "...",
  "resource_id": "...",
  "status": "..."
}
```

The actual contract must come from Team 16.

---

## 4. Wellbeing Team 16 Responsibilities

### W1 — Provide API Contract

Document endpoint, method, request, response, resource ID, status, events, webhook payload, authentication, errors, and idempotency.

### W2 — Provide Required API Endpoint(s)

If Helpdesk is the Consumer:

```text
Helpdesk → Wellbeing API → Response
```

### W3 — Implement Webhook Sender When Required

```text
Wellbeing
   ↓ trigger
Create payload
   ↓
Authenticate
   ↓
Send to Helpdesk webhook
   ↓
Store request/response log
```

### W4 — Support Idempotency Testing

```text
Request 1 → processed
Request 2 → duplicate handled
```

### W5 — Support Degradation/Recovery Testing

Where required:

```text
Wellbeing unavailable
        ↓
Helpdesk handles failure
        ↓
Fallback/error
        ↓
Recovery
```

---

## 5. Helpdesk Team 14 Responsibilities

### H1 — Review the Contract

Verify endpoint, method, fields, external ID, status, authentication, event ID, and error format.

### H2 — Define Ticket Reference

```text
Helpdesk Ticket
      │
      └── external Wellbeing record ID
```

### H3 — Implement Consumer Behavior When Required

```text
Helpdesk → Wellbeing API → Response
```

Record URL, timestamp, request, response, and HTTP status.

### H4 — Implement Provider/Webhook Receiver When Required

```text
Wellbeing
    ↓
Helpdesk Webhook
    ↓
Authenticate
    ↓
Validate
    ↓
Find linked Ticket
    ↓
Update Ticket
```

### H5 — Authentication

Valid credentials → process.

Invalid credentials → reject.

### H6 — Payload Validation

Validate required fields according to the agreed contract.

### H7 — Idempotency

```text
event_id = EVT-001

Request #1 → Process
Request #2 → Detect duplicate → No duplicate DB effect
```

### H8 — Update Ticket

```text
Wellbeing event
      ↓
Find external ID
      ↓
Find linked Ticket
      ↓
Apply permitted update
      ↓
Save
```

### H9 — Publish Required Helpdesk Event

After a successful update, publish the agreed event, such as `ticket.status_changed`.

---

## 6. Consumer / Provider Roles

| Interaction | Consumer | Provider |
|---|---|---|
| Helpdesk calls Wellbeing API | Helpdesk | Wellbeing |
| Wellbeing calls Helpdesk Webhook | Wellbeing | Helpdesk |
| Helpdesk publishes event | Event consumers | Helpdesk |
| Wellbeing publishes event | Event consumers | Wellbeing |

Roles are defined per interaction, not permanently per team.

---

## 7. A5 Evidence Audit

### 1. Consumer Proof

- Partner URL
- Request timestamp
- Response body screenshot

### 2. Provider Proof

- Endpoint URL
- Internal request log
- Partner confirmation

### 3. Webhook Receiver

- Incoming payload
- Authentication/secret verification result
- Stored/processing log

### 4. Webhook Sender

- Internal trigger action
- Outgoing payload
- Partner response log

### 5. Idempotency Proof

- Request 1
- Request 2
- Database/result proving a single effect

### 6. Degradation Proof

- Failure timestamp
- Fallback/error JSON
- Recovery log

---

## 8. Joint Test Plan

1. Normal API request
2. Link/reference external record
3. Valid webhook
4. Invalid authentication
5. Duplicate event
6. Unknown external ID
7. Partner failure and recovery

---

## 9. Do Not Invent Wellbeing Contract Details

The following must be confirmed by Team 16:

```text
- Endpoint names
- HTTP methods
- Event names
- Resource ID names
- Status values
- Payload fields
- Authentication format
- Error codes
- Idempotency identifier
```

Examples such as `appointment_id`, `request_id`, and `case_id` are placeholders only.

---

## 10. Definition of Done

### Helpdesk Team 14

- [ ] Review Wellbeing contract
- [ ] Agree external resource/ID
- [ ] Implement required consumer call
- [ ] Implement required provider/webhook endpoint
- [ ] Authentication verification
- [ ] Payload validation
- [ ] Idempotency
- [ ] Ticket update
- [ ] Required Helpdesk event
- [ ] Normal-flow test
- [ ] Invalid-authentication test
- [ ] Duplicate-event test
- [ ] Invalid-ID test
- [ ] Degradation/recovery test where required
- [ ] A5 evidence collection

### Wellbeing Team 16

- [ ] Provide API contract
- [ ] Provide endpoint(s)
- [ ] Provide request/response examples
- [ ] Define external resource ID
- [ ] Define event(s)
- [ ] Define status values
- [ ] Define authentication
- [ ] Implement required outbound request/webhook
- [ ] Provide request/response logs
- [ ] Test with Helpdesk
- [ ] Duplicate-event test
- [ ] Failure/recovery test where required
- [ ] Confirm successful integration
- [ ] Partner confirmation evidence

---

# Final Shared Workflow

```text
PRD requirements
      ↓
Wellbeing API contract
      ↓
Shared contract review
      ↓
Agree endpoint + method + payload + ID
+ event + status + authentication + errors
      ↓
Implement both sides
      ↓
Connect systems
      ↓
Normal API test
      ↓
Webhook test
      ↓
Security/authentication test
      ↓
Idempotency test
      ↓
Degradation/recovery test
      ↓
Collect A5 Evidence 1–6
      ↓
Submit A5-Team14-Integration-Evidence.md
```

---

# Source / Reference

This document is based on the current **Helpdesk Team 14 PRD.final.md**, especially its product scope, user journeys, API surface, external integrations, Maintenance event flow, and domain-ownership principle. The A5 Evidence section follows the instructor's Assignment #5 Evidence Audit shown by the team.

**Key rule:** PRD → Partner API Contract → Shared Contract → Implementation → Integration Test → Evidence.
