# Mermaid Diagrams for A5 Evidence

> Copy these into your evidence doc. They render in GitHub, VS Code, and most markdown viewers.

---

## 1. System Architecture

```mermaid
graph LR
    subgraph Helpdesk["Helpdesk (Team 14) - Cloudflare Worker"]
        H1[Tickets API<br/>Hono routes]
        H2[POST /webhooks/wellbeing<br/>HMAC verify]
        H3[webhook_outbox<br/>retry queue]
        H4[webhook_events<br/>incoming log]
        H5[Retry Worker<br/>cron */5 * * * *]
        H6[(D1: tickets)]
    end
    
    subgraph Mock["Wellbeing Mock - Cloudflare Worker"]
        M1[POST /v1/cases]
        M2[GET /v1/cases/:id]
        M3[PATCH /v1/cases/:id]
        M4[POST /internal/trigger-webhook]
        M5[/v1/_debug/calls,reset,break,heal/]
    end
    
    H1 -->|1. POST /v1/cases<br/>+ HMAC + idempotency| M1
    M4 -->|3. POST /webhooks/wellbeing<br/>+ HMAC sig| H2
    H2 --> H4
    H1 --> H3
    H5 -->|5. retry pending| M1
    H1 --> H6
    
    style H1 fill:#3b82f6,color:#fff
    style H2 fill:#10b981,color:#fff
    style H3 fill:#f59e0b,color:#fff
    style H4 fill:#a855f7,color:#fff
    style M1 fill:#ec4899,color:#fff
    style M4 fill:#ef4444,color:#fff
```

---

## 2. Webhook Flow (Provider → Consumer)

```mermaid
sequenceDiagram
    participant W as Wellbeing<br/>(or Mock)
    participant H as Helpdesk<br/>Worker
    
    Note over W: Event occurs<br/>(e.g., case opened)
    W->>W: Build payload<br/>+ HMAC sign<br/>(t=now, v1=hex)
    W->>H: POST /webhooks/wellbeing<br/>X-Signature: t=...,v1=...<br/>Content-Type: application/json
    
    H->>H: Read raw body<br/>(await c.req.text())
    H->>H: Verify HMAC:<br/>compute expected sig<br/>constant-time compare
    H->>H: Check timestamp<br/>(within 5 min?)
    
    alt Signature invalid or expired
        H-->>W: 401 invalid signature
    else Valid
        H->>H: Parse JSON
        H->>H: Check idempotency_key<br/>in webhook_events table
        alt Already processed
            H-->>W: 200 { ok: true, replay: true }
        else New event
            H->>H: INSERT into webhook_events<br/>(UNIQUE event_key)
            H->>H: processEvent():<br/>UPDATE tickets SET<br/>wellbeing_record_id = ...
            H-->>W: 200 { ok: true }
        end
    end
```

---

## 3. Consumer Flow (Helpdesk → Partner)

```mermaid
sequenceDiagram
    participant API as Helpdesk API<br/>handler
    participant Sync as wellbeing-sync.ts
    participant DB as D1
    participant W as Wellbeing<br/>(or Mock)
    
    API->>API: Handle POST /api/tickets<br/>(category=wellbeing)
    API->>DB: INSERT INTO tickets<br/>(wellbeing_status='pending')
    
    API->>Sync: createWellbeingCase(<br/>apiUrl, secret,<br/>ticketRef, urgency)
    Sync->>Sync: Build payload<br/>{ ticket_ref, urgency }
    Sync->>Sync: sign(secret, payload)<br/>→ X-Signature header
    Sync->>W: POST /v1/cases<br/>X-Signature: ...<br/>X-Idempotency-Key: ticket-${ref}-case
    
    alt Success
        W-->>Sync: 201 { case_id, status }
        Sync->>DB: UPDATE tickets<br/>SET wellbeing_record_id = case_id,<br/>wellbeing_status = 'open'
        Sync-->>API: { caseId }
    else 5xx or network error
        W-->>Sync: 500 / timeout
        Sync->>DB: UPDATE tickets<br/>SET wellbeing_status = 'pending_sync'
        Sync->>DB: INSERT INTO webhook_outbox<br/>(status='pending')
        Sync-->>API: { error }
    end
    
    Note over DB,W: Cron worker */5 * * * *<br/>retries pending items
```

