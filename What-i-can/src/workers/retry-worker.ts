// src/workers/retry-worker.ts
// Cron-triggered retry of pending/failed webhook_outbox items.
//
// How to wire into your main Worker:
//
// 1) In wrangler.toml:
//      [triggers]
//      crons = ["*/5 * * * *"]    # every 5 minutes
//
// 2) In src/index.ts:
//      import { processOutbox } from './workers/retry-worker';
//      export default {
//        fetch: app.fetch,
//        async scheduled(event, env, ctx) {
//          ctx.waitUntil(processOutbox(env));
//        },
//      };
//
// 3) Optional: HTTP trigger for manual retry during testing:
//      GET /admin/retry-now  → runs processOutbox once, returns counts

import { sign } from '../lib/hmac';

export interface RetryEnv {
  DB: D1Database;
  WELLBEING_API_URL: string;
  WELLBEING_WEBHOOK_SECRET: string;
}

interface OutboxItem {
  id: number;
  idempotency_key: string;
  ticket_id: string | null;
  destination: string;
  endpoint: string;
  payload: string;
  attempts: number;
  last_attempt_at: string | null;
  created_at: string;
}

const MAX_ATTEMPTS = 5;
const RETRY_BACKOFF_SEC = 60; // wait at least 60s before retry
const BATCH_SIZE = 20;

export interface RetryStats {
  processed: number;
  sent: number;
  failed: number;
  retry: number;
  skipped: number;
}

/**
 * Process pending/failed outbox items with backoff.
 * Returns stats — useful for monitoring or admin display.
 */
export async function processOutbox(env: RetryEnv): Promise<RetryStats> {
  const stats: RetryStats = { processed: 0, sent: 0, failed: 0, retry: 0, skipped: 0 };

  // Fetch items eligible for retry with exponential backoff per item:
  //   attempt 0 → wait 60s
  //   attempt 1 → wait 120s (2 min)
  //   attempt 2 → wait 240s (4 min)
  //   attempt 3 → wait 480s (8 min)
  //   attempt 4+ → wait 960s (16 min)
  const items = await env.DB.prepare(
    `SELECT id, idempotency_key, ticket_id, destination, endpoint, payload, attempts, last_attempt_at, created_at
     FROM webhook_outbox
     WHERE status IN ('pending', 'retrying', 'failed')
       AND (
         last_attempt_at IS NULL
         OR datetime(last_attempt_at, '+' || CASE
             WHEN attempts = 0 THEN 60
             WHEN attempts = 1 THEN 120
             WHEN attempts = 2 THEN 240
             WHEN attempts = 3 THEN 480
             ELSE 960
           END || ' seconds') < datetime('now')
       )
     ORDER BY created_at ASC
     LIMIT ?`,
  ).bind(BATCH_SIZE).all<OutboxItem>();

  const list = items.results ?? [];
  stats.processed = list.length;

  for (const item of list) {
    // Permanent failure: too many attempts
    if (item.attempts >= MAX_ATTEMPTS) {
      await env.DB.prepare(
        `UPDATE webhook_outbox SET status = 'failed', last_error = ?
         WHERE id = ?`,
      ).bind(`max attempts (${MAX_ATTEMPTS}) reached`, item.id).run();
      stats.failed++;
      continue;
    }

    const url = `${env.WELLBEING_API_URL}${item.endpoint}`;
    const sig = await sign(env.WELLBEING_WEBHOOK_SECRET, item.payload);

    let status = 0;
    let respBody = '';
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': item.idempotency_key,
          'X-Signature': sig,
        },
        body: item.payload,
      });
      status = resp.status;
      respBody = (await resp.text()).slice(0, 500);
    } catch (e: any) {
      respBody = `network error: ${e.message}`;
    }

    if (status >= 200 && status < 300) {
      await env.DB.prepare(
        `UPDATE webhook_outbox
         SET status = 'sent', attempts = attempts + 1, sent_at = datetime('now'),
             last_attempt_at = datetime('now'), last_error = NULL
         WHERE id = ?`,
      ).bind(item.id).run();
      stats.sent++;
      console.log(`[retry] sent id=${item.id} status=${status}`);
    } else {
      // Retryable: 5xx, network error. Non-retryable: 4xx (client error)
      const retryable = status === 0 || status >= 500;
      const newStatus = retryable ? 'retrying' : 'failed';
      await env.DB.prepare(
        `UPDATE webhook_outbox
         SET status = ?, attempts = attempts + 1, last_attempt_at = datetime('now'),
             last_error = ?
         WHERE id = ?`,
      ).bind(newStatus, `status=${status} body=${respBody}`, item.id).run();
      if (retryable) stats.retry++;
      else stats.failed++;
      console.warn(`[retry] failed id=${item.id} status=${status} retryable=${retryable}`);
    }
  }

  if (list.length > 0) {
    console.log(`[retry] batch complete: processed=${stats.processed} sent=${stats.sent} retry=${stats.retry} failed=${stats.failed}`);
  }
  return stats;
}

/**
 * Cron entry point — call from your scheduled handler.
 * Wraps processOutbox with logging.
 */
export async function handleScheduled(event: ScheduledController, env: RetryEnv, ctx: ExecutionContext): Promise<void> {
  console.log(`[cron] scheduled trigger at ${new Date(event.scheduledTime).toISOString()}`);
  ctx.waitUntil(processOutbox(env));
}
