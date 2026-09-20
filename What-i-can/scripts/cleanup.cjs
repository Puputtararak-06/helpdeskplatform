// scripts/cleanup.cjs
// Reset all test data from Helpdesk DB + Mock.
// Run BEFORE each test cycle for a clean slate.
//
// Usage:
//   node scripts/cleanup.cjs               # remote
//   node scripts/cleanup.cjs --local       # local DB
//   node scripts/cleanup.cjs --include-mock # also reset mock state
//
// Requires env.json for mock URL (see .env.example).

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DB_NAME = 'helpdesk-db';

function runSql(sql, local) {
  const flag = local ? '--local' : '--remote';
  try {
    return execSync(
      `wrangler d1 execute ${DB_NAME} ${flag} --command="${sql.replace(/"/g, '\\"')}"`,
      { encoding: 'utf8', stdio: 'pipe' }
    );
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

async function resetMock(envFile) {
  if (!fs.existsSync(envFile)) {
    console.log(`  ⚠️  No env file at ${envFile}, skipping mock reset`);
    return false;
  }
  const env = JSON.parse(fs.readFileSync(envFile, 'utf8'));
  if (!env.wellbeing_url) {
    console.log('  ⚠️  No wellbeing_url in env, skipping mock reset');
    return false;
  }
  try {
    const r = await fetch(`${env.wellbeing_url}/v1/_debug/reset`, { method: 'POST' });
    if (r.ok) {
      console.log(`  ✅ Mock reset (${env.wellbeing_url})`);
      return true;
    }
    console.log(`  ⚠️  Mock reset returned ${r.status}`);
    return false;
  } catch (e) {
    console.log(`  ⚠️  Mock reset failed: ${e.message}`);
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const local = args.includes('--local');
  const includeMock = args.includes('--include-mock');
  const envFile = path.join(__dirname, '.env.json');

  console.log(`\n🧹 Cleanup (${local ? 'local' : 'remote'} DB${includeMock ? ' + mock' : ''})\n`);
  console.log('⚠️  This DELETES test data. Press Ctrl+C within 3s to cancel.\n');

  await new Promise(r => setTimeout(r, 3000));

  console.log('DB cleanup:');

  // Clear new tables
  const cleanup = [
    "DELETE FROM webhook_events",
    "DELETE FROM webhook_outbox",
    "UPDATE partner_sync_health SET status='unknown', consecutive_failures=0, last_failure_at=NULL",
    "UPDATE tickets SET wellbeing_record_id=NULL, wellbeing_status=NULL, wellbeing_synced_at=NULL WHERE wellbeing_record_id LIKE 'wb-test-%' OR wellbeing_record_id LIKE 'wb-debug-%' OR wellbeing_record_id LIKE 'wb-prod-%' OR wellbeing_record_id LIKE 'wb-mock-%' OR wellbeing_record_id LIKE 'wb-169%'",
  ];

  for (const sql of cleanup) {
    try {
      runSql(sql, local);
      console.log(`  ✅ ${sql.slice(0, 70)}${sql.length > 70 ? '…' : ''}`);
    } catch (e) {
      console.log(`  ❌ ${sql.slice(0, 70)}: ${e.message}`);
    }
  }

  if (includeMock) {
    console.log('\nMock cleanup:');
    await resetMock(envFile);
  }

  console.log('\n✅ Cleanup complete.\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
