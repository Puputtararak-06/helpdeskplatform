// scripts/run-tests.cjs
// Auto-run all Postman collection tests programmatically.
// Captures responses to JSON + generates Markdown summary.
//
// Usage:
//   node scripts/run-tests.cjs
//   node scripts/run-tests.cjs --env-file=./scripts/.env.json
//
// env file format: { "wellbeing_url": "https://...", "helpdesk_url": "https://..." }

const fs = require('fs');
const path = require('path');

const COLLECTION_PATH = path.join(__dirname, '..', 'postman', 'A5-collection.json');
const OUT_DIR = path.join(__dirname, '..', 'test-results');

// Parse CLI args
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => a.slice(2).split('=')),
);
const envFile = args['env-file'] || path.join(__dirname, '.env.json');

function loadEnv() {
  // Load from .env.json if exists, else use defaults
  let env = {};
  if (fs.existsSync(envFile)) {
    env = JSON.parse(fs.readFileSync(envFile, 'utf8'));
    console.log(`Loaded env from ${envFile}`);
  } else {
    console.log(`No env file at ${envFile} — using defaults`);
    console.log(`Tip: create ${envFile} with { "wellbeing_url": "...", "helpdesk_url": "..." }`);
  }
  return env;
}

async function main() {
  const collection = JSON.parse(fs.readFileSync(COLLECTION_PATH, 'utf8'));
  const env = loadEnv();

  // Merge collection.vars + env file (env file overrides)
  const vars = {};
  for (const v of collection.variable || []) vars[v.key] = v.value;
  Object.assign(vars, env);

  const substitute = (str) =>
    String(str || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || `{{${k}}}`);

  // Output dir
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const runDir = path.join(OUT_DIR, ts);
  fs.mkdirSync(runDir, { recursive: true });

  console.log(`\n📦 ${collection.info.name}`);
  console.log(`📁 ${runDir}\n`);

  const results = [];
  let passed = 0, failed = 0;

  for (let i = 0; i < collection.item.length; i++) {
    const item = collection.item[i];
    if (!item.request) continue;

    const url = substitute(item.request.url?.raw || item.request.url);
    const method = item.request.method;
    const headers = {};
    for (const h of (item.request.header || [])) {
      if (h.key && h.value !== undefined) headers[h.key] = substitute(h.value);
    }
    const body = item.request.body?.mode === 'raw' ? substitute(item.request.body.raw) : null;

    process.stdout.write(`  ${String(i+1).padStart(2)}. ${item.name.slice(0, 55).padEnd(55)} ... `);
    const start = Date.now();

    try {
      const resp = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json', ...headers } : headers,
        ...(body ? { body } : {}),
      });
      const text = await resp.text();
      const ms = Date.now() - start;

      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }

      const ok = resp.status >= 200 && resp.status < 400;
      const result = {
        sequence: i + 1,
        name: item.name,
        method, url,
        request_headers: headers,
        request_body: body,
        status: resp.status,
        statusText: resp.statusText,
        response_headers: Object.fromEntries(resp.headers),
        response_body: parsed,
        duration_ms: ms,
        ts: new Date().toISOString(),
        passed: ok,
      };
      results.push(result);

      console.log(`${ok ? '✅' : '❌'} ${resp.status} ${resp.statusText} (${ms}ms)`);
      if (ok) passed++; else failed++;
    } catch (e) {
      const ms = Date.now() - start;
      results.push({
        sequence: i + 1,
        name: item.name, method, url,
        request_headers: headers, request_body: body,
        error: e.message,
        duration_ms: ms,
        ts: new Date().toISOString(),
        passed: false,
      });
      console.log(`❌ ${e.message} (${ms}ms)`);
      failed++;
    }
  }

  // Write outputs
  fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, 'latest.json'), JSON.stringify(results, null, 2));

  const summary = generateSummary(results, collection.info.name, passed, failed);
  fs.writeFileSync(path.join(runDir, 'summary.md'), summary);
  fs.writeFileSync(path.join(OUT_DIR, 'latest-summary.md'), summary);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Total: ${results.length} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
  console.log(`Raw:    ${path.join(runDir, 'results.json')}`);
  console.log(`Report: ${path.join(runDir, 'summary.md')}`);
  console.log(`${'='.repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

function generateSummary(results, name, passed, failed) {
  const ts = new Date().toISOString();
  let md = `# Test Summary — ${name}\n\n`;
  md += `**Run:** ${ts}\n`;
  md += `**Total:** ${results.length} | **Passed:** ${passed} | **Failed:** ${failed}\n\n`;

  md += `## Results\n\n`;
  md += `| # | Test | Method | URL | Status | Time |\n`;
  md += `|---|------|--------|-----|--------|------|\n`;
  results.forEach((r) => {
    const urlShort = String(r.url || '').replace(/^https?:\/\/[^/]+/, '');
    md += `| ${r.sequence} | ${r.name} | ${r.method} | \`${urlShort}\` | ${r.passed ? '✅' : '❌'} ${r.status || 'ERR'} | ${r.duration_ms}ms |\n`;
  });

  // Extract for evidence
  md += `\n## Key Responses (paste into evidence)\n\n`;
  const findByName = (substr) => results.find(r => r.name.includes(substr));

  const consumer = findByName('Consumer Proof');
  const provider = findByName('Provider Proof');
  const recvBad = findByName('3a');
  const recvGood = findByName('3b');
  const sender = findByName('Sender');
  const idemFirst = findByName('Idempotency — first');
  const idemReplay = findByName('Idempotency — same call again');
  const degBreak = findByName('6a');
  const degFail = findByName('6b');
  const degHeal = findByName('6c');
  const degRecover = findByName('6d');

  if (consumer) {
    md += `### Consumer Proof (${consumer.status})\n\n`;
    md += `Request:\n\`\`\`http\n${consumer.method} ${consumer.url}\n\`\`\`\n\n`;
    md += `Response:\n\`\`\`json\n${JSON.stringify(consumer.response_body, null, 2)}\n\`\`\`\n\n`;
  }

  if (provider) {
    md += `### Provider Proof (${provider.status})\n\n`;
    md += `Request to mock trigger:\n\`\`\`http\n${provider.method} ${provider.url}\n\`\`\`\n\n`;
    md += `Response:\n\`\`\`json\n${JSON.stringify(provider.response_body, null, 2)}\n\`\`\`\n\n`;
  }

  if (recvBad) {
    md += `### Webhook Receiver — invalid sig (${recvBad.status})\n\n`;
    md += `\`\`\`json\n${JSON.stringify(recvBad.response_body)}\n\`\`\`\n\n`;
  }
  if (recvGood) {
    md += `### Webhook Receiver — valid sig (${recvGood.status})\n\n`;
    md += `\`\`\`json\n${JSON.stringify(recvGood.response_body)}\n\`\`\`\n\n`;
  }

  if (sender) {
    md += `### Webhook Sender (${sender.status})\n\n`;
    md += `\`\`\`json\n${JSON.stringify(sender.response_body, null, 2)}\n\`\`\`\n\n`;
  }

  if (idemFirst && idemReplay) {
    md += `### Idempotency\n\n`;
    md += `**First call (${idemFirst.status}):**\n`;
    md += `\`\`\`json\n${JSON.stringify(idemFirst.response_body, null, 2)}\n\`\`\`\n\n`;
    md += `**Replay call (${idemReplay.status}):** X-Idempotent-Replay = \`${idemReplay.response_headers['x-idempotent-replay'] || 'absent'}\`\n`;
    md += `\`\`\`json\n${JSON.stringify(idemReplay.response_body, null, 2)}\n\`\`\`\n\n`;
  }

  md += `### Degradation\n\n`;
  if (degBreak) md += `- **break (${degBreak.status}):** \`${JSON.stringify(degBreak.response_body)}\`\n`;
  if (degFail) md += `- **call during outage (${degFail.status}):** \`${JSON.stringify(degFail.response_body)}\`\n`;
  if (degHeal) md += `- **heal (${degHeal.status}):** \`${JSON.stringify(degHeal.response_body)}\`\n`;
  if (degRecover) md += `- **recovery call (${degRecover.status}):** \`${JSON.stringify(degRecover.response_body)}\`\n`;

  return md;
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
