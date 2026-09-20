// src/types/events.ts
// Shared TypeScript types for Helpdesk ↔ Wellbeing integration.
// Use these to validate payloads and prevent contract drift.
//
// If Team 16 sends a different shape, update this file + notify them.

/**
 * All webhook event types we support (or plan to).
 * Add new types here AND update processEvent() in routes/webhooks.ts.
 */
export type EventType =
  | 'wellbeing.case.opened'
  | 'wellbeing.case.updated'
  | 'wellbeing.case.closed';

/**
 * Status values used in `status` fields.
 * Mirrors the CHECK constraint on `tickets.wellbeing_status` column.
 */
export type CaseStatus =
  | 'open'
  | 'in_progress'
  | 'closed'
  | 'referred'           // escalated to specialist
  | 'pending_sync';      // waiting for partner to recover

export type Urgency = 'low' | 'medium' | 'high';

/**
 * Standard webhook payload envelope.
 * Both sides must:
 *   - Send identical body bytes for HMAC signing
 *   - Use unique `idempotency_key` per event
 *   - Include `timestamp` in ISO 8601 UTC
 */
export interface WebhookPayload {
  event: EventType;
  data: CaseData;
  timestamp: string;       // ISO 8601 UTC, e.g. "2026-09-22T10:30:15.000Z"
  idempotency_key: string; // unique per event, used for replay protection
}

export interface CaseData {
  case_id: string;                 // Wellbeing's case ID (e.g. "wb-12345")
  ticket_ref?: string;             // Helpdesk ticket reference
  mood_score?: number;             // 1-5, lower = worse
  urgency?: Urgency;
  status?: CaseStatus;
  notes?: string;
  last_updated?: string;           // ISO 8601
}

/**
 * Consumer API: Helpdesk creates a case in Wellbeing.
 * POST /v1/cases
 */
export interface CreateCaseRequest {
  ticket_ref: string;   // required: Helpdesk ticket ID
  urgency: Urgency;
}

export interface CreateCaseResponse {
  case_id: string;
  status: CaseStatus;
  urgency: Urgency;
  ticket_ref: string | null;
  created_at: string;
}

/**
 * HMAC signature header format: `t=<unix_ms>,v1=<hex_sig>`
 * Both sender and receiver use this exact format.
 */
export interface SignatureHeader {
  t: number;       // unix milliseconds
  v1: string;      // hex signature of `${t}.${rawBody}`
}

/**
 * Standard API error envelope.
 * All errors return this shape so clients can parse uniformly.
 */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

/**
 * Internal: a row in webhook_events table.
 * Maps to the schema created by migrations/0005_wellbeing_fields.sql.
 */
export interface WebhookEventRow {
  id: number;
  event_key: string;
  event_type: EventType;
  payload: string;            // raw JSON string
  source: string;             // 'wellbeing' | etc.
  received_at: string;
  processed_at: string | null;
}

/**
 * Internal: a row in webhook_outbox table.
 */
export interface WebhookOutboxRow {
  id: number;
  idempotency_key: string;
  ticket_id: string | null;
  destination: string;        // 'wellbeing'
  endpoint: string;           // '/v1/cases', '/v1/cases/:id', etc.
  payload: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  created_at: string;
  sent_at: string | null;
}

// ---- Example payloads (for docs/tests) -----------------------------

export const EXAMPLE_OPENED_PAYLOAD: WebhookPayload = {
  event: 'wellbeing.case.opened',
  data: {
    case_id: 'wb-1695371415000-abc12',
    ticket_ref: 'TKT-001',
    mood_score: 3,
    urgency: 'medium',
  },
  timestamp: '2026-09-22T10:30:15.000Z',
  idempotency_key: 'evt-1695371415000-xyz',
};

export const EXAMPLE_UPDATED_PAYLOAD: WebhookPayload = {
  event: 'wellbeing.case.updated',
  data: {
    case_id: 'wb-1695371415000-abc12',
    ticket_ref: 'TKT-001',
    status: 'in_progress',
  },
  timestamp: '2026-09-22T11:00:00.000Z',
  idempotency_key: 'evt-1695372600000-abc',
};

export const EXAMPLE_CLOSED_PAYLOAD: WebhookPayload = {
  event: 'wellbeing.case.closed',
  data: {
    case_id: 'wb-1695371415000-abc12',
    ticket_ref: 'TKT-001',
  },
  timestamp: '2026-09-22T14:30:00.000Z',
  idempotency_key: 'evt-1695385800000-def',
};

// ---- Type guards (runtime validation helpers) ----------------------

export function isWebhookPayload(x: unknown): x is WebhookPayload {
  if (!x || typeof x !== 'object') return false;
  const p = x as Record<string, unknown>;
  return (
    typeof p.event === 'string' &&
    ['wellbeing.case.opened', 'wellbeing.case.updated', 'wellbeing.case.closed'].includes(p.event) &&
    typeof p.idempotency_key === 'string' &&
    typeof p.timestamp === 'string' &&
    typeof p.data === 'object' && p.data !== null
  );
}
