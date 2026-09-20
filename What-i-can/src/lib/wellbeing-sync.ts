// src/lib/wellbeing-sync.ts
// Send events from Helpdesk to Wellbeing (Team 16) API.
// Signs requests with HMAC, records to outbox for retry, idempotent.

import { sign } from './hmac';

export interface SyncConfig {
  apiUrl: string;        // e.g. https://wellbeing-mock.<sub>.workers.dev
  secret: string;        // shared secret
}

export interface SendResult {
  ok: boolean;
  status: number;
  body: any;
  retryable: boolean;
}

/**
 * Send a POST request to the Wellbeing API with HMAC signature.
 * Records to webhook_outbox for audit/retry.
 *
 * Pass DB binding if you want outbox persistence.
 */
export async function sendToWellbeing(
  config: SyncConfig,
  db: D1Database | null,
  path: string,
  body: any,
  opts: { idempotencyKey: string; ticketId?: string },
): Promise<SendResult> {
  const payload = JSON.stringify(body);
  const sigHeader = await sign(config.secret, payload);

  let status = 0;
  let respBody: any = {};
  let ok = false;

  try {
    const resp = await fetch(`${config.apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': opts.idempotencyKey,
        'X-Signature': sigHeader,
      },
      body: payload,
    });
    status = resp.status;
    respBody = await resp.json().catch(() => ({}));
    ok = resp.ok;
  } catch (e: any) {
    respBody = { error: e.message };
  }

  // Record to outbox (best-effort)
  if (db) {
    try {
      await db.prepare(
        `INSERT INTO webhook_outbox
           (idempotency_key, ticket_id, destination, endpoint, payload, status, attempts, last_attempt_at, sent_at)
         VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'), ?)
         ON CONFLICT(idempotency_key) DO UPDATE SET
           status = excluded.status,
           attempts = attempts + 1,
           last_attempt_at = datetime('now'),
           sent_at = CASE WHEN excluded.status = 'sent' THEN datetime('now') ELSE sent_at END`,
      ).bind(
        opts.idempotencyKey,
        opts.ticketId ?? null,
        'wellbeing',
        path,
        payload,
        ok ? 'sent' : 'failed',
        ok ? new Date().toISOString() : null,
      ).run();
    } catch (e) {
      // Outbox write failure should not break the request — log only
      console.error('[sync] outbox write failed:', (e as Error).message);
    }
  }

  return {
    ok,
    status,
    body: respBody,
    retryable: !ok && (status === 0 || status >= 500), // network or server error
  };
}

/**
 * Convenience: create a wellbeing case for a ticket.
 * Returns the case_id on success, or { error } on failure.
 */
export async function createWellbeingCase(
  config: SyncConfig,
  db: D1Database | null,
  ticketRef: string,
  urgency: 'low' | 'medium' | 'high' = 'medium',
): Promise<{ caseId?: string; error?: string }> {
  const idempotencyKey = `ticket-${ticketRef}-case`;

  const result = await sendToWellbeing(
    config, db,
    '/v1/cases',
    { ticket_ref: ticketRef, urgency },
    { idempotencyKey, ticketId: ticketRef },
  );

  if (result.ok && result.body?.case_id) {
    // Update local ticket
    if (db) {
      await db.prepare(
        `UPDATE tickets
         SET wellbeing_record_id = ?, wellbeing_status = ?, wellbeing_synced_at = datetime('now')
         WHERE ticket_ref = ?`,
      ).bind(result.body.case_id, 'open', ticketRef).run();
    }
    return { caseId: result.body.case_id };
  }

  // Failed — mark as pending_sync for later retry
  if (db) {
    await db.prepare(
      `UPDATE tickets
       SET wellbeing_status = 'pending_sync', wellbeing_synced_at = datetime('now')
       WHERE ticket_ref = ?`,
    ).bind(ticketRef).run();
  }

  return { error: `status=${result.status} body=${JSON.stringify(result.body)}` };
}
