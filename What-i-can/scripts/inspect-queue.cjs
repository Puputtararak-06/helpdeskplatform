// scripts/inspect-queue.cjs
// Inspect the webhook outbox queue — see what's pending, sent, failed.
// Useful when debugging degradation/recovery scenarios.
//
// Usage:
//   node scripts/inspect-queue.cjs
//   node scripts/inspect-queue.cjs --local

const { execSync } = require('child_process');

const DB_NAME = 'helpdesk-db';

function runSql(sql, local) {
  const flag = local ? '--local' : '--remote';
  try {
    const out = execSync(
      `wrangler d1 execute ${DB_NAME} ${flag} --command="${sql.replace(/"/g, '\\"')}" --json`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
    return JSON.parse(out);
  } catch (e) {
    return { error: e.message };
  }
}

const SQLS = {
  summary: `SELECT status, COUNT(*) as n FROM webhook_outbox GROUP BY status`,
  pending: `SELECT id, idempotency_key, ticket_id, endpoint, attempts, last_error, datetime(created_at) as created_at
            FROM webhook_outbox WHERE status IN ('pending', 'retrying', 'failed')
            ORDER BY created_at ASC LIMIT 20`,
  recent: `SELECT id, idempotency_key, ticket_id, status, attempts, datetime(sent_at) as sent_at
           FROM webhook_outbox WHERE status = 'sent' ORDER BY id DESC LIMIT 10`,
  failures: `SELECT id, idempotency_key, ticket_id, attempts, last_error, datetime(last_attempt_at) as last_attempt
             FROM webhook_outbox WHERE status = 'failed' ORDER BY last_attempt_at DESC LIMIT 10`,
  events: `SELECT event_key, event_type, source, datetime(received_at) as received_at,
                   datetime(processed_at) as processed_at
            FROM webhook_events ORDER BY id DESC LIMIT 10`,
  tickets: `SELECT ticket_ref, wellbeing_record_id, wellbeing_status, datetime(wellbeing_synced_at) as synced_at
            FROM tickets WHERE wellbeing_record_id IS NOT NULL
            ORDER BY wellbeing_synced_at DESC LIMIT 10`,
};

function main() {
  const local = process.argv.includes('--local');
  console.log(`\n📦 Webhook outbox + events (${local ? 'local' : 'remote'} DB)\n`);

  // Summary
  console.log('Outbox summary:');
  const summaryRes = runSql(SQLS.summary, local);
  if (summaryRes.error) {
    console.log(`  ❌ ${summaryRes.error}`);
  } else {
    const rows = (summaryRes[0]?.results || []);
    if (rows.length === 0) {
      console.log('  (empty — no items ever queued)');
    } else {
      rows.forEach(r => console.log(`  ${r.status.padEnd(12)} ${r.n}`));
    }
  }

  // Pending
  console.log('\nPending/retrying/failed (need attention):');
  const pendingRes = runSql(SQLS.pending, local);
  if (pendingRes.error) {
    console.log(`  ❌ ${pendingRes.error}`);
  } else {
    const rows = pendingRes[0]?.results || [];
    if (rows.length === 0) {
      console.log('  ✅ Nothing pending — all clean');
    } else {
      rows.forEach(r => {
        console.log(`  #${r.id}  ${r.idempotency_key.slice(0, 30)}…  attempts=${r.attempts}  ticket=${r.ticket_id || '-'}`);
        if (r.last_error) console.log(`         err: ${r.last_error.slice(0, 80)}`);
      });
    }
  }

  // Recent sent
  console.log('\nRecently sent:');
  const sentRes = runSql(SQLS.recent, local);
  if (sentRes.error) {
    console.log(`  ❌ ${sentRes.error}`);
  } else {
    const rows = sentRes[0]?.results || [];
    if (rows.length === 0) {
      console.log('  (none sent yet)');
    } else {
      rows.forEach(r => console.log(`  #${r.id}  ${r.idempotency_key.slice(0, 30)}…  sent=${r.sent_at || '?'}`));
    }
  }

  // Failures
  console.log('\nFailures:');
  const failRes = runSql(SQLS.failures, local);
  if (!failRes.error) {
    const rows = failRes[0]?.results || [];
    if (rows.length === 0) {
      console.log('  ✅ No permanent failures');
    } else {
      rows.forEach(r => console.log(`  #${r.id}  attempts=${r.attempts}  err: ${(r.last_error || '').slice(0, 70)}`));
    }
  }

  // Webhook events received
  console.log('\nWebhook events received (last 10):');
  const eventsRes = runSql(SQLS.events, local);
  if (!eventsRes.error) {
    const rows = eventsRes[0]?.results || [];
    if (rows.length === 0) {
      console.log('  (none received)');
    } else {
      rows.forEach(r => console.log(`  ${r.event_key.slice(0, 30)}…  ${r.event_type}  ${r.received_at}`));
    }
  }

  // Tickets synced
  console.log('\nTickets with wellbeing link (last 10):');
  const ticketsRes = runSql(SQLS.tickets, local);
  if (!ticketsRes.error) {
    const rows = ticketsRes[0]?.results || [];
    if (rows.length === 0) {
      console.log('  (no tickets synced yet)');
    } else {
      rows.forEach(r => console.log(`  ${r.ticket_ref}  →  ${r.wellbeing_record_id}  (${r.wellbeing_status})`));
    }
  }

  console.log('');
}

main();
