// scripts/send-webhook.cjs
// CLI to send a webhook to Helpdesk webhook receiver.
// Useful for testing webhook.ts handler logic without using the mock.
//
// Usage:
//   node scripts/send-webhook.cjs --url=https://helpdesk-team14.<sub>.workers.dev/webhooks/wellbeing --secret=mysecret
//   node scripts/send-webhook.cjs --body='{"event":"wellbeing.case.opened","data":{"case_id":"wb-123","ticket_ref":"TKT-1"},"idempotency_key":"evt-1"}'

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')),
);

const url = args.url || process.env.WEBHOOK_URL;
const secret = args.secret || process.env.WELLBEING_WEBHOOK_SECRET;
const event = args.event || 'wellbeing.case.opened';
const idempotencyKey = args['idempotency-key'] || `cli-${Date.now()}`;
const bodyArg = args.body;
const ticketRef = args['ticket-ref'] || 'TKT-CLI';

if (!url) {
  console.error('Missing --url=<helpdesk-webhook-url>');
  process.exit(1);
}
if (!secret) {
  console.error('Missing --secret=<shared-secret>');
  process.exit(1);
}

const body = bodyArg || JSON.stringify({
  event,
  data: { case_id: `wb-cli-${Date.now()}`, ticket_ref: ticketRef },
  timestamp: new Date().toISOString(),
  idempotency_key: idempotencyKey,
});

async function sign(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const ts = Date.now();
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${payload}`));
  const sig = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { header: `t=${ts},v1=${sig}`, timestamp: ts };
}

async function main() {
  console.log('📤 Sending webhook to Helpdesk\n');
  console.log(`URL:    ${url}`);
  console.log(`Event:  ${event}`);
  console.log(`Key:    ${idempotencyKey}`);

  const { header, timestamp } = await sign(secret, body);

  console.log(`\nBody (${body.length} bytes):`);
  console.log(body);
  console.log(`\nSigned header: ${header}`);
  console.log(`Timestamp:     ${timestamp}`);

  const start = Date.now();
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': header,
      },
      body,
    });
    const ms = Date.now() - start;
    const text = await resp.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }

    console.log(`\nResponse (${ms}ms):`);
    console.log(`  Status: ${resp.status} ${resp.statusText}`);
    console.log(`  Body:   ${JSON.stringify(parsed, null, 2)}`);

    if (resp.ok) {
      console.log('\n✅ Webhook accepted');
    } else if (resp.status === 401) {
      console.log('\n❌ 401 — Signature rejected');
      console.log('   Check WELLBEING_WEBHOOK_SECRET matches in Helpdesk');
    } else if (resp.status === 404) {
      console.log('\n❌ 404 — Route not registered');
      console.log('   Did you add: app.post("/webhooks/wellbeing", handleWellbeingWebhook) in main src?');
    } else {
      console.log(`\n❌ ${resp.status} — Server error`);
    }
  } catch (e) {
    console.log(`\n❌ Network error: ${e.message}`);
    process.exit(1);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
