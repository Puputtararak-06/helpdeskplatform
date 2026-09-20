# Security Considerations

What's secured, what's not, and what to harden before production.

---

## Secured (out of the box)

### 1. HMAC-SHA256 webhook authentication ✅

- Stateless verification (no shared session)
- Replay protection (5-minute timestamp window)
- Constant-time comparison (prevents timing attacks)
- Standard format: `t=<ms>,v1=<hex>` (Stripe-style)

**Code:** `src/lib/hmac.ts`

**Threats mitigated:**
- ✅ Forged webhooks (without secret, can't generate valid signature)
- ✅ Replay attacks (old timestamps rejected)
- ✅ Timing attacks (constant-time compare)

### 2. SQL injection prevention ✅

All queries use parameterized statements:
```typescript
// Safe
await env.DB.prepare('SELECT * FROM items WHERE id = ?').bind(id).first();
// NEVER
await env.DB.prepare(`SELECT * FROM items WHERE id = ${id}`).first();
```

**Code:** All routes in `src/index.ts`, `src/routes/webhooks.ts`

### 3. Idempotency ✅

Prevents:
- ✅ Duplicate case creation on retry
- ✅ Duplicate webhook processing on replay

Implementation:
- Outgoing: `X-Idempotency-Key` header → server caches response
- Incoming: `idempotency_key` in body → stored in DB with UNIQUE constraint

### 4. Webhook Outbox pattern ✅

Prevents:
- ✅ Data loss on network failure
- ✅ Data loss on partner downtime
- ✅ Data loss on server restart

Webhooks written to D1 BEFORE sending → durable queue

### 5. CORS ✅

```js
'Access-Control-Allow-Origin': '*'
```

Currently `*` for ease of testing. **For production, restrict to known origins.**

---

## NOT secured (would harden before real production)

### 1. Webhook secret management ⚠️

Currently: shared secret in `wrangler.toml` `[vars]`
- All deploys have same secret
- Rotation requires coordinated change

**For production:**
- Use Cloudflare Secrets (`wrangler secret put WELLBEING_WEBHOOK_SECRET`)
- Implement secret rotation (multiple valid secrets during transition)
- Different secrets for incoming vs outgoing

### 2. No rate limiting ⚠️

Anyone can hit `/v1/cases` repeatedly. Currently no rate limit.

**For production:**
- Cloudflare Rate Limiting Rules (free tier: 10k req/day)
- Per-IP + per-API-key quotas
- 429 responses with Retry-After

### 3. No authentication on consumer API ⚠️

Currently anyone with the URL can create cases.

**For production:**
- API key per consumer (Helpdesk gets a unique key)
- JWT or OAuth2 for user-facing flows
- Audit log of all API calls

### 4. Webhook URL is guessable ⚠️

URL pattern `https://helpdesk-team14.<sub>.workers.dev/webhooks/wellbeing`
- Worker name visible in DNS
- Standard endpoint path

**Mitigation:** HMAC + signed payload means random people can't fake webhooks even if they know the URL

### 5. No input validation for all fields ⚠️

Some fields validated (length, format), others trusted:
- `notes`: free text, no length limit (recommend max 1000 chars)
- `case_id`: trusted from Team 16 (should validate format)

**For production:** Add comprehensive input validation

### 6. Errors leak info ⚠️

Error responses include details:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "invalid signature", "details": { "field": "X-Signature" } } }
```

Reveals:
- Which endpoint exists
- Which field is wrong
- Whether secret mismatch vs format mismatch

**For production:** Generic messages, log details server-side only

### 7. No logging for security events ⚠️

We log `[webhook] rejected: invalid_signature` to console.

**For production:**
- Centralized logging (Cloudflare Logpush → Datadog/Elastic)
- Alerting on repeated failures (potential attack)
- Audit trail with timestamps

### 8. Secret in client-side code ⚠️

If Helpdesk frontend ever embeds the webhook secret in JS → leaked.

**Mitigation:** Secret only in Worker (server-side), never in client

### 9. CORS allows * ⚠️

`Access-Control-Allow-Origin: '*'` means any website can hit our API.

**For production:**
```js
'Access-Control-Allow-Origin': 'https://helpdesk.mfu.ac.th'
```

### 10. No HTTPS enforcement ⚠️

Cloudflare handles this, but worth confirming:
- All URLs should be HTTPS
- Reject HTTP requests at edge

---

## Threat Model

| Threat | Risk | Mitigation |
|---|---|---|
| Forged webhook | High | HMAC + replay protection ✅ |
| Replay attack | High | Timestamp + 5-min window ✅ |
| SQL injection | Critical | Parameterized queries ✅ |
| DoS | Medium | No rate limit yet ⚠️ |
| Secret leak | High | Use Cloudflare Secrets ⚠️ |
| Man-in-the-middle | Low | HTTPS (Cloudflare auto) ✅ |
| CSRF | Low | API not browser-facing ✅ |
| XSS | N/A | No HTML response ✅ |
| Data exfiltration via DB | Medium | D1 access via API only ⚠️ |

---

## Production Hardening Checklist

Before going to real production:

- [ ] Move secrets to `wrangler secret put`
- [ ] Restrict CORS to specific origins
- [ ] Add rate limiting (Cloudflare Rules)
- [ ] Implement key rotation
- [ ] Add comprehensive input validation
- [ ] Generic error messages (log details server-side)
- [ ] Set up logging aggregation (Logpush)
- [ ] Add alerting on errors
- [ ] Add API key authentication for consumer API
- [ ] Set max body size limits
- [ ] Add request ID tracking (for debugging)

---

## Security Audit Quick Commands

```bash
# Check secret in current config (should use wrangler secret, not wrangler.toml)
grep WELLBEING_WEBHOOK_SECRET wrangler.toml

# Check CORS settings
grep -r "Access-Control-Allow-Origin" src/

# Check for unsafe SQL patterns
grep -r "prepare.*\${" src/

# Check error message verbosity
grep -r "details.*message" src/
```

---

## For this assignment (A5)

**Current security level is appropriate for A5 demonstration.**

What's needed for A5:
- ✅ HMAC working
- ✅ Idempotency working
- ✅ Replay protection
- ✅ SQL safe

What's NOT needed for A5 but should be in production:
- ⚠️ Rate limiting
- ⚠️ Real authentication
- ⚠️ Production logging

The professor will see "production-ready pattern" not "production deployment".
