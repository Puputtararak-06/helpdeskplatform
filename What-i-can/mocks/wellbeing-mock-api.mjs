// mocks/wellbeing-mock-api.mjs
// Stand-in for Team 16 (Wellbeing) API.
// Use until Team 16 delivers their real contract.
//
// Features:
//   - Real-ish REST endpoints (POST/GET/PATCH /v1/cases)
//   - List endpoint with filters
//   - Referral + notes endpoints
//   - Webhook sender (POST /internal/trigger-webhook → posts to Helpdesk)
//   - Idempotency: same X-Idempotency-Key → same response
//   - Debug: /v1/_debug/calls, /reset, /break, /heal, /docs
//
// Env required:
//   WELLBEING_MOCK_SECRET — shared secret (matches Helpdesk)
//   HELPDESK_WEBHOOK_URL  — Helpdesk POST /webhooks/wellbeing URL

const callLog = [];
const idempotencyMap = new Map();
const casesStore = new Map();  // case_id → case object
let degradedMode = false;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Idempotency-Key, X-Signature, X-Request-Timestamp',
  'Content-Type': 'application/json',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const json = (data, status = 200, extraHeaders = {}) =>
      new Response(JSON.stringify(data), { status, headers: { ...CORS, ...extraHeaders } });

    // ---- Debug endpoints -------------------------------------------------
    if (path === '/v1/_debug/calls' && method === 'GET') {
      return json({ calls: callLog, degraded: degradedMode, count: callLog.length });
    }
    if (path === '/v1/_debug/reset' && method === 'POST') {
      callLog.length = 0;
      idempotencyMap.clear();
      casesStore.clear();
      degradedMode = false;
      return json({ ok: true, message: 'reset complete' });
    }
    if (path === '/v1/_debug/break' && method === 'POST') {
      degradedMode = true;
      log({ method: 'DEBUG', path, ts: new Date().toISOString(), note: 'degraded mode ON' });
      return json({ ok: true, mode: 'degraded' });
    }
    if (path === '/v1/_debug/heal' && method === 'POST') {
      degradedMode = false;
      log({ method: 'DEBUG', path, ts: new Date().toISOString(), note: 'degraded mode OFF' });
      return json({ ok: true, mode: 'healed' });
    }
    // Self-documenting endpoint — for debugging
    if (path === '/v1/_debug/docs' && method === 'GET') {
      return json({
        service: 'wellbeing-mock',
        version: '1.0.0',
        endpoints: [
          { method: 'POST', path: '/v1/cases', desc: 'Create a case' },
          { method: 'GET',  path: '/v1/cases', desc: 'List cases (filter by status, ticket_ref, urgency)' },
          { method: 'GET',  path: '/v1/cases/:id', desc: 'Read one case' },
          { method: 'PATCH',path: '/v1/cases/:id', desc: 'Update case' },
          { method: 'POST', path: '/v1/cases/:id/notes', desc: 'Add note to case' },
          { method: 'POST', path: '/v1/cases/:id/refer', desc: 'Refer case to specialist' },
          { method: 'GET',  path: '/v1/_debug/calls', desc: 'View call log' },
          { method: 'POST', path: '/v1/_debug/reset', desc: 'Clear state' },
          { method: 'POST', path: '/v1/_debug/break', desc: 'Simulate 500 errors' },
          { method: 'POST', path: '/v1/_debug/heal', desc: 'Recover from degraded' },
          { method: 'GET',  path: '/v1/_debug/docs', desc: 'This endpoint' },
          { method: 'POST', path: '/internal/trigger-webhook', desc: 'Send webhook to Helpdesk' },
        ],
        auth: 'HMAC-SHA256 header X-Signature: t=<ms>,v1=<hex>',
        idempotency: 'X-Idempotency-Key on POST /v1/cases',
      });
    }

    // Degradation gate (applies to all real endpoints)
    if (degradedMode) {
      log({ method, path, ts: new Date().toISOString(), result: 'degraded' });
      return json({ error: { code: 'DEGRADED', message: 'partner unavailable' } }, 500);
    }

    // ---- Real-ish API endpoints -----------------------------------------

    // GET /v1/cases — list with filters
    if (path === '/v1/cases' && method === 'GET') {
      const status = url.searchParams.get('status');
      const ticketRef = url.searchParams.get('ticket_ref');
      const urgency = url.searchParams.get('urgency');
      const limit = Math.min(Number(url.searchParams.get('limit') || 50), 100);
      const offset = Number(url.searchParams.get('offset') || 0);

      let results = Array.from(casesStore.values());
      if (status) results = results.filter(c => c.status === status);
      if (ticketRef) results = results.filter(c => c.ticket_ref === ticketRef);
      if (urgency) results = results.filter(c => c.urgency === urgency);

      const total = results.length;
      const paged = results.slice(offset, offset + limit);

      log({ method, path, filters: { status, ticketRef, urgency }, total, returned: paged.length, ts: new Date().toISOString() });
      return json({
        data: paged,
        meta: { total, limit, offset, returned: paged.length },
      });
    }

    // POST /v1/cases
    if (path === '/v1/cases' && method === 'POST') {
      const body = await safeJson(request);
      const idempKey = request.headers.get('X-Idempotency-Key');
      const sigHeader = request.headers.get('X-Signature');

      if (idempKey && idempotencyMap.has(idempKey)) {
        const cached = idempotencyMap.get(idempKey);
        log({ method, path, idempKey, ts: new Date().toISOString(), result: 'replay' });
        return json(cached, 200, { 'X-Idempotent-Replay': 'true' });
      }

      // Validate required fields
      if (!body.ticket_ref) {
        log({ method, path, ts: new Date().toISOString(), result: 'validation_error', field: 'ticket_ref' });
        return json({ error: { code: 'VALIDATION_ERROR', message: 'required', details: { field: 'ticket_ref' } } }, 400);
      }
      if (!['low', 'medium', 'high'].includes(body.urgency)) {
        log({ method, path, ts: new Date().toISOString(), result: 'validation_error', field: 'urgency' });
        return json({ error: { code: 'VALIDATION_ERROR', message: 'must be one of low, medium, high', details: { field: 'urgency' } } }, 400);
      }

      const caseId = `wb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const response = {
        case_id: caseId,
        status: 'open',
        urgency: body.urgency,
        ticket_ref: body.ticket_ref || null,
        notes: body.notes || null,
        mood_score: body.mood_score || null,
        created_at: new Date().toISOString(),
        last_updated: new Date().toISOString(),
      };

      casesStore.set(caseId, response);
      if (idempKey) idempotencyMap.set(idempKey, response);
      log({ method, path, idempKey, hasSignature: !!sigHeader, ts: new Date().toISOString(), result: 'created', case_id: caseId });

      return json(response, 201);
    }

    // Routes with :id pattern
    const caseMatch = path.match(/^\/v1\/cases\/([^/]+)$/);
    const noteMatch = path.match(/^\/v1\/cases\/([^/]+)\/notes$/);
    const referMatch = path.match(/^\/v1\/cases\/([^/]+)\/refer$/);

    // POST /v1/cases/:id/notes
    if (noteMatch && method === 'POST') {
      const caseId = noteMatch[1];
      const body = await safeJson(request);
      const c = casesStore.get(caseId);
      if (!c) {
        log({ method, path, ts: new Date().toISOString(), result: 'not_found' });
        return json({ error: { code: 'NOT_FOUND', message: 'case not found' } }, 404);
      }
      const note = { text: body.text || '', added_by: body.added_by || 'unknown', added_at: new Date().toISOString() };
      c.notes = c.notes ? `${c.notes}\n---\n${note.text}` : note.text;
      c.last_updated = note.added_at;
      casesStore.set(caseId, c);
      log({ method, path, case_id: caseId, ts: new Date().toISOString(), result: 'note_added' });
      return json({ ok: true, case_id: caseId, note });
    }

    // POST /v1/cases/:id/refer
    if (referMatch && method === 'POST') {
      const caseId = referMatch[1];
      const body = await safeJson(request);
      const c = casesStore.get(caseId);
      if (!c) {
        return json({ error: { code: 'NOT_FOUND', message: 'case not found' } }, 404);
      }
      c.status = 'referred';
      c.referred_to = body.specialist || 'general_counselor';
      c.last_updated = new Date().toISOString();
      casesStore.set(caseId, c);
      log({ method, path, case_id: caseId, ts: new Date().toISOString(), result: 'referred' });
      return json({ ok: true, case_id: caseId, status: 'referred', referred_to: c.referred_to });
    }

    // GET /v1/cases/:id
    if (caseMatch && method === 'GET') {
      const caseId = caseMatch[1];
      const c = casesStore.get(caseId);
      log({ method, path, ts: new Date().toISOString(), result: c ? 'found' : 'not_found' });
      if (!c) {
        return json({ error: { code: 'NOT_FOUND', message: `no case with id=${caseId}` } }, 404);
      }
      return json(c);
    }

    // PATCH /v1/cases/:id
    if (caseMatch && method === 'PATCH') {
      const caseId = caseMatch[1];
      const body = await safeJson(request);
      const c = casesStore.get(caseId);
      if (!c) {
        return json({ error: { code: 'NOT_FOUND', message: 'case not found' } }, 404);
      }
      if (body.status !== undefined) c.status = body.status;
      if (body.urgency !== undefined) c.urgency = body.urgency;
      if (body.notes !== undefined) c.notes = body.notes;
      c.last_updated = new Date().toISOString();
      casesStore.set(caseId, c);
      log({ method, path, case_id: caseId, request: body, ts: new Date().toISOString(), result: 'updated' });
      return json(c);
    }

    // POST /internal/trigger-webhook — mock sends webhook to Helpdesk
    if (path === '/internal/trigger-webhook' && method === 'POST') {
      const body = await safeJson(request);
      const helpdeskUrl = env.HELPDESK_WEBHOOK_URL;
      if (!helpdeskUrl) {
        return json({ error: 'HELPDESK_WEBHOOK_URL not configured' }, 500);
      }

      const payload = JSON.stringify({
        event: body.event || 'wellbeing.case.opened',
        data: body.data || { case_id: 'wb-mock-default', mood_score: 3 },
        timestamp: new Date().toISOString(),
        idempotency_key: body.idempotency_key || `evt-mock-${Date.now()}`,
      });

      // Sign with shared secret
      const enc = new TextEncoder();
      const secret = env.WELLBEING_MOCK_SECRET || 'mock-wellbeing-secret-change-me-when-real-team16-ready';
      const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false, ['sign'],
      );
      const timestamp = Date.now();
      const messageToSign = `${timestamp}.${payload}`;
      const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(messageToSign));
      const sigHex = Array.from(new Uint8Array(sigBuf))
        .map(b => b.toString(16).padStart(2, '0')).join('');

      let respStatus = 0;
      let respBody = '';
      try {
        const resp = await fetch(helpdeskUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Signature': `t=${timestamp},v1=${sigHex}`,
          },
          body: payload,
        });
        respStatus = resp.status;
        respBody = await resp.text();
      } catch (e) {
        respBody = `fetch failed: ${e.message}`;
      }

      log({
        method: 'WEBHOOK_SENT',
        path,
        destination: helpdeskUrl,
        payload: JSON.parse(payload),
        response: { status: respStatus, body: respBody.slice(0, 200) },
        ts: new Date().toISOString(),
      });

      return json({
        ok: respStatus >= 200 && respStatus < 300,
        helpdesk_status: respStatus,
        helpdesk_response: respBody.slice(0, 200),
      });
    }

    // 404 fallback
    log({ method, path, ts: new Date().toISOString(), result: 'not_found' });
    return json({ error: 'not found', path, method }, 404);
  },
};

function log(entry) {
  callLog.push(entry);
  if (callLog.length > 500) callLog.shift();
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
