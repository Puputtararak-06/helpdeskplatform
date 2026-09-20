# Handoff Document — Post A5

> **Audience:** Team 14 (Helpdesk) maintainers + future devs
> **When:** After A5 submission

---

## What we built

A complete Helpdesk ↔ Wellbeing integration:
- Webhook receiver with HMAC verification + idempotency
- Webhook sender with outbox pattern + cron retry
- Mock Wellbeing API (for testing without Team 16)
- 14 automation scripts
- 32 unit tests + 12 integration tests
- Comprehensive documentation (15+ files)

---

## What's in this folder

```
What-i-can/
├── Code (src/)         — copy into your main app
├── Tests (tests/)      — run before deploy
├── Mocks (mocks/)      — deploy as standalone Worker
├── Migration (migrations/) — apply to D1
├── Docs (docs/ + root .md) — read for context
├── Scripts (scripts/)  — use for deploy + monitoring
└── CI (.github/)       — auto-runs on push
```

---

## After A5 — what to do

### 1. Decide: keep or delete the mock?

**Keep if:**
- Team 16 contract is delayed beyond A5 deadline
- You want a fixture for testing edge cases
- Local dev benefits from standalone mock

**Delete if:**
- Team 16 is fully live and stable
- Mock is no longer needed
- Save Cloudflare resources

To delete:
```bash
cd What-i-can/mocks
wrangler delete wellbeing-mock
```

### 2. Migrate code into main app

The code in `src/` is intentionally modular. You should integrate:

| File | Destination |
|---|---|
| `src/lib/hmac.ts` | `src/lib/hmac.ts` (or wherever your utils live) |
| `src/lib/wellbeing-sync.ts` | `src/lib/wellbeing-sync.ts` |
| `src/routes/webhooks.ts` | `src/routes/webhooks.ts` |
| `src/workers/retry-worker.ts` | `src/workers/retry-worker.ts` |
| `src/types/events.ts` | `src/types/events.ts` |

After integration, this `What-i-can` folder becomes **read-only reference**, not active development.

### 3. Code review checklist

Before merging to main:
- [ ] All tests pass
- [ ] No hardcoded secrets in code
- [ ] Error messages don't leak sensitive info
- [ ] All TypeScript strict-mode compliant
- [ ] Wrangler.toml has required env vars
- [ ] Cron triggers configured
- [ ] Webhook route registered

### 4. Update CI

Current `.github/workflows/test.yml` runs HMAC + JSON + SQL validation.
For production:
- Add integration tests against deployed workers
- Add security scanning (e.g., GitGuardian for secrets)
- Add performance regression tests

### 5. Monitor in production

```bash
# Daily: check outbox
node What-i-can/scripts/inspect-queue.cjs

# Weekly: review wrangler tail logs
wrangler tail helpdesk-team14 --format=pretty | less

# Monthly: run load tests
node What-i-can/scripts/load-test.cjs --concurrency=50 --total=500
```

---

## When Team 16 responds (eventually)

Follow `docs/SWAP.md`:
1. Verify contract compatibility
2. Swap 2 vars in wrangler.toml
3. Redeploy Helpdesk
4. Run preflight + tests
5. Decommission mock (or keep as backup)

---

## Common future tasks

### Add a new webhook event type

1. Update `src/types/events.ts` — add to EventType union
2. Update `src/routes/webhooks.ts` — add case in `processEvent()`
3. Update `mocks/wellbeing-mock-api.mjs` — produce event in test
4. Add test case to `postman/A5-collection.json`
5. Update `docs/CONTRACT_PROPOSAL.md`

### Change auth scheme (HMAC → JWT)

1. Rewrite `src/lib/hmac.ts` → JWT verify
2. Update `src/lib/wellbeing-sync.ts` → sign with JWT
3. Update mock to produce JWT
4. Update `scripts/hmac-test.cjs` → JWT tests
5. Update `docs/SECURITY.md`

### Add more ticket categories

1. Update CATEGORIES in `src/lib/validators.ts`
2. Update CHECK constraint in migration 0005
3. Update test cases
4. Document in `docs/SAMPLE_PAYLOADS.md`

---

## Things to clean up eventually

- `.path-test` — marker file, can delete
- `test-results/` — generated each run, add to .gitignore
- `backups/` — get periodic dumps, prune old
- `What-i-can/postman/A5-collection.json` — was for A5 specifically, rename if doing more integration work

---

## What worked well (for future projects)

✅ **Mock-driven development** — unblocked by partner delays
✅ **Outbox pattern + cron retry** — reliable async messaging
✅ **HMAC over OAuth for webhooks** — stateless, fast
✅ **TypeScript strict mode** — caught bugs early
✅ **Documentation as code** — DIAGRAMS.md, ADR.md, etc. evolve with code

## What could be improved (for future projects)

⚠️ **Real authentication** for consumer API (currently open)
⚠️ **Rate limiting** (none currently)
⚠️ **Observability** — centralized logging + alerting
⚠️ **Schema versioning** — better migration story for breaking changes
⚠️ **Contract testing** — Pact or similar to catch contract drift early

---

## For new team members

If you're joining Team 14 and reading this:

1. **Start with `docs/ADR.md`** — why we made key decisions
2. **Read `docs/ARCHITECTURE`** (in evidence doc) — how it fits together
3. **Run `scripts/preflight.cjs`** — verify your environment works
4. **Read `docs/RUNBOOK.md`** — Day-2 operations
5. **Ask questions** — update docs if something is unclear

---

## Credits

Built by **Team 14 (Helpdesk)** for Platform Development A5 assignment
Deadline: 22 September 2026
Total time: ~6 hours (code) + 1 evening (docs/scripts)

---

*Document version 1.0 — 2026-09-21*
