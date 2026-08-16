# Product Requirements Document — Helpdesk Platform (Team 14)

**Version:** 1.0 Final  
**Status:** Final / Implementation-Ready  
**Product:** Helpdesk Platform (Helpdesk MFU)  
**Target:** Student and staff support requests  
**Project Type:** One-semester university MVP  
**Team Size:** 3–5 students  
**Budget:** 0 THB/month; free-tier services only  

---

## 1. Product Overview

### 1.1 Purpose

The Helpdesk Platform provides a single, structured, and trackable channel for students and staff to report support issues and follow them through to resolution.

The platform gives every request:

- A unique Ticket ID
- A requester/owner
- A current status
- A priority and category
- A comment history
- An event trail for integration with other systems

The goal is to replace fragmented support requests across email, LINE groups, in-person visits, and ad-hoc direct messages with one consistent workflow.

### 1.2 Problem Statement

Students and staff currently have no single structured channel for reporting and tracking support requests. Requests can be lost, forgotten, duplicated, or handled without a clear owner. Status visibility is limited, prioritization is inconsistent, and coordination between Helpdesk and Maintenance may require manually copying information between systems.

The Helpdesk Platform addresses these problems by providing a centralized ticket lifecycle and controlled integrations with Identity, Maintenance, Notification Hub, Security & Compliance, and Analytics.

### 1.3 Product Goal

> Give every support request an identity, an owner, a status, and an event trail.

The MVP focuses on a small set of capabilities that can realistically be delivered by a 3–5 person student team within one academic semester.

---

## 2. Target Users and Stakeholders

| Role | Description | Main Needs |
|---|---|---|
| Requester | Students, faculty, and staff | Create requests, receive a Ticket ID, track status, and communicate through comments |
| Agent | Helpdesk/front-line support staff | View the queue, triage, assign, prioritize, communicate, link Maintenance work orders, and resolve tickets |
| Admin | Helpdesk lead/supervisor | Manage categories, monitor basic ticket counts, and perform administrative operations |
| Identity Team | External system stakeholder | Provides authentication and user identity |
| Maintenance Team | External system stakeholder | Provides work-order status changes |
| Notification Hub | External system stakeholder | Receives ticket events and delivers notifications |
| Security & Compliance | External stakeholder | Consumes relevant events/log information for audit and review |
| Analytics | External stakeholder | Consumes ticket events for analysis |

---

## 3. Product Scope

### 3.1 MVP In Scope

The MVP includes:

1. Campus Identity/SSO login
2. Create Ticket
3. My Tickets
4. Ticket Detail
5. Agent Queue
6. Ticket assignment
7. Category and priority management
8. Public and internal comments
9. Maintenance work-order linking
10. Ticket resolution and reopening
11. Rule-based category/priority suggestions
12. Ticket escalation for urgent unassigned tickets
13. Notification Hub integration
14. Maintenance status integration
15. Event publishing
16. Basic Admin ticket counts
17. Role-based access control
18. Audit-oriented event logging
19. Automated tests for core workflows

### 3.2 Main Screens

The MVP provides these responsive web screens:

- Create Ticket
- My Tickets
- Ticket Detail
- Agent Queue
- Admin Counts
- Category Manager

---

## 4. User Journeys

### 4.1 Requester Journey

1. Log in through the campus Identity service.
2. Open **Create Ticket**.
3. Enter subject, description, category, and urgency.
4. The system suggests a category and priority using a deterministic rules engine.
5. The requester may accept or override the suggestion.
6. Submit the ticket.
7. The system creates a unique Ticket ID.
8. The requester is redirected to the ticket detail page.
9. The requester can view the ticket in **My Tickets**.
10. The requester can add public comments.
11. If the ticket is resolved, the requester may reopen it within 7 days.

### 4.2 Agent Journey

1. Log in as an Agent.
2. Open the **Agent Queue**.
3. Review tickets sorted by priority and age.
4. Open a ticket and review its details and comments.
5. Assign the ticket to themselves or another Agent.
6. Change category or priority when necessary.
7. Add internal comments when internal communication is required.
8. Link the ticket to a Maintenance work-order ID when applicable.
9. Resolve the ticket with an optional resolution note.
10. The system publishes the appropriate event and triggers notification processing.

### 4.3 Cross-Team Maintenance Journey

