# Production URLs Reference

All URLs ที่ต้องใช้ — copy จากที่นี่ไปใส่ใน evidence doc

---

## Required URLs (fill in actual values)

### Helpdesk (your Worker)

| Endpoint | URL | Purpose |
|---|---|---|
| Health check | `https://helpdesk-team14.YOUR-SUB.workers.dev/healthz` | Verify deploy alive |
| Webhook receiver | `https://helpdesk-team14.YOUR-SUB.workers.dev/webhooks/wellbeing` | Team 16 sends events here |
| Admin retry-now | `https://helpdesk-team14.YOUR-SUB.workers.dev/admin/retry-now` | Trigger outbox retry manually |

### Mock Wellbeing (your Mock Worker)

| Endpoint | URL | Purpose |
|---|---|---|
| Health check | `https://wellbeing-mock.YOUR-SUB.workers.dev/v1/_debug/calls` | Verify mock alive |
| Create case | `https://wellbeing-mock.YOUR-SUB.workers.dev/v1/cases` | Helpdesk POSTs here |
| Self-doc | `https://wellbeing-mock.YOUR-SUB.workers.dev/v1/_debug/docs` | Mock API documentation |
| Trigger webhook | `https://wellbeing-mock.YOUR-SUB.workers.dev/internal/trigger-webhook` | Mock → Helpdesk webhook |
| Debug UI | `https://wellbeing-mock.YOUR-SUB.workers.dev/debug-ui.html?mock=https://wellbeing-mock.YOUR-SUB.workers.dev` | Browser debug page |

### Cloudflare Dashboard (for verification)

- **Workers:** https://dash.cloudflare.com/YOUR-ACCOUNT-ID/workers
- **D1:** https://dash.cloudflare.com/YOUR-ACCOUNT-ID/d1

---

## How to find your subdomain

After first deploy:
```bash
wrangler deploy
# Output:
#   Published mfu-lostfound (X.XX sec)
#     https://mfu-lostfound.YOUR-SUB.workers.dev
```

OR check existing:
```bash
wrangler whoami
# Shows your account email
```

---

## Configuration in .env.json

After you know your URLs, update `What-i-can/scripts/.env.json`:

```json
{
  "wellbeing_url": "https://wellbeing-mock.YOUR-SUB.workers.dev",
  "helpdesk_url": "https://helpdesk-team14.YOUR-SUB.workers.dev"
}
```

Replace `YOUR-SUB` with actual subdomain (e.g., `itemfound` if that's your account subdomain).

---

## Expected responses (sanity check)

| URL | Expected |
|---|---|
| `/healthz` | `{"data":{"status":"ok","version":"1.0.0","d1":"ok","ts":"..."}}` |
| `/v1/_debug/calls` | `{"calls":[],"degraded":false,"count":0}` (or array of calls) |
| `/v1/_debug/docs` | `{"service":"wellbeing-mock","endpoints":[...]}` |

---

## When Team 16 ready

Swap mock URLs to real:

```json
{
  "wellbeing_url": "https://api.wellbeing.mfu.ac.th",   // real URL
  "helpdesk_url": "https://helpdesk-team14.YOUR-SUB.workers.dev"
}
```

Code unchanged — see `docs/SWAP.md` for details.

---

## DNS troubleshooting

If URLs don't resolve:

1. **Wait 1-2 min** — first deploy may take time for cert/DNS
2. **Hard refresh browser** — Ctrl+Shift+R
3. **Flush DNS:** `ipconfig /flushdns` (Windows)
4. **Try incognito** — bypass browser cache
5. **Verify in Cloudflare dashboard:** Workers → Logs → see real-time traffic

If still failing:
```powershell
nslookup helpdesk-team14.YOUR-SUB.workers.dev
# Should return Cloudflare IPs (not error)
```

---

## Quick verification script

```bash
# Verify all URLs respond
node What-i-can/scripts/preflight.cjs

# Should see all ✅
# If any ❌, see TROUBLESHOOTING.md
```
