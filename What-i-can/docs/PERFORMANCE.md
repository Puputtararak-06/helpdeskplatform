# Performance Baselines

Expected latencies + throughput for the A5 integration. Read this BEFORE running load tests so you know what's "normal".

---

## Latency targets (P95)

| Operation | Target | Notes |
|---|---|---|
| GET /healthz | < 50ms | Single DB query |
| POST /v1/cases (mock) | < 100ms | Single insert + response |
| POST /webhooks/wellbeing (Helpdesk receiver) | < 100ms | Verify HMAC + idempotency check + insert |
| GET /v1/_debug/calls (mock) | < 50ms | In-memory |
| HMAC sign (sender) | < 5ms | Web Crypto |
| HMAC verify (receiver) | < 5ms | Web Crypto + constant-time compare |

---

## Throughput targets

| Scenario | Expected throughput |
|---|---|
| Sequential POST /v1/cases | 20-30 req/s (D1 limit) |
| Concurrent 20 req | 15-20 req/s |
| Burst 100 req @ concurrency 20 | Should handle all in < 5s |
| Cron retry worker | Processes 20 items per run, every 5 min |

---

## Why D1 limits throughput

D1 has **single-region replication**. Each Worker invocation:
1. Reads from primary replica (slight latency)
2. Writes to primary replica (latency)
3. Sync to other replicas happens async

**Bottleneck:** D1 has per-database write rate limit (~5 writes/second default).

If you need higher throughput:
- **Batch writes** — combine multiple inserts in one statement
- **Cache reads** — use Cloudflare KV for hot data
- **Sharding** — split into multiple D1 databases

---

## Cron retry worker timing

```
Cron schedule: */5 * * * *  (every 5 minutes)
Batch size: 20 items per run
Backoff: 60s → 120s → 240s → 480s → 960s (exponential)
Max attempts: 5
```

**Failure scenarios:**
- 1 attempt fail → next retry in 60s (~6 min total)
- 2 attempts fail → 60 + 120 = 180s = 3 min
- 5 attempts fail → total 60+120+240+480+960 = 1860s = ~31 min

After 5 failed attempts, item is `failed` (manual intervention needed).

---

## Network overhead

Each webhook call adds:
- Helpdesk → Mock: ~10-50ms (same region, fast)
- TLS handshake: ~10-30ms (one-time per cold start)
- DNS lookup: ~10ms (cached after first hit)

Cold starts can add 50-200ms on first request after deploy.

---

## Memory + CPU

| Component | Memory | CPU |
|---|---|---|
| Mock Worker | < 50MB | minimal |
| Helpdesk Worker | < 50MB | minimal |
| Webhook receiver | < 50MB | minimal (HMAC + DB ops) |
| Retry worker (cron) | < 50MB | minimal |

Workers have **128MB memory limit** on free plan. We're well under.

CPU time is **10ms per request** on free plan. Most operations < 5ms. Plenty of headroom.

---

## Latency monitoring (Day-2)

To measure actual latency, add this to your routes:
```typescript
const start = Date.now();
// ... handler logic ...
const ms = Date.now() - start;
console.log(`[perf] ${c.req.method} ${c.req.path} ${ms}ms`);
```

Or use Cloudflare's built-in analytics:
- Dashboard → Workers → Logs → see p50/p95/p99 latencies
- Tail logs: `wrangler tail --format=pretty` shows response times

---

## Expected load for A5 demo

During demo, you'll run maybe 50-100 requests total:
- 12 from Postman collection
- 10-20 manual curl/extra
- A few load test bursts

All should complete in < 5 seconds total. D1 won't break a sweat.

---

## If something is slow tomorrow

```bash
# Check D1 latency
wrangler d1 execute helpdesk-db --remote --command "EXPLAIN QUERY PLAN SELECT * FROM webhook_events WHERE event_key = 'abc'"

# Check Worker CPU time
wrangler tail --format=pretty | grep "durationMs"

# Check for slow queries
wrangler d1 execute helpdesk-db --remote --command "SELECT * FROM webhook_events ORDER BY received_at DESC LIMIT 5"
```

---

## Capacity for production

Assuming 100 webhooks/day, 10 tickets/day:
- D1: 100 rows/day = 36,500 rows/year (well under 100k limit)
- Worker requests: 100/day = 36,500/year (well under 100k/day limit)
- Cron: 288 invocations/day (negligible)

Free tier supports this for years. No scaling concerns.

---

## Summary

For A5 demo:
- Latency should be **< 100ms P95** for all operations
- Throughput should be **20+ req/s** under load
- No scaling concerns with current setup
- Performance is good enough for demo, has headroom for production