1. An Agent links a Helpdesk Ticket to an existing Maintenance work-order ID.
2. Maintenance updates the linked work order.
3. Maintenance sends a `maintenance.status_changed` event to the Helpdesk webhook.
4. The Helpdesk verifies the incoming request and identifies the linked ticket.
5. The ticket status is updated.
6. The Helpdesk publishes a corresponding ticket status-change event.
7. The requester can see the updated status without manual data re-entry.

---

## 5. Functional Requirements

| ID | Requirement | Priority |
|---|---|---|
| FR-01 | Users can log in through the campus Identity service (SSO). Helpdesk does not store passwords. | Must |
| FR-02 | A logged-in user can create a ticket with subject, description, category, and urgency. The system returns a unique Ticket ID. | Must |
| FR-03 | Ticket creation publishes `ticket.created` containing Ticket ID, requester ID, category, priority, and timestamp. | Must |
| FR-04 | A logged-in user can view their own tickets with current status, last update, and category. | Must |
| FR-05 | A logged-in user can view details, status history, and comments for their own ticket. Agents/Admins can view all tickets. | Must |
| FR-06 | A user can add a public plain-text comment to their own ticket. | Must |
| FR-07 | The system suggests category and priority using a deterministic keyword + urgency rules engine. The suggestion is non-binding. | Must |
| FR-08 | An Agent can open the Agent Queue and sort tickets by priority and age. | Must |
| FR-09 | An Agent can assign a ticket to themselves or another Agent. | Must |
| FR-10 | An Agent can change a ticket's category and priority. | Must |
| FR-11 | Agents/Admins can add internal comments that Requesters cannot see. | Must |
| FR-12 | An Agent/Admin can link a ticket to an existing Maintenance work-order ID. | Must |
| FR-13 | An Agent/Admin can mark a ticket as Resolved and provide a resolution note. The system publishes `ticket.resolved`. | Must |
| FR-14 | When a linked Maintenance work order changes status, the Helpdesk consumes `maintenance.status_changed` and updates the related ticket. | Must |
| FR-15 | An Urgent ticket that remains unassigned for more than one hour publishes `ticket.escalated`. | Must |
| FR-16 | The system sends notification requests to the Notification Hub for `ticket.created`, `ticket.assigned`, and `ticket.resolved`. | Must |
| FR-17 | An Agent/Admin can view basic counts: total tickets, open tickets, resolved today, and counts by category. | Should |
| FR-18 | An Admin can add, rename, and deactivate categories. Priorities are fixed values. | Should |

---

## 6. Non-Functional Requirements

### NFR-01 — Cost

The MVP must operate at **0 THB/month** using only free-tier services.

### NFR-02 — Capacity and Performance

The system should support at least:

- 200 tickets/day
- 50 concurrent active users
- p95 response time below 2 seconds for normal application requests

### NFR-03 — Availability

The MVP provides best-effort availability. No 24/7 SLA is claimed.

### NFR-04 — Security

- All traffic must use HTTPS.
- Helpdesk must not store user passwords.
- Secrets must not be committed to the repository.
- Authorization must be enforced server-side and at the database policy layer where applicable.

### NFR-05 — Privacy

Only data required for the support journey should be collected, including identity information needed for the application and ticket content.

The MVP does not use tracking pixels or third-party analytics in the user interface.

### NFR-06 — Observability

Structured application logs should contain:

- Ticket ID
- Actor/User ID
- Action
- Timestamp

### NFR-07 — Portability

Developers should be able to run the project locally with one documented setup command or equivalent local development workflow, without requiring paid accounts.

### NFR-08 — Browser Support

The responsive web application targets the latest two versions of:

- Chrome
- Edge
- Firefox
- Safari

The interface should remain usable down to 360 px width.

### NFR-09 — Accessibility

The MVP should use semantic HTML, labeled form controls, and keyboard-navigable forms. WCAG 2.1 AA is not a formal MVP target, but obvious accessibility blockers should be avoided.

### NFR-10 — Internationalization

The MVP UI is English-only. UI strings should be centralized so Thai or additional languages can be added later.

### NFR-11 — Maintainability

The repository must document how to:

- Run the application
- Run tests
- Seed development data

Code style should be enforced with a linter/formatter.

### NFR-12 — Data Retention

Ticket records and comments should be retained for at least one academic year. Older records may be archived or deleted according to a documented policy.

### NFR-13 — Testability

At least seven automated tests must cover:

1. Ticket creation
2. Ticket ownership
3. Assignment
4. Comment
5. Resolve
6. Maintenance link
7. Escalation event

---

## 7. Business Rules

