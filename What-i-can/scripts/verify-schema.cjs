// scripts/verify-schema.cjs
// Verify that D1 has all the tables/columns/indexes/constraints
// created by migrations/0005_wellbeing_fields.sql.
//
// Usage:
//   node scripts/verify-schema.cjs           # remote DB
//   node scripts/verify-schema.cjs --local   # local DB
//
// Returns exit 0 if schema is correct, 1 if any check fails.

const { execSync } = require('child_process');

const DB_NAME = 'helpdesk-db';
const REQUIRED_TICKETS_COLUMNS = [
  'wellbeing_record_id',
  'wellbeing_status',
  'wellbeing_synced_at',
  'wellbeing_webhook_secret',
];

const REQUIRED_TABLES = [
  'webhook_events',
  'webhook_outbox',
  'partner_sync_health',
];

const REQUIRED_INDEXES = [
  'idx_tickets_wellbeing_record_id',
  'idx_webhook_events_key',
  'idx_webhook_events_type_time',
  'idx_webhook_outbox_status',
  'idx_webhook_outbox_ticket',
];

function runSql(sql, local) {
  const flag = local ? '--local' : '--remote';
  try {
    const out = execSync(
      `wrangler d1 execute ${DB_NAME} ${flag} --command="${sql.replace(/"/g, '\\"')}" --json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return JSON.parse(out);
  } catch (e) {
    return { error: e.message, stderr: e.stderr ? e.stderr.toString() : '' };
  }
}

let passed = 0, failed = 0;

function check(name, ok, detail = '') {
  if (ok) {
    console.log(`  ✅ ${name}${detail ? ' — ' + detail : ''}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function main() {
  const local = process.argv.includes('--local');
  console.log(`\n🔍 Schema verification (${local ? 'local' : 'remote'} DB: ${DB_NAME})\n`);

  // 1. Tickets table has new columns
  console.log('tickets table columns:');
  const colsRes = runSql('PRAGMA table_info(tickets)', local);
  if (colsRes.error) {
    check('PRAGMA table_info(tickets)', false, colsRes.error);
  } else {
    const cols = (colsRes[0] && colsRes[0].results ? colsRes[0].results : []).map(r => r.name);
    for (const required of REQUIRED_TICKETS_COLUMNS) {
      check(`column: ${required}`, cols.includes(required));
    }
  }

  // 2. New tables exist
  console.log('\nnew tables:');
  const tablesRes = runSql("SELECT name FROM sqlite_master WHERE type='table'", local);
  if (tablesRes.error) {
    check('list tables', false, tablesRes.error);
  } else {
    const tables = (tablesRes[0] && tablesRes[0].results ? tablesRes[0].results : []).map(r => r.name);
    for (const required of REQUIRED_TABLES) {
      check(`table: ${required}`, tables.includes(required));
    }
  }

  // 3. Indexes exist
  console.log('\nindexes:');
  const idxRes = runSql("SELECT name FROM sqlite_master WHERE type='index'", local);
  if (idxRes.error) {
    check('list indexes', false, idxRes.error);
  } else {
    const indexes = (idxRes[0] && idxRes[0].results ? idxRes[0].results : []).map(r => r.name).filter(n => !n.startsWith('sqlite_'));
    for (const required of REQUIRED_INDEXES) {
      check(`index: ${required}`, indexes.includes(required));
    }
  }

  // 4. CHECK constraints
  console.log('\nconstraints (best-effort):');
  const sqlRes = runSql(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name='tickets'",
    local
  );
  if (!sqlRes.error) {
    const sql = (sqlRes[0] && sqlRes[0].results && sqlRes[0].results[0]) ? sqlRes[0].results[0].sql : '';
    check('wellbeing_status CHECK exists', sql.includes('wellbeing_status') && sql.includes('CHECK'));
    check('status CHECK exists', sql.includes("'lost'") === false && sql.includes("'found'") && sql.includes('CHECK'));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);
  console.log('='.repeat(60));

  if (failed > 0) {
    console.log('\n⚠️  Schema incomplete. Re-run migration:');
    console.log('   wrangler d1 execute helpdesk-db --remote --file=What-i-can/migrations/0005_wellbeing_fields.sql');
    console.log('');
    process.exit(1);
  } else {
    console.log('\n🎉 Schema complete. Ready to deploy integration.\n');
    process.exit(0);
  }
}

main();
