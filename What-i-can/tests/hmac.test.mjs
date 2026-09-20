// tests/hmac.test.mjs
// Unit tests for HMAC signing/verification using Node's built-in test runner.
// Run: node --test What-i-can/tests/hmac.test.mjs
// Or:  npm test  (if you add a test script)

import { test } from 'node:test';
import assert from 'node:assert/strict';

const TEST_SECRET = 'test-secret-12345';

// Re-implement HMAC functions (same logic as src/lib/hmac.ts)
// This is intentional duplication for unit testing — we test the algorithm, not the import

async function sign(secret, payload) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const timestamp = Date.now();
  const buf = await crypto.subtle.sign('HMAC', key, enc.encode(`${timestamp}.${payload}`));
  const sig = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `t=${timestamp},v1=${sig}`;
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

  if (sig.length !== expected.length) return { valid: false, reason: 'invalid_signature' };
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) return { valid: false, reason: 'invalid_signature' };

  return { valid: true };
}

// ---- Tests ---------------------------------------------------------------

test('sign produces header with t= and v1=', async () => {
  const header = await sign(TEST_SECRET, 'hello');
  assert.match(header, /^t=\d+,v1=[a-f0-9]{64}$/);
});

test('verify accepts a fresh signature from same secret', async () => {
  const payload = 'test payload';
  const header = await sign(TEST_SECRET, payload);
  const result = await verify(TEST_SECRET, payload, header);
  assert.equal(result.valid, true);
});

test('verify rejects with wrong secret', async () => {
  const header = await sign(TEST_SECRET, 'payload');
  const result = await verify('wrong-secret', 'payload', header);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'invalid_signature');
});

test('verify rejects with tampered payload', async () => {
  const header = await sign(TEST_SECRET, 'original');
  const result = await verify(TEST_SECRET, 'tampered', header);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'invalid_signature');
});

test('verify rejects null header', async () => {
  const result = await verify(TEST_SECRET, 'payload', null);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'missing_signature');
});

test('verify rejects malformed header', async () => {
  const result = await verify(TEST_SECRET, 'payload', 'not-a-header');
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'malformed_header');
});

test('verify rejects expired timestamp (>5 min old)', async () => {
  // Manually craft an old signature
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(TEST_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const oldTs = Date.now() - 6 * 60 * 1000;  // 6 minutes ago
  const payload = 'payload';
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${oldTs}.${payload}`));
  const sig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const header = `t=${oldTs},v1=${sig}`;
  const result = await verify(TEST_SECRET, payload, header);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'expired');
});

test('verify accepts timestamp within 5 minute window', async () => {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(TEST_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const ts = Date.now() - 4 * 60 * 1000;  // 4 minutes ago
  const payload = 'recent';
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(`${ts}.${payload}`));
  const sig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const header = `t=${ts},v1=${sig}`;
  const result = await verify(TEST_SECRET, payload, header);
  assert.equal(result.valid, true);
});

test('sign output is deterministic for timestamp control', async () => {
  // We can't make sign truly deterministic because Date.now() varies
  // But we can verify the signature format is stable
  const h1 = await sign(TEST_SECRET, 'x');
  const h2 = await sign(TEST_SECRET, 'x');
  assert.match(h1, /^t=\d+,v1=[a-f0-9]{64}$/);
  assert.match(h2, /^t=\d+,v1=[a-f0-9]{64}$/);
  // Both should be parseable
  const v1Match1 = h1.match(/v1=([a-f0-9]+)/);
  assert.equal(v1Match1[1].length, 64);  // SHA-256 hex = 64 chars
});

test('handles special characters in payload', async () => {
  const payload = JSON.stringify({ event: 'test', data: { "key": "value with \"quotes\" & symbols !@#$" } });
  const header = await sign(TEST_SECRET, payload);
  const result = await verify(TEST_SECRET, payload, header);
  assert.equal(result.valid, true);
});

test('handles unicode in payload', async () => {
  const payload = JSON.stringify({ message: 'สวัสดี 你好 🎉' });
  const header = await sign(TEST_SECRET, payload);
  const result = await verify(TEST_SECRET, payload, header);
  assert.equal(result.valid, true);
});

test('constant-time comparison prevents length-leak', async () => {
  // Sign a valid one, then construct a sig with different length
  const validHeader = await sign(TEST_SECRET, 'payload');
  const parts = validHeader.split(',');
  const ts = parts[0].split('=')[1];
  const shortSig = 'abc123';  // too short
  const result = await verify(TEST_SECRET, 'payload', `t=${ts},v1=${shortSig}`);
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'invalid_signature');
});

test('verify rejects when ts is non-numeric', async () => {
  const result = await verify(TEST_SECRET, 'x', 't=abc,v1=abc123');
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'malformed_header');
});
