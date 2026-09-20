# Tests

Unit tests สำหรับ code ที่ไม่ต้อง deploy

## Run all tests

```bash
# All tests in this folder
node --test What-i-can/tests/

# Specific test file
node --test What-i-can/tests/hmac.test.mjs
node --test What-i-can/tests/validators.test.mjs

# With verbose output
node --test What-i-can/tests/ --test-reporter=spec
```

## Test files

| File | Tests | What it covers |
|---|---|---|
| `hmac.test.mjs` | 12 | HMAC sign/verify edge cases (wrong secret, expired, tampering, unicode, etc.) |
| `validators.test.mjs` | 20+ | Validator functions (item_name, category, status, student_id, location_found) |

## CI

GitHub Actions runs these on every push:

```yaml
# .github/workflows/test.yml
- run: node What-i-can/tests/hmac.test.mjs
```

(Won't run validator tests in CI yet — they need TypeScript compilation. Local run only.)

## Adding new tests

Use Node's built-in test runner (no extra deps):

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('description of what is tested', async () => {
  const result = myFunction(input);
  assert.equal(result, expected);
});
```

See Node docs: https://nodejs.org/api/test.html

## What these tests DON'T cover

Integration tests (with real D1, real network) need:
- Deployed worker
- Mock running
- Real cloudflare account

Use `What-i-can/scripts/run-tests.cjs` for that.
