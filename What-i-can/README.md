# What-i-can — A5 Integration Build

Folder นี้คือทุกอย่างที่ Team 14 (Helpdesk) ทำได้**โดยไม่ต้องรอ** Team 16 (Wellbeing) ส่ง contract

ทุก code เป็น modular — copy ไปใช้ใน main app ของคุณได้เลย

## โครงสร้าง

```
What-i-can/
├── README.md                              ← ไฟล์นี้
├── QUICKSTART.md                          ← 1-page entry point
├── INTEGRATION_PLAN.md                    ← ขั้นตอน deploy + test
├── INTEGRATION_SNIPPET.md                 ← code wire-up guide
├── MOCK_DEPLOY.md                         ← วิธี deploy mock
├── DEPLOY_CHECKLIST.md                    ← checklist ก่อน submit
├── TROUBLESHOOTING.md                     ← common errors + fixes
├── .env.example                           ← template env file
├── docs/
│   ├── FAQ.md                             ← common questions
│   ├── SWAP.md                            ← mock → real pivot playbook
│   ├── CONTRACT_PROPOSAL.md               ← contract spec สำหรับ Team 16 review
│   ├── CONTRACT_DIFF.md                   ← mock vs real diff analysis
│   ├── SAMPLE_PAYLOADS.md                 ← concrete test payloads
│   ├── SELF-EVALUATION.md                 ← A5 grading self-check
│   ├── ADR.md                             ← architecture decision records
│   ├── PRODUCTION_URLS.md                 ← URL reference
│   ├── SECURITY.md                        ← security considerations
│   ├── RUNBOOK.md                         ← Day-2 operations runbook
│   ├── DEMO.md                            ← 5-min professor demo script
│   ├── DIAGRAMS.md                        ← Mermaid diagrams
│   ├── PERFORMANCE.md                     ← latency/throughput targets
│   └── MOCK_OPENAPI.yaml                  ← mock API spec (OpenAPI 3.0)
├── tests/
│   ├── hmac.test.mjs                      ← HMAC unit tests (12 cases)
│   ├── validators.test.mjs                ← validator unit tests
│   └── README.md                          ← how to run tests
├── .github/
│   └── workflows/
│       └── test.yml                        ← CI: HMAC + JSON + SQL validation
├── migrations/
│   ├── 0005_wellbeing_fields.sql          ← schema update
│   └── 0006_rollback.sql                  ← emergency undo (safe)
├── FINAL_STATUS.md                        ← what's done / pending summary
├── QUICK_REFERENCE.md                     ← cheat sheet for deploy day
├── mocks/
│   ├── wellbeing-mock-api.mjs             ← Cloudflare Worker — stand-in Team 16
│   └── debug-ui.html                      ← visual debug page
├── migrations/
│   └── 0005_wellbeing_fields.sql          ← schema update
├── src/
│   ├── lib/
│   │   ├── hmac.ts                        ← HMAC-SHA256 sign + verify
│   │   └── wellbeing-sync.ts              ← sender + idempotency
│   ├── routes/
│   │   └── webhooks.ts                    ← POST /webhooks/wellbeing receiver
│   ├── workers/
│   │   └── retry-worker.ts                ← cron-triggered outbox retry
│   └── types/
│       └── events.ts                      ← TypeScript event types
├── postman/
│   └── A5-collection.json                 ← 12 test cases (6 evidence categories)
├── scripts/
│   ├── preflight.cjs                      ← validate env + URLs + HMAC
│   ├── run-tests.cjs                      ← auto-run all tests + report
│   ├── collect-evidence.cjs               ← เติม evidence template
│   ├── start-dev.ps1                      ← start mock + helpdesk 1 คำสั่ง
│   ├── hmac-test.cjs                      ← HMAC sanity check
│   ├── verify-schema.cjs                  ← verify D1 schema
│   ├── cleanup.cjs                        ← reset DB + mock
│   ├── load-test.cjs                      ← burst load test
│   ├── inspect-mock.cjs                   ← CLI: ดู mock state
│   ├── inspect-queue.cjs                  ← CLI: ดู webhook outbox
│   ├── send-webhook.cjs                   ← CLI: ส่ง test webhook
│   ├── verify-sig.cjs                     ← CLI: ตรวจ HMAC signature
│   ├── backup-db.sh                       ← export D1 เป็น SQL
│   └── verify-deployment.sh               ← bash: verify URLs respond
└── evidence/
    └── A5-Team14-Integration-Evidence.md ← final submission template
```

## Quick start (พรุ่งนี้เช้า)

1. อ่าน `QUICKSTART.md` (1 หน้า)
2. Apply migration
3. Deploy mock (ดู `MOCK_DEPLOY.md`)
4. Copy code ไป main app (ดู `INTEGRATION_SNIPPET.md`)
5. Run `node What-i-can/scripts/preflight.cjs`
6. Run `node What-i-can/scripts/run-tests.cjs`
7. Run `node What-i-can/scripts/collect-evidence.cjs`
8. Submit

## สมมติฐานที่ lock ไว้ (ปรับได้ทีหลังถ้า Team 16 ต่าง)

| | Default |
|---|---|
| Auth | HMAC-SHA256 + shared secret |
| Signature header | `X-Signature: t=<unix_ms>,v1=<hex>` |
| Idempotency header | `X-Idempotency-Key: <unique_string>` |
| Field names | `wellbeing_record_id`, `wellbeing_status`, `wellbeing_synced_at` |
| Status enum | `open`, `in_progress`, `closed`, `referred`, `pending_sync` |
| Replay window | 5 นาที |
| Event types | `wellbeing.case.opened`, `.updated`, `.closed` |

**ถ้า Team 16 ต่างจากนี้** → แก้แค่ config ใน `wrangler.toml` + 1-2 จุดใน code (signature header format เป็นหลัก) — ดู `docs/SWAP.md`

## ถ้า Team 16 ตอบกลับกะทันหัด

```toml
[vars]
WELLBEING_API_URL = "https://api.wellbeing.mfu.ac.th"
WELLBEING_WEBHOOK_SECRET = "<shared secret จาก Team 16>"
```

Code ไม่ต้องแก้ — ทุกอย่างอ่านจาก env

ดู runbook ละเอียด: `docs/SWAP.md`

## Scripts สรุป

| Script | ทำอะไร | รันเมื่อ |
|---|---|---|
| `preflight.cjs` | Validate env, URLs, HMAC | ก่อน test |
| `hmac-test.cjs` | Test crypto round-trip | ก่อน deploy |
| `verify-schema.cjs` | Check D1 schema | หลัง migrate |
| `run-tests.cjs` | Auto-run 12 tests + report | แทน Postman คลิก |
| `collect-evidence.cjs` | Fill evidence template | หลัง test |
| `load-test.cjs` | Burst load test | ก่อน submit |
| `cleanup.cjs` | Reset DB + mock | ระหว่าง iteration |
| `inspect-mock.cjs` | Live debug mock state | debug |
| `inspect-queue.cjs` | See outbox queue | debug |
| `send-webhook.cjs` | Send test webhook to Helpdesk | debug receiver |
| `verify-sig.cjs` | Verify HMAC signature standalone | debug 401s |
| `backup-db.sh` | Export D1 tables to SQL | ก่อน destructive ops |
| `start-dev.ps1` | Start local dev | dev |
