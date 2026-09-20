// scripts/verify-sig.cjs
// Standalone HMAC signature verifier — debug tool.
// Use when webhook fails with 401 to check if signature is the issue.
//
// Usage:
//   node scripts/verify-sig.cjs --secret=mysecret --header="t=1695371415000,v1=abc..." --body='{"event":"test"}'
//   # pipe body from file:
//   cat payload.json | node scripts/verify-sig.cjs --secret=mysecret --header="t=...,v1=..."

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')),
);

const secret = args.secret;
const header = args.header;
const bodyArg = args.body;
const toleranceMin = Number(args['tolerance-min'] || 5);

if (!secret || !header) {
  console.error(`Usage:
  node scripts/verify-sig.cjs --secret=SECRET --header="t=MS,v1=HEX" --body='{"..."}'
  cat body.json | node scripts/verify-sig.cjs --secret=SECRET --header="t=MS,v1=HEX"

Optional:
  --tolerance-min=5   (default 5 minutes)`);
  process.exit(1);
}

async function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.on('data', c => data += c);
    process.stdin.on('end', () => resolve(data));
  });
}

async function main() {
  const body = bodyArg || await readStdin();

  console.log('🔍 HMAC signature verifier\n');
  console.log(`Secret:    ${secret.slice(0, 6)}...${secret.slice(-4)} (${secret.length} chars)`);
  console.log(`Header:    ${header}`);
  console.log(`Body:      ${body.slice(0, 100)}${body.length > 100 ? '…' : ''} (${body.length} bytes)`);
  console.log(`Tolerance: ${toleranceMin} minutes\n`);

  // Parse header
  const parts = {};
  for (const p of header.split(',')) {
    const [k, v] = p.trim().split('=');
    if (k && v) parts[k] = v;
  }
  const ts = Number(parts.t);
  const sig = parts.v1;

  if (!ts || !sig) {
    console.log('❌ Header malformed — need both t= and v1=');
    process.exit(1);
  }

  // Check timestamp
  const ageMs = Date.now() - ts;
  const ageMin = ageMs / 60000;
  console.log(`Timestamp: ${ts} (${ageMin.toFixed(1)} minutes ago)`);
  if (Math.abs(ageMin) > toleranceMin) {
    console.log(`⚠️  Outside tolerance window (>${toleranceMin} min) — verify will reject as expired`);
  }

  // Compute expected
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${body}`));
  const expected = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  console.log(`\nExpected:  ${expected}`);
  console.log(`Received:  ${sig}`);
  console.log(`Match:     ${sig === expected ? '✅' : '❌'}`);
  console.log(`Length:    expected=${expected.length} received=${sig.length}`);

  if (sig === expected) {
    console.log('\n✅ Signature is VALID');
    if (Math.abs(ageMin) > toleranceMin) {
      console.log('   But timestamp expired — server will reject anyway');
    }
  } else {
    console.log('\n❌ Signature MISMATCH');
    console.log('\nPossible causes:');
    console.log('  1. Wrong secret');
    console.log('  2. Body was modified between sign and verify (extra whitespace, re-serialization)');
    console.log('  3. Timestamp in header is wrong (sign and verify used different ts)');
    console.log('\nDebug steps:');
    console.log('  - Compare secret exactly (no trailing newline, no quotes)');
    console.log('  - Use raw body bytes (await c.req.text() before JSON.parse)');
    console.log('  - Print exact signed message: "<ts>.<body>"');
  }

  // Print exact message format
  console.log(`\nExact signed message:`);
  console.log(JSON.stringify(`${ts}.${body}`));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
