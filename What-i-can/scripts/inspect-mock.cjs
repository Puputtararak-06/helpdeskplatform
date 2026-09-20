// scripts/inspect-mock.cjs
// Quick CLI to inspect mock state — see call log, degraded status, idempotency cache.
// Run from terminal to debug without opening browser.
//
// Usage:
//   node scripts/inspect-mock.cjs
//   node scripts/inspect-mock.cjs --tail  # continuous monitoring

const fs = require('fs');
const path = require('path');

const envFile = path.join(__dirname, '.env.json');
if (!fs.existsSync(envFile)) {
  console.error(`Missing: ${envFile}`);
  process.exit(1);
}
const env = JSON.parse(fs.readFileSync(envFile, 'utf8'));
if (!env.wellbeing_url) {
  console.error('Missing wellbeing_url');
  process.exit(1);
}

async function fetchState() {
  const r = await fetch(`${env.wellbeing_url}/v1/_debug/calls`);
  return await r.json();
}

function render(state) {
  console.clear();
  console.log(`📡 Mock state @ ${new Date().toLocaleTimeString()}`);
  console.log(`   URL: ${env.wellbeing_url}`);
  console.log(`   Degraded: ${state.degraded ? '💥 YES' : '✅ NO'}`);
  console.log(`   Total calls: ${state.calls?.length || 0}`);
  console.log('');

  const calls = state.calls || [];
  const recent = calls.slice(-15).reverse();
  if (recent.length === 0) {
    console.log('  (no calls yet)');
  } else {
    console.log('Recent calls (newest first):');
    console.log('  ' + '─'.repeat(76));
    recent.forEach((c, i) => {
      const time = (c.ts || '').slice(11, 19);
      const method = c.method || '?';
      const path = c.path || c.destination || '';
      const detail = c.idempKey
        ? `idemp=${c.idempKey.slice(0, 20)}`
        : c.result
          ? `[${c.result}]`
          : c.response
            ? `→ ${c.response.status}`
            : '';
      console.log(`  ${time}  ${method.padEnd(15)} ${path.padEnd(35)} ${detail}`);
    });
    console.log('  ' + '─'.repeat(76));
  }
  console.log('');
  console.log('Commands:');
  console.log('  Ctrl+C: stop');
  console.log('  POST /v1/_debug/reset — clear state');
  console.log('  POST /v1/_debug/break — simulate degradation');
  console.log('  POST /v1/_debug/heal  — recover');
}

async function main() {
  const tail = process.argv.includes('--tail');
  if (tail) {
    console.log('Tailing mock state (Ctrl+C to stop)...\n');
    while (true) {
      try {
        const state = await fetchState();
        render(state);
      } catch (e) {
        console.log(`\n❌ Connection error: ${e.message}`);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  } else {
    try {
      const state = await fetchState();
      render(state);
    } catch (e) {
      console.error(`❌ Connection error: ${e.message}`);
      process.exit(1);
    }
  }
}

main();