---

## 4. Retry Worker Flow

```mermaid
flowchart TD
    Start[Cron trigger<br/>every 5 min] --> Query[Query webhook_outbox<br/>WHERE status IN pending,retrying<br/>AND backoff_elapsed]
    Query --> Loop{For each item}
    Loop --> MaxCheck{attempts<br/>>= 5?}
    MaxCheck -->|Yes| Fail[Set status = failed<br/>log error]
    MaxCheck -->|No| Sign[Sign payload<br/>with X-Idempotency-Key]
    Sign --> Send[POST to partner<br/>with backoff sec]
    Send --> Status{Response status}
    Status -->|2xx| Sent[Set status = sent<br/>sent_at = now]
    Status -->|5xx / network| Retryable[Set status = retrying<br/>attempts++]
    Status -->|4xx client err| Permanent[Set status = failed<br/>last_error = msg]
    Retryable --> Loop
    Sent --> Loop
    Permanent --> Loop
    Fail --> Loop
    Loop -->|No more items| Done[Done]
    
    style Start fill:#3b82f6,color:#fff
    style Sent fill:#10b981,color:#fff
    style Retryable fill:#f59e0b,color:#fff
    style Fail fill:#ef4444,color:#fff
    style Done fill:#6366f1,color:#fff
```

---

## 5. State Diagram (Item Status)

```mermaid
stateDiagram-v2
    [*] --> found: POST /v1/cases<br/>(finder creates)
    
    found --> claimed: PATCH {<br/>status: claimed,<br/>claimed_by_student_id<br/>}
    found --> found: PATCH other fields
    
    claimed --> [*]
    
    note right of found
        Optional:<br/>wellbeing_synced_at<br/>wellbeing_record_id<br/>filled
    end note
    
    note right of claimed
        Terminal state<br/>Cannot transition back
    end note
```

---

## 6. Idempotency Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    
    C->>S: POST /v1/cases<br/>X-Idempotency-Key: abc123<br/>Body: {ticket_ref:TKT-001}
    S->>S: Check cache[abc123]
    S->>S: Not found → create
    S->>S: Cache[abc123] = response
    S-->>C: 201 { case_id: wb-1 }
    
    Note over C,S: ── retry (network issue) ──
    
    C->>S: POST /v1/cases<br/>X-Idempotency-Key: abc123<br/>Body: {ticket_ref:TKT-001}
    S->>S: Check cache[abc123]
    S->>S: Found! Return cached
    S-->>C: 200 { case_id: wb-1 }<br/>X-Idempotent-Replay: true
```

---

## 7. Degradation & Recovery

```mermaid
sequenceDiagram
    participant T as Cron trigger
    participant W as Worker
    participant M as Mock (degraded)
    
    Note over M: /v1/_debug/break called
    M->>M: degraded = true
    
    W->>M: POST /v1/cases
    M-->>W: 500 DEGRADED
    W->>W: Queue to webhook_outbox<br/>status=retrying
    
    T->>W: Cron trigger
    W->>W: Process pending items
    
    W->>M: POST /v1/cases<br/>(retry attempt)
    M-->>W: 500 DEGRADED
    
    Note over M: /v1/_debug/heal called
    M->>M: degraded = false
    
    T->>W: Cron trigger (next 5 min)
    W->>W: Process pending items
    W->>M: POST /v1/cases<br/>(retry attempt)
    M-->>W: 201 { case_id: wb-success }
    W->>W: UPDATE outbox status=sent<br/>UPDATE tickets synced
```

---

## Usage in evidence doc

```markdown
## Architecture

[Insert Mermaid diagram 1 here]

## Flow

[Insert Mermaid diagram 2 or 3]

## Resilience

[Insert Mermaid diagram 7]
```

These render automatically in:
- GitHub markdown
- VS Code preview
- Obsidian
- Most MD viewers

If your viewer doesn't support Mermaid, see [DIAGRAMS_ASCII.md](./DIAGRAMS_ASCII.md) for fallback.