| ID | Rule |
|---|---|
| BR-01 | Ticket lifecycle is `Open → Assigned → InProgress → Resolved → Closed`. `Closed` is terminal. |
| BR-02 | Only the original Requester, or an Agent/Admin, may view a ticket. Agents/Admins may view all tickets. |
| BR-03 | A Requester may edit ticket content only while the ticket is `Open` and before an Agent has modified it. After an Agent touches the ticket, the Requester can only comment. |
| BR-04 | Only Agents/Admins may change assignee, priority, category, internal comments, linked work-order, or ticket status. |
| BR-05 | A Requester may reopen a `Resolved` ticket within 7 days. After 7 days it becomes `Closed` and cannot be reopened. |
| BR-06 | Public comments are visible to the Requester. Internal comments are visible only to Agents/Admins. |
| BR-07 | Rules-engine suggestions are non-binding. The user or Agent has final authority over category and priority. |
| BR-08 | A ticket can be linked to at most one Maintenance work-order ID at a time. Replacing the link records the previous ID in the relevant event data. |
| BR-09 | An `Urgent` ticket that remains `Open` and unassigned for more than one hour triggers `ticket.escalated`. Other priorities do not auto-escalate in the MVP. |
| BR-10 | Every state transition publishes exactly one corresponding event. |
| BR-11 | Requesters cannot delete tickets. Admin hard deletion is restricted and requires a recorded reason. |
| BR-12 | Ticket IDs are opaque, monotonically increasing strings that are safe to expose in URLs and notifications. |

---

## 8. Roles and Permissions

| Capability | Requester | Agent | Admin |
|---|:---:|:---:|:---:|
| Log in via Identity | Yes | Yes | Yes |
| Create ticket | Yes | Yes | Yes |
| View own tickets | Yes | Yes | Yes |
| View all tickets | No | Yes | Yes |
| Add public comment | Yes | Yes | Yes |
| Add internal comment | No | Yes | Yes |
| Edit own open ticket | Yes | Yes | Yes |
| Change category/priority | No | Yes | Yes |
| Assign ticket | No | Yes | Yes |
| Link Maintenance work-order | No | Yes | Yes |
| Resolve ticket | No | Yes | Yes |
| Reopen own resolved ticket within 7 days | Yes | Yes | Yes |
| Manage categories | No | No | Yes |
| View basic counts | No | Yes | Yes |
| Hard-delete ticket | No | No | Yes |

Role assignment is handled outside the Helpdesk MVP through the Identity service or development seed data.

---

## 9. Data Model

The MVP uses a relational data model with the following core entities.

### 9.1 User

Stores a local representation of identity information needed by Helpdesk.

Key fields:

- `id`
- `display_name`
- `email`
- `role`
- `created_at`
- `last_seen_at`

Authentication credentials remain owned by the Identity service.

### 9.2 Category

Represents the classification of tickets.

Key fields:

- `id`
- `name`
- `slug`
- `active`
- `created_at`
- `updated_at`

### 9.3 Ticket

The core business entity.

Key fields include:

- `id`
- `requester_id`
- `assignee_id`
- `category_id`
- `subject`
- `description`
- `priority`
- `status`
- `maintenance_work_order_id`
- `resolution_note`
- `created_at`
- `updated_at`
- `resolved_at`
- `closed_at`
- `escalated_at`

### 9.4 Comment

Comments are append-only in the MVP.

Key fields:

- `id`
- `ticket_id`
- `author_id`
- `body`
- `visibility`
- `created_at`

Visibility values:

- `Public`
- `Internal`

### 9.5 Event / Outbox

An event/outbox record is an implementation mechanism used to support reliable event publication.

Key fields:

- `id`
- `event_type`
- `aggregate_id`
- `payload`
- `created_at`
- `published_at`

### 9.6 Relationships

```text
User      1 ─── N Ticket      (requester)
User      1 ─── N Ticket      (assignee)
User      1 ─── N Comment     (author)
Category  1 ─── N Ticket
Ticket    1 ─── N Comment
```

The database should enforce appropriate foreign keys, enums/check constraints, and role/state constraints.

---

## 10. Ticket Lifecycle

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

### State Rules

- `Open` — newly created and not yet assigned.
- `Assigned` — an Agent has been assigned.
- `InProgress` — an Agent is actively handling the ticket.
- `Resolved` — the Agent has completed the support work and provided a resolution note where required.
- `Closed` — terminal state after the reopening window expires.

Every state transition must be traceable through the system's event/log mechanism.

