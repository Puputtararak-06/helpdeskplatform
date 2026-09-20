// scripts/hmac-test.cjs
// Quick HMAC round-trip sanity check.
// Verifies that sign() and verify() produce consistent results.
// Run BEFORE deploying integration code to catch crypto bugs early.
//
// Usage: node scripts/hmac-test.cjs

const SECRET = 'mock-wellbeing-secret-change-me-when-real-team16-ready';

async function sign(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const timestamp = Date.now();
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`));
  const sig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return { header: `t=${timestamp},v1=${sig}`, timestamp, signature: sig };
}

async function verify(secret, payload, header, toleranceMs = 5 * 60 * 1000) {
  if (!header) return { valid: false, reason: 'missing_signature' };

  const parts = {};
  for (const p of header.split(',')) {
    const [k, v] = p.trim().split('=');
    if (k && v) parts[k] = v;
  }
  const ts = Number(parts.t);
  const sig = parts.v1;
  if (!ts || !sig || Number.isNaN(ts)) return { valid: false, reason: 'malformed_header' };

  const age = Date.now() - ts;
  if (age > toleranceMs) return { valid: false, reason: 'expired' };

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${payload}`));
  const expected = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  // Constant-time compare
  if (sig.length !== expected.length) return { valid: false, reason: 'invalid_signature' };
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return { valid: false, reason: 'invalid_signature' };

  return { valid: true };
}

async function test(name, fn) {
  try {
    const result = await fn();
    const ok = result === true || (result && result.valid);
    console.log(`  ${ok ? '✅' : '❌'} ${name}`);
    if (!ok && result && result.reason) console.log(`     reason: ${result.reason}`);
    return ok;
  } catch (e) {
    console.log(`  ❌ ${name} — ${e.message}`);
    return false;
  }
}

async function main() {
  console.log(`\n🔐 HMAC sanity check (secret: ${SECRET.slice(0, 8)}...)\n`);

  const payload = JSON.stringify({ event: 'test', data: { foo: 'bar' } });
  let passed = 0, failed = 0;

  const tally = (ok) => ok ? passed++ : failed++;

  // Test 1: sign produces a valid header
  const { header, timestamp, signature } = await sign(SECRET, payload);
  console.log(`  📝 Sample signature: ${signature.slice(0, 32)}...`);
  console.log(`  ⏰ Timestamp: ${timestamp}\n`);

  console.log('Tests:');

  tally(await test('1. sign() + verify() with matching secret → valid', async () => {
    const { header } = await sign(SECRET, payload);
    return await verify(SECRET, payload, header);
  }));

  tally(await test('2. verify() with wrong secret → invalid', async () => {
    const { header } = await sign(SECRET, payload);
    return await verify('wrong-secret', payload, header);
  }));

  tally(await test('3. verify() with tampered payload → invalid', async () => {
    const { header } = await sign(SECRET, payload);
    return await verify(SECRET, payload + 'tampered', header);
  }));

  tally(await test('4. verify() with no header → invalid', async () => {
    return await verify(SECRET, payload, null);
  }));

  tally(await test('5. verify() with malformed header → invalid', async () => {
    return await verify(SECRET, payload, 'not-a-valid-header');
  }));

  tally(await test('6. verify() with expired timestamp (>5min) → invalid', async () => {
    // Simulate old timestamp by signing with manually set old time
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const oldTs = Date.now() - 6 * 60 * 1000;
    const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${oldTs}.${payload}`));
    const sig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
    return await verify(SECRET, payload, `t=${oldTs},v1=${sig}`);
  }));

  tally(await test('7. demo payload (wellbeing event) → valid', async () => {
    const eventPayload = JSON.stringify({
      event: 'wellbeing.case.opened',
      data: { case_id: 'wb-test', ticket_ref: 'TKT-001' },
      timestamp: new Date().toISOString(),
      idempotency_key: 'evt-test-001',
    });
    const { header } = await sign(SECRET, eventPayload);
    return await verify(SECRET, eventPayload, header);
  }));

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);
  console.log(`${'='.repeat(50)}\n`);

  if (failed > 0) {
    console.log('⚠️  HMAC implementation has bugs — DO NOT deploy integration yet.\n');
    process.exit(1);
  }
  console.log('🎉 HMAC ready for production deployment.\n');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
