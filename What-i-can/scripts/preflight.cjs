// scripts/preflight.cjs
// Pre-flight validation BEFORE running integration tests.
// Checks: env config, mock URL alive, helpdesk URL alive, HMAC works end-to-end.
//
// Usage:
//   node scripts/preflight.cjs
//   node scripts/preflight.cjs --env-file=./scripts/.env.json
//
// Exit code: 0 if all PASS, 1 if any FAIL.

const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')),
);
const envFile = args['env-file'] || path.join(__dirname, '.env.json');

let passed = 0, failed = 0;
const checks = [];

async function check(name, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const ok = result === true || (result && result.pass);
    const ms = Date.now() - start;
    checks.push({ name, ok, ms, detail: typeof result === 'object' ? result.detail : '' });
    if (ok) passed++; else failed++;
    return ok;
  } catch (e) {
    const ms = Date.now() - start;
    checks.push({ name, ok: false, ms, detail: e.message });
    failed++;
    return false;
  }
}

async function sign(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const ts = Date.now();
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${payload}`));
  const sig = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `t=${ts},v1=${sig}`;
}

async function main() {
  console.log(`\n🔍 Pre-flight check\n`);

  // 1. env file exists
  let env = {};
  await check('Env file exists', async () => {
    if (!fs.existsSync(envFile)) {
      return { pass: false, detail: `${envFile} not found. Create with: {"wellbeing_url":"...","helpdesk_url":"..."}` };
    }
    env = JSON.parse(fs.readFileSync(envFile, 'utf8'));
    return { pass: true, detail: envFile };
  });

  // 2. required vars
  await check('env.wellbeing_url set', async () => {
    if (!env.wellbeing_url) return { pass: false, detail: 'env.wellbeing_url missing' };
    if (!env.wellbeing_url.startsWith('https://')) return { pass: false, detail: 'must be https://' };
    return { pass: true, detail: env.wellbeing_url };
  });

  await check('env.helpdesk_url set', async () => {
    if (!env.helpdesk_url) return { pass: false, detail: 'env.helpdesk_url missing' };
    if (!env.helpdesk_url.startsWith('https://')) return { pass: false, detail: 'must be https://' };
    return { pass: true, detail: env.helpdesk_url };
  });

  // 3. mock alive
  await check('Mock URL responds', async () => {
    if (!env.wellbeing_url) return { pass: false, detail: 'skip (no URL)' };
    try {
      const r = await fetch(`${env.wellbeing_url}/v1/_debug/calls`, { signal: AbortSignal.timeout(10000) });
      if (r.status !== 200) return { pass: false, detail: `status ${r.status}` };
      const data = await r.json();
      return { pass: true, detail: `mock online, ${data.count || 0} calls` };
    } catch (e) {
      return { pass: false, detail: e.message };
    }
  });

  // 4. helpdesk healthz
  await check('Helpdesk /healthz responds', async () => {
    if (!env.helpdesk_url) return { pass: false, detail: 'skip (no URL)' };
    try {
      const r = await fetch(`${env.helpdesk_url}/healthz`, { signal: AbortSignal.timeout(10000) });
      if (r.status !== 200) return { pass: false, detail: `status ${r.status}` };
      const data = await r.json();
      const d1 = data.data?.d1 || data.d1 || 'unknown';
      return { pass: true, detail: `healthz ok, d1=${d1}` };
    } catch (e) {
      return { pass: false, detail: e.message };
    }
  });

  // 5. Helpdesk webhook endpoint reachable
  await check('Helpdesk webhook endpoint exists', async () => {
    if (!env.helpdesk_url) return { pass: false, detail: 'skip' };
    try {
      const r = await fetch(`${env.helpdesk_url}/webhooks/wellbeing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Signature': 'invalid' },
        body: '{}',
        signal: AbortSignal.timeout(10000),
      });
      // Expect 401 (bad sig) or 400 (bad JSON) — NOT 404 (route missing)
      if (r.status === 404) return { pass: false, detail: 'route not registered (404)' };
      if (r.status === 401) return { pass: true, detail: 'route exists, auth working (401)' };
      if (r.status === 400) return { pass: true, detail: 'route exists, validation working (400)' };
      return { pass: true, detail: `route exists (${r.status})` };
    } catch (e) {
      return { pass: false, detail: e.message };
    }
  });

  // 6. Mock signature works (sender→receiver)
  await check('Mock can sign with secret (sender path)', async () => {
    if (!env.wellbeing_url) return { pass: false, detail: 'skip' };
    try {
      // Trigger a webhook with valid sig (mock signs it)
      const r = await fetch(`${env.wellbeing_url}/internal/trigger-webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'preflight.test', idempotency_key: `preflight-${Date.now()}` }),
        signal: AbortSignal.timeout(10000),
      });
      const data = await r.json();
      // Should get a helpdesk response (200) if secret matches
      if (r.ok) {
        const helpdeskOk = data.helpdesk_status >= 200 && data.helpdesk_status < 300;
        return {
          pass: helpdeskOk,
          detail: `mock→helpdesk: ${data.helpdesk_status} ${helpdeskOk ? '✅ secrets match' : '❌ secret mismatch'}`,
        };
      }
      return { pass: false, detail: `trigger failed: ${JSON.stringify(data)}` };
    } catch (e) {
      return { pass: false, detail: e.message };
    }
  });

  // Summary
  console.log('\nResults:\n');
  for (const c of checks) {
    console.log(`  ${c.ok ? '✅' : '❌'} ${c.name.padEnd(45)} ${String(c.ms + 'ms').padStart(8)}  ${c.detail}`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Total: ${passed + failed} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  console.log('='.repeat(80));

  if (failed > 0) {
    console.log('\n⚠️  Fix failures BEFORE running tests. See TROUBLESHOOTING.md.\n');
    process.exit(1);
  } else {
    console.log('\n🎉 All preflight checks passed. Ready to run tests.\n');
    console.log('   Next: node scripts/run-tests.cjs\n');
    process.exit(0);
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
