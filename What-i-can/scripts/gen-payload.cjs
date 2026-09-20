// scripts/gen-payload.cjs
// Generate sample webhook payloads for testing.
// Use when you need a custom payload to test edge cases.
//
// Usage:
//   node scripts/gen-payload.cjs --event=wellbeing.case.opened --ticket-ref=TKT-999 --case-id=wb-test
//   # outputs to stdout
//   # pipe to webhook sender:
//   node scripts/gen-payload.cjs | xargs -I {} curl ...
//   # or save to file:
//   node scripts/gen-payload.cjs --output=payload.json

const args = Object.fromEntries(
  process.argv.slice(2).filter(a => a.startsWith('--')).map(a => a.slice(2).split('=')),
);

const event = args.event || 'wellbeing.case.opened';
const ticketRef = args['ticket-ref'] || `TKT-${Math.floor(Math.random() * 10000)}`;
const caseId = args['case-id'] || `wb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const urgency = args.urgency || 'medium';
const moodScore = args['mood-score'] ? Number(args['mood-score']) : undefined;
const idempotencyKey = args['idempotency-key'] || `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const includeSecrets = args['include-secrets'] === 'true';

const payload = {
  event,
  data: {
    case_id: caseId,
    ticket_ref: ticketRef,
    urgency,
    ...(moodScore !== undefined ? { mood_score: moodScore } : {}),
  },
  timestamp: new Date().toISOString(),
  idempotency_key: idempotencyKey,
};

const output = JSON.stringify(payload, null, 2);

if (args.output) {
  const fs = require('fs');
  fs.writeFileSync(args.output, output);
  console.log(`✅ Wrote: ${args.output}`);
  console.log(`   event:           ${event}`);
  console.log(`   ticket_ref:      ${ticketRef}`);
  console.log(`   case_id:         ${caseId}`);
  console.log(`   idempotency_key: ${idempotencyKey}`);
} else {
  console.log(output);
}

// Also output curl-ready command for convenience
if (args['emit-curl']) {
  const url = args.url || 'http://localhost:8787/webhooks/wellbeing';
  const secret = args.secret || 'mock-wellbeing-secret-change-me-when-real-team16-ready';
  console.error('\n# Curl command:');
  console.error(`curl -X POST ${url} \\`);
  console.error(`  -H "Content-Type: application/json" \\`);
  console.error(`  -H "X-Signature: <sign this body with secret>" \\`);
  console.error(`  -d '${JSON.stringify(payload)}'`);
}
