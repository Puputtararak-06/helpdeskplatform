// src/routes/webhooks.ts
// Reciever for incoming webhooks from Wellbeing (Team 16).
//
// Mount in your main src/index.ts:
//   import { handleWellbeingWebhook } from './routes/webhooks';
//   app.post('/webhooks/wellbeing', handleWellbeingWebhook);
//
// Reads from env:
//   c.env.WELLBEING_WEBHOOK_SECRET — shared secret
//   c.env.DB — D1 binding
//
// Returns 200 on success (always 200 unless auth fails — partner should not retry on our processing errors).

import type { Context } from 'hono';
import { verify } from '../lib/hmac';

interface WebhookPayload {
  event: string;
  data?: any;
  timestamp: string;
  idempotency_key: string;
}

export async function handleWellbeingWebhook(c: Context) {
  const secret = c.env.WELLBEING_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[webhook] WELLBEING_WEBHOOK_SECRET not set');
    return c.json({ error: 'server misconfigured' }, 500);
  }

  const rawBody = await c.req.text();
  const sigHeader = c.req.header('X-Signature');

  // 1) Verify HMAC signature FIRST — reject bad sigs before doing any work
  const result = await verify(secret, rawBody, sigHeader);
  if (!result.valid) {
    console.log('[webhook] rejected:', result.reason);
    return c.json({ error: 'invalid signature', reason: result.reason }, 401);
  }

  // 2) Parse payload
  let payload: WebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return c.json({ error: 'invalid JSON' }, 400);
  }

  if (!payload.event || !payload.idempotency_key) {
    return c.json({ error: 'missing event or idempotency_key' }, 400);
  }

  // 3) Idempotency check — same event_key → 200 replay, no double-processing
  const existing = await c.env.DB.prepare(
    'SELECT id, processed_at FROM webhook_events WHERE event_key = ?',
  ).bind(payload.idempotency_key).first<{ id: number; processed_at: string | null }>();

  if (existing) {
    console.log('[webhook] idempotent replay, ignoring:', payload.idempotency_key);
    return c.json({ ok: true, replay: true }, 200);
  }

  // 4) Persist event
  await c.env.DB.prepare(
    'INSERT INTO webhook_events (event_key, event_type, payload, source) VALUES (?, ?, ?, ?)',
  ).bind(payload.idempotency_key, payload.event, rawBody, 'wellbeing').run();

  // 5) Process — update linked ticket if event references one
  try {
    await processEvent(c, payload);
    await c.env.DB.prepare(
      'UPDATE webhook_events SET processed_at = datetime(\'now\') WHERE event_key = ?',
    ).bind(payload.idempotency_key).run();
  } catch (e: any) {
    console.error('[webhook] processing error:', e.message);
    // Don't return 500 — we accepted the event. Log for retry later.
  }

  return c.json({ ok: true }, 200);
}

async function processEvent(c: Context, payload: WebhookPayload) {
  const data = payload.data ?? {};
  const ticketRef = data.ticket_ref;
  if (!ticketRef) {
    console.log('[webhook] no ticket_ref in payload, skipping DB update');
    return;
  }

  switch (payload.event) {
    case 'wellbeing.case.opened': {
      const caseId = data.case_id;
      if (!caseId) {
        console.log('[webhook] opened event missing case_id');
        return;
      }
      await c.env.DB.prepare(
        `UPDATE tickets
         SET wellbeing_record_id = ?, wellbeing_status = 'open', wellbeing_synced_at = datetime('now')
         WHERE ticket_ref = ?`,
      ).bind(caseId, ticketRef).run();
      break;
    }

    case 'wellbeing.case.updated': {
      const status = data.status || 'in_progress';
      await c.env.DB.prepare(
        `UPDATE tickets
         SET wellbeing_status = ?, wellbeing_synced_at = datetime('now')
         WHERE ticket_ref = ?`,
      ).bind(status, ticketRef).run();
      break;
    }

    case 'wellbeing.case.closed':
      await c.env.DB.prepare(
        `UPDATE tickets
         SET wellbeing_status = 'closed', wellbeing_synced_at = datetime('now')
         WHERE ticket_ref = ?`,
      ).bind(ticketRef).run();
      break;

    default:
      console.log('[webhook] unhandled event:', payload.event);
  }
}
