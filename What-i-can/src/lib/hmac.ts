// src/lib/hmac.ts
// HMAC-SHA256 signing and verification for webhook auth.
// Pure TypeScript — uses Web Crypto (available in Cloudflare Workers + Node 18+).

export interface VerifyResult {
  valid: boolean;
  reason?: 'missing_signature' | 'malformed_header' | 'expired' | 'invalid_signature';
}

/**
 * Sign a payload with shared secret.
 * Returns header value: `t=<unix_ms>,v1=<hex_sig>`
 *
 * Usage:
 *   const header = await sign(secret, rawBody);
 *   fetch(url, { headers: { 'X-Signature': header }, body: rawBody });
 */
export async function sign(secret: string, payload: string): Promise<string> {
  const timestamp = Date.now();
  const sig = await computeHmac(secret, `${timestamp}.${payload}`);
  return `t=${timestamp},v1=${sig}`;
}

/**
 * Verify incoming webhook.
 * Returns: { valid: true } or { valid: false, reason }
 */
export async function verify(
  secret: string,
  payload: string,
  header: string | null,
  toleranceMs = 5 * 60 * 1000, // 5 minutes default
): Promise<VerifyResult> {
  if (!header) return { valid: false, reason: 'missing_signature' };

  const parts: Record<string, string> = {};
  for (const p of header.split(',')) {
    const [k, v] = p.trim().split('=');
    if (k && v) parts[k] = v;
  }

  const ts = Number(parts.t);
  const sig = parts.v1;
  if (!ts || !sig || Number.isNaN(ts)) return { valid: false, reason: 'malformed_header' };

  // Replay protection
  const age = Date.now() - ts;
  if (age > toleranceMs) return { valid: false, reason: 'expired' };

  const expected = await computeHmac(secret, `${ts}.${payload}`);
  if (!constantTimeEqual(sig, expected)) return { valid: false, reason: 'invalid_signature' };

  return { valid: true };
}

// ---- Internal helpers ----

async function computeHmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sigBuf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