---

## 11. API Requirements

The platform exposes REST-style application endpoints.

| ID | Method | Endpoint | Main Purpose |
|---|---|---|---|
| API-01 | POST | `/api/tickets` | Create ticket |
| API-02 | GET | `/api/tickets/me` | List current user's tickets |
| API-03 | GET | `/api/tickets/{id}` | Get ticket detail |
| API-04 | PATCH | `/api/tickets/{id}` | Update permitted ticket fields |
| API-05 | POST | `/api/tickets/{id}/assign` | Assign ticket |
| API-06 | POST | `/api/tickets/{id}/resolve` | Resolve ticket |
| API-07 | POST | `/api/tickets/{id}/reopen` | Reopen a resolved ticket within 7 days |
| API-08 | POST | `/api/tickets/{id}/link-maintenance` | Link Maintenance work-order |
| API-09 | POST | `/api/tickets/{id}/comments` | Add public/internal comment |
| API-10 | POST | `/api/tickets/suggest` | Request rules-engine category/priority suggestion |
| API-11 | GET | `/api/admin/counts` | Get basic ticket counts |
| API-12 | GET | `/api/categories` | List active categories |
| API-13 | POST/PATCH/DELETE | `/api/categories[/{id}]` | Admin category management |
| API-14 | POST | `/api/webhooks/maintenance` | Receive Maintenance status changes |
| API-15 | GET | `/api/health` | Application health check |

### 11.1 Response Format

Successful responses should use a consistent envelope:

```json
{
  "data": {},
  "meta": {
    "request_id": "...",
    "timestamp": "..."
  }
}
```

Errors should use:

```json
{
  "error": {
    "code": "...",
    "message": "...",
    "details": {},
    "request_id": "..."
  }
}
```

### 11.2 Pagination

List endpoints should support cursor-based pagination.

Example:

```text
?limit=50&cursor=<opaque>
```

Default limit: 50  
Maximum limit: 200

---

## 12. Events and Integrations

### 12.1 External Integrations

The Helpdesk Platform treats the following systems as external contracts:

1. **Identity Service**
   - Provides authentication and user identity.
   - Helpdesk does not own passwords.

2. **Maintenance**
   - Provides `maintenance.status_changed`.
   - Helpdesk stores a linked work-order ID rather than copying repair records.

3. **Notification Hub**
   - Receives Helpdesk ticket events.
   - Helpdesk does not implement its own email/SMS delivery.

4. **Security & Compliance**
   - Can consume relevant ticket events/log information.

5. **Analytics**
   - Consumes ticket events for analysis.

### 12.2 Outbound Events

The platform publishes events including:

- `ticket.created`
- `ticket.assigned`
- `ticket.resolved`
- `ticket.escalated`
- `ticket.status_changed`
- `ticket.work_order_linked`

Example event structure:

```json
{
  "event_id": "evt_xxxxxxxx",
  "event_type": "ticket.created",
  "event_version": 1,
  "occurred_at": "2026-08-14T15:00:00.000Z",
  "aggregate_id": "T-000123",
  "payload": {}
}
```

### 12.3 Maintenance Event

The system consumes:

```text
maintenance.status_changed
```

The incoming event must be associated with a linked Maintenance work-order ID before it can update a Helpdesk ticket.

The integration should authenticate/verify the incoming webhook according to the agreed external contract. A development mock/stub is acceptable if the real external service is unavailable for the MVP demonstration.

---

## 13. AI / Rules-Based Assistance

The original product concept includes assisted categorization, prioritization, and routing.

For the MVP, this capability is implemented as a **deterministic rules engine**, not an LLM.

### Input

- Ticket description
- Category information
- Urgency signals

### Output

- Suggested category
- Suggested priority

### Rules

Suggestions are advisory only. The requester or Agent always has final authority.

### Fallback

If no rule produces a useful suggestion, the system keeps the user's selected category/urgency and does not block ticket creation.

### Future Direction

An LLM-based suggestion system may be considered in a later version after the deterministic MVP workflow has been validated.

---

## 14. Security Requirements

### 14.1 Authentication

- Authentication is delegated to the Identity service.
- No passwords are stored in the Helpdesk database.
- Development may use an approved local/authentication substitute when the campus Identity service is unavailable.

### 14.2 Authorization

Authorization must be enforced for all protected operations.

Examples:

- Requesters can access only their own tickets.
- Agents can access and manage tickets according to Agent permissions.
- Admin-only operations require the Admin role.
- Internal comments must never be exposed to Requesters.

