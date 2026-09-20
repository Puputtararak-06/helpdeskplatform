# Architecture Decision Records (ADR)

Document key technical decisions made during A5 development.
Each ADR explains: context, decision, consequences, alternatives considered.

---

## ADR-001: Use HMAC-SHA256 for webhook authentication

**Date:** 2026-09-21
**Status:** Accepted

### Context

Need to authenticate webhooks between Helpdesk and Wellbeing. Options considered:

| Option | Pros | Cons |
|---|---|---|
| HMAC-SHA256 + shared secret | Stateless, fast, no round-trip, industry standard | Shared secret management |
| JWT (RS256) | Asymmetric, no shared secret | Heavier, requires key rotation infra |
| OAuth2 + Bearer | Familiar, flexible | Token refresh, expiry handling |
| mTLS | Strongest security | Complex setup, certificate management |

### Decision

**Use HMAC-SHA256 with `X-Signature: t=<ms>,v1=<hex>` header format.**

### Consequences

- ✅ Stateless verification — Helpdesk doesn't need to call back to verify
- ✅ Replay protection via timestamp + 5-min tolerance window
- ✅ Simple to implement (Web Crypto API in Workers, ~50 lines)
- ✅ Standard pattern (Stripe, GitHub, Slack all use HMAC for webhooks)
- ⚠️ Shared secret rotation requires coordinated change
- ⚠️ If secret leaks, attacker can forge webhooks

### Alternatives rejected

- **JWT**: Overkill for server-to-server, expiry handling adds complexity
- **OAuth2**: Designed for user-facing flows, not server-to-server
- **mTLS**: Too complex for student-team project; certificate management burden

---

## ADR-002: Use mock API when Team 16 contract delayed

**Date:** 2026-09-21
**Status:** Accepted (with caveat)

### Context

Team 16 (Wellbeing) did not deliver API contract by 2026-09-21 (deadline -22h).
Options:

1. **Wait for Team 16**: Risk missing deadline
2. **Build mock based on proposed contract**: Continue development, swap later
3. **Build against guessed Team 16 API**: Risk fabrication

### Decision

**Build mock implementing the contract Team 14 proposed in A5 prep doc. Document explicitly in evidence that mock was used.**

### Consequences

- ✅ Can develop in parallel — not blocked
- ✅ Demonstrates integration capability to professor
- ✅ Code is modular — swap to real API in ~30 min when Team 16 ready
- ⚠️ Mock contract might not match Team 16's real contract exactly
- ⚠️ Professor might question "real" integration

### Mitigation

- Document mock usage explicitly in evidence
- Note "Do not invent contract" compliance (Section 9 of A5 prep doc)
- Provide `docs/CONTRACT_DIFF.md` to predict gaps

---

## ADR-003: SQLite ALTER pattern for schema migrations

**Date:** 2026-09-21
**Status:** Accepted

### Context

SQLite doesn't support `ALTER TABLE ... DROP NOT NULL`. Need to relax `location_found NOT NULL` constraint.

Options:
1. Recreate table with new schema, copy data (SQLite standard pattern)
2. Drop entire table + recreate (loses data)
3. Use complex triggers (overkill)

### Decision

**Use SQLite ALTER pattern**: CREATE new table → COPY → DROP old → RENAME new.

### Consequences

- ✅ Preserves all data
- ✅ Standard SQLite pattern
- ✅ Works in D1 (which uses SQLite 3.39+)
- ⚠️ Complex migration script
- ⚠️ Must ensure new schema is correct before running (can't rollback easily)

### Migration 0002 implementation

```sql
CREATE TABLE items_new (... new schema ...);
INSERT INTO items_new SELECT * FROM items;
DROP TABLE items;
ALTER TABLE items_new RENAME TO items;
```

---

## ADR-004: Outbox pattern for reliable webhook delivery

**Date:** 2026-09-21
**Status:** Accepted

### Context

Webhook sending from Helpdesk to Wellbeing can fail due to:
- Network blips
- Partner downtime
- Helpdesk deploys/restarts

Options:
1. Synchronous send + retry inline (blocks request)
2. Fire-and-forget (data loss on failure)
3. Outbox pattern (durable queue, separate worker processes)

### Decision

**Outbox pattern + cron-triggered retry worker.**

### Flow

1. **Send request:**
   - Write to `webhook_outbox` with status='pending'
   - Attempt synchronous send
   - On success: update status='sent'
   - On failure: status='retrying', retry worker handles later

2. **Retry worker (cron every 5 min):**
   - Query items where status IN ('pending', 'retrying') AND backoff elapsed
   - Exponential backoff per item: 60s → 120s → 240s → 480s → 960s
   - Update status based on result
   - After 5 attempts: status='failed' (manual intervention needed)

### Consequences

- ✅ No data loss (durable in D1 before sending)
- ✅ Self-healing (retry worker recovers automatically)
- ✅ Exponential backoff prevents thundering herd
- ⚠️ More complex than fire-and-forget
- ⚠️ D1 write cost per request (acceptable for low-volume)

---

## ADR-005: Cloudflare D1 over Firebase Firestore

**Date:** 2026-08-23 (initial project decision)
**Status:** Accepted

### Context

Student Helpdesk project needs a database. Stack constraint: Cloudflare Workers → can't use traditional databases.

Options:
- D1 (Cloudflare's SQL)
- Firestore (Firebase's NoSQL)
- KV (Cloudflare's key-value)
- External Postgres (Neon, Supabase)

### Decision

**Cloudflare D1 (SQLite-compatible).**

### Consequences

- ✅ Free tier covers student project scale
- ✅ SQL familiarity for team
- ✅ Low latency (edge-distributed)
- ✅ Works with Workers natively (no connection string)
- ⚠️ No real-time subscriptions (not needed)
- ⚠️ Limited to 10MB per row / 100k rows per DB (generous for assignment)
- ⚠️ SQLite-specific gotchas (no DROP CONSTRAINT, limited ALTER)

---

## ADR-006: TypeScript strict mode

**Date:** 2026-09-21
**Status:** Accepted

### Context

TypeScript can be configured with varying strictness. For a team project where correctness matters:

Options:
- Loose (default) — minimal checks
- Recommended — most checks
- Strict — all checks (catches more bugs)

### Decision

**Strict mode + `noUncheckedIndexedAccess` (extra strict on array indexing).**

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitAny": true
  }
}
```

### Consequences

- ✅ Catches bugs at compile time
- ✅ Forces explicit handling of undefined array access
- ✅ Better self-documenting code (types tell the story)
- ⚠️ Slightly more verbose (need `?.` and `?? null`)
- ⚠️ Onboarding friction for non-TS developers

### Worth it?

Yes. The cost (5% more verbose) is small compared to the benefit (catches entire categories of bugs at build time).

---

## Future ADRs to consider

- **ADR-007**: How to handle authentication in Helpdesk user-facing API (when added)
- **ADR-008**: Migration strategy for breaking schema changes
- **ADR-009**: Observability stack (logging, metrics, tracing)

---

*Format based on https://adr.github.io/ — lightweight, focused on decisions not architecture*
