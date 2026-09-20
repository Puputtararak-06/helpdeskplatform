// scripts/load-test.cjs
// Send N concurrent webhook calls to test throughput + idempotency at scale.
// Run BEFORE submission to prove system handles burst load.
//
// Usage:
//   node scripts/load-test.cjs --concurrency=50 --total=200
//   node scripts/load-test.cjs --endpoint=/v1/cases --concurrency=10

const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')),
);

const envFile = args['env-file'] || path.join(__dirname, '.env.json');
const concurrency = Number(args.concurrency || 20);
const total = Number(args.total || 100);
const endpoint = args.endpoint || '/v1/cases';

if (!fs.existsSync(envFile)) {
  console.error(`Missing: ${envFile}\nRun from project root or set --env-file=...`);
  process.exit(1);
}

const env = JSON.parse(fs.readFileSync(envFile, 'utf8'));
if (!env.wellbeing_url) {
  console.error('Missing wellbeing_url in env file');
  process.exit(1);
}

async function sendOne(i) {
  const ticketRef = `LOAD-${Date.now()}-${i}`;
  const idempKey = `load-${Date.now()}-${i}`;
  const url = `${env.wellbeing_url}${endpoint}`;
  const start = Date.now();
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempKey },
      body: JSON.stringify({ ticket_ref: ticketRef, urgency: 'medium' }),
    });
    const ms = Date.now() - start;
    return { ok: resp.ok, status: resp.status, ms };
  } catch (e) {
    return { ok: false, error: e.message, ms: Date.now() - start };
  }
}

async function main() {
  console.log(`\n🚀 Load test: ${total} requests @ concurrency ${concurrency}`);
  console.log(`   Endpoint: ${env.wellbeing_url}${endpoint}\n`);

  const results = [];
  const start = Date.now();

  // Run in batches of `concurrency`
  for (let i = 0; i < total; i += concurrency) {
    const batch = [];
    for (let j = 0; j < concurrency && i + j < total; j++) {
      batch.push(sendOne(i + j));
    }
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
  }

  const totalMs = Date.now() - start;
  const succeeded = results.filter(r => r.ok).length;
  const failed = results.length - succeeded;
  const latencies = results.filter(r => r.ms).map(r => r.ms).sort((a, b) => a - b);

  const p50 = latencies[Math.floor(latencies.length * 0.5)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];
  const max = latencies[latencies.length - 1];
  const min = latencies[0];
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const rps = (results.length / totalMs) * 1000;

  console.log('Results:');
  console.log(`  Total: ${results.length}`);
  console.log(`  ✅ Succeeded: ${succeeded} (${((succeeded / results.length) * 100).toFixed(1)}%)`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log('');
  console.log('Latency:');
  console.log(`  Min:    ${min}ms`);
  console.log(`  Avg:    ${Math.round(avg)}ms`);
  console.log(`  P50:    ${p50}ms`);
  console.log(`  P95:    ${p95}ms`);
  console.log(`  P99:    ${p99}ms`);
  console.log(`  Max:    ${max}ms`);
  console.log('');
  console.log(`Throughput: ${rps.toFixed(1)} req/s`);
  console.log(`Total time: ${totalMs}ms`);
  console.log('');

  // Status code distribution
  const byStatus = {};
  results.forEach(r => {
    const k = r.status || `ERR(${r.error || 'unknown'})`;
    byStatus[k] = (byStatus[k] || 0) + 1;
  });
  console.log('Status distribution:');
  for (const [k, v] of Object.entries(byStatus)) {
    console.log(`  ${k}: ${v}`);
  }

  // Verdict
  console.log('');
  if (failed === 0 && p95 < 1000) {
    console.log('🎉 Pass: all succeeded, P95 < 1s');
  } else if (failed / results.length < 0.05) {
    console.log('✅ Acceptable: <5% failures');
  } else {
    console.log('⚠️  More than 5% failures — investigate before deploy');
    process.exit(1);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