### 14.3 Database Security

Where supported by the chosen stack, database-level policies should enforce the permission model in addition to application-level checks.

### 14.4 Webhook Security

The Maintenance webhook must use the agreed authentication/signature mechanism. The implementation should support secret management and rotation without committing secrets to the repository.

### 14.5 Secrets

Secrets must be supplied through environment configuration and must never be committed to Git.

---

## 15. Error Handling

The API should provide predictable errors for common cases.

| HTTP | Error Code | Example Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid request data |
| 400 | `INVALID_STATE_TRANSITION` | Requested status transition is not allowed |
| 400 | `EDIT_WINDOW_EXPIRED` | Requester can no longer edit the ticket |
| 400 | `REOPEN_WINDOW_EXPIRED` | Ticket cannot be reopened after 7 days |
| 401 | `UNAUTHENTICATED` | Authentication is missing or expired |
| 403 | `FORBIDDEN` | User does not have permission |
| 404 | `NOT_FOUND` | Resource does not exist or is not visible to the caller |
| 409 | `VERSION_CONFLICT` | Concurrent update conflict |
| 409 | `DUPLICATE` | Unique constraint violation |
| 422 | `BUSINESS_RULE_VIOLATED` | Business rule prevents the operation |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 503 | `EXTERNAL_DEPENDENCY_DOWN` | External service unavailable |

The system should avoid revealing whether an inaccessible ticket exists when returning authorization-related resource errors.

---

## 16. Architecture

### 16.1 Architectural Approach

The MVP uses a deliberately simple architecture:

```text
                    ┌─────────────────────┐
                    │     Web Browser      │
                    └──────────┬──────────┘
                               │ HTTPS
                               ▼
                    ┌─────────────────────┐
                    │ Next.js Web App     │
                    │ UI + API Routes     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Supabase PostgreSQL  │
                    │ + Auth / RLS         │
                    └──────────┬──────────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
       Identity          Notification       Maintenance
          SSO                 Hub              Webhook
```

### 16.2 Proposed Stack

The current team architecture proposes:

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend/API:** Next.js Route Handlers
- **Database:** Supabase PostgreSQL
- **Authentication:** Campus Identity / SSO; development substitute when necessary
- **Hosting:** Vercel free tier
- **Database/Auth Platform:** Supabase free tier

### 16.3 Architectural Principles

1. One web application and one managed relational database.
2. No microservices for the MVP.
3. No Kubernetes, service mesh, or message-broker cluster.
4. External systems are treated as contracts and can be mocked/stubbed during development.
5. Authorization should be enforced as close to the data as practical.
6. The system should remain simple enough for a 3–5 person student team to understand and maintain.
7. All timestamps should use a consistent UTC representation.

---

## 17. Deployment and Development Constraints

### 17.1 Budget

The MVP target is **0 THB/month**.

Only free-tier services should be used unless the team explicitly revises the requirement.

### 17.2 Timeline

The platform must be deliverable within one academic semester of approximately four months.

### 17.3 Team

The expected development team is approximately 3–5 students.

### 17.4 Repository Hygiene

The repository must not contain:

- Passwords
- API secrets
- Private keys
- Large generated binaries
- `node_modules`
- Other sensitive configuration

### 17.5 Dependency License

Dependencies should use permissive licenses such as:

- MIT
- Apache 2.0
- BSD

---

## 18. Testing and Acceptance

### 18.1 Mandatory Automated Tests

At minimum, the following seven workflows must have automated tests:

| Test | Expected Result |
|---|---|
| Create | A valid user can create a ticket and receive a unique Ticket ID |
| Ownership | A requester cannot access another requester's private ticket |
| Assignment | An Agent can assign a ticket according to role permissions |
| Comment | Public/internal comment visibility follows the permission rules |
| Resolve | An authorized Agent/Admin can resolve a ticket and the appropriate event is published |
| Maintenance Link | An Agent/Admin can link a valid Maintenance work-order ID |
| Escalation | An urgent unassigned ticket triggers `ticket.escalated` after the defined threshold |

### 18.2 Core Acceptance Criteria

The MVP is considered functionally complete when:

- A Requester can log in and create a ticket.
- A unique Ticket ID is returned.
- A Requester can view their tickets and comments.
- An Agent can view the queue and manage tickets.
- Role permissions prevent unauthorized operations.
- A ticket can be linked to Maintenance.
- Maintenance status changes can update a linked ticket.
- Tickets can be resolved and reopened within the allowed period.
- Urgent unassigned tickets can trigger escalation.
- Required events are published.
- Notification requests can be sent to the Notification Hub contract.
- Required automated tests pass.

---

## 19. Out of Scope for MVP

The following features are explicitly deferred:

### Intake

- Email-to-ticket parsing
- LINE/Messenger/WhatsApp ingestion
- Phone/voice call logging
- Chatbot intake

### Automation

- LLM-based category/priority/routing in the request path
- Custom workflows per category
- Round-robin/load-balanced assignment
- Auto-reply templates
- General SLA automation beyond the defined Urgent escalation rule

### UX

- Native iOS/Android applications
- Multi-language UI
- File attachments
- Rich-text/Markdown editor
- Real-time chat
- Dark mode

### Reporting

- Full analytics dashboards
- CSAT/NPS surveys
- Agent leaderboards
- Custom reporting

### Administration

- Complex custom RBAC
- Bulk ticket operations
- Ticket templates/macros
- Public knowledge base/FAQ
- Self-service account signup

### Security/Compliance

- Fine-grained audit-log UI
- Configurable retention management
- End-user data export tooling
- Formal penetration testing
- Formal security certification

### Platform

- Multi-tenant architecture
- Public third-party REST API
- Arbitrary third-party webhooks
- Microservices architecture
- Message broker cluster

---

## 20. Traceability

The following mapping connects the main user problems to product requirements.

| Problem | Requirements / Rules |
|---|---|
| Requests are lost or dropped | FR-02, Ticket ID, BR-12 |
| Users cannot see request status | FR-04, FR-05, FR-16 |
| No consistent prioritization | FR-07, FR-08, FR-10 |
| Manual Maintenance handoff | FR-12, FR-14, BR-08 |
| No historical/basic summary | FR-17, NFR-12 |
| No reliable audit trail | BR-10, NFR-06 |
| Duplicate/fragmented requests | Centralized ticket creation and Agent triage |
| Users do not know which support channel to use | Single Helpdesk intake channel |

---

## 21. Assumptions and Validation

The following assumptions should be validated during the project where possible:

1. Students and staff are willing to use a web form instead of existing informal channels.
2. A deterministic category/priority rules engine is sufficient for the MVP.
3. The campus Identity service is available and its integration contract is documented.
4. The `maintenance.status_changed` integration can be demonstrated or reasonably mocked.
5. Helpdesk Agents will adopt the new workflow.
6. The expected ticket volume is small enough for the proposed MVP architecture.
7. English-only UI is acceptable for the first version.
8. Notification delivery can be delegated to the existing Notification Hub.

If an external dependency is unavailable, the team should document the limitation and use a mock/stub for the MVP demonstration rather than silently changing the requirement.

---

## 22. Success Criteria

The MVP is successful if it demonstrates that:

1. Students/staff have one clear place to submit support requests.
2. Every request receives a unique and trackable identity.
3. Requesters can see the status of their own tickets.
4. Agents have a centralized queue and clear ownership of work.
5. Agents can communicate through public/internal comments.
6. Maintenance work can be linked without duplicating repair records.
7. Ticket events can be consumed by external systems.
8. Basic security and role permissions prevent unauthorized access.
9. The system can be developed and demonstrated within the semester's student-project constraints.
10. The implementation remains simple enough for the team to maintain.

---

## 23. Future Improvements

After the MVP has been validated, possible future improvements include:

- LLM-assisted classification and routing
- Thai and multilingual UI
- Email/LINE intake
- File attachments
- Knowledge base and self-service FAQ
- Advanced analytics dashboards
- SLA management and configurable escalation
- More advanced assignment strategies
- Real-time communication
- Formal security testing
- Advanced privacy/compliance tooling

These improvements are not required for the MVP and should not expand the current semester scope unless explicitly approved by the team.

---

## 24. Final MVP Summary

The Helpdesk Platform is a responsive web-based support ticket system for students and staff.

The MVP provides:

**Create → Track → Triage → Assign → Communicate → Resolve → Integrate**

The core promise is simple:

> **Every support request has an ID, an owner, a status, and a traceable event trail.**

The project deliberately avoids unnecessary enterprise complexity. It uses a simple web application, a relational database, delegated authentication, deterministic rules-based assistance, and contract-based integrations with external university services.

This scope is intended to be realistic for a 3–5 person student team working within one academic semester and a 0 THB monthly infrastructure budget.
