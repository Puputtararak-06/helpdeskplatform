#!/bin/bash
# scripts/verify-all.sh
# Run ALL pre-submit checks in sequence. Returns 0 only if all pass.
#
# Use this right before submitting A5.
#
# Usage:
#   chmod +x scripts/verify-all.sh
#   ./scripts/verify-all.sh [subdomain]

set -e

SUBDOMAIN="${1:-YOUR-SUBDOMAIN}"
SCRIPT_DIR="$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

TOTAL_PASS=0
TOTAL_FAIL=0
TOTAL_WARN=0

run_check() {
  local name="$1"
  local cmd="$2"

  echo -e "${CYAN}▶ $name${NC}"
  if eval "$cmd" > /tmp/check_output 2>&1; then
    echo -e "  ${GREEN}✅ PASS${NC}"
    TOTAL_PASS=$((TOTAL_PASS+1))
  else
    echo -e "  ${RED}❌ FAIL${NC}"
    cat /tmp/check_output | head -20 | sed 's/^/    /'
    echo ""
    TOTAL_FAIL=$((TOTAL_FAIL+1))
  fi
}

warn_check() {
  local name="$1"
  local cmd="$2"

  echo -e "${CYAN}▶ $name${NC}"
  if eval "$cmd" > /tmp/check_output 2>&1; then
    echo -e "  ${GREEN}✅ PASS${NC}"
    TOTAL_PASS=$((TOTAL_PASS+1))
  else
    echo -e "  ${YELLOW}⚠️  WARN (non-blocking)${NC}"
    cat /tmp/check_output | head -10 | sed 's/^/    /'
    echo ""
    TOTAL_WARN=$((TOTAL_WARN+1))
  fi
}

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  A5 PRE-SUBMIT VERIFICATION — $(date)"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "─── 1. Unit tests ───"
run_check "HMAC unit tests" "node --test $SCRIPT_DIR/../tests/hmac.test.mjs"
run_check "Validator unit tests" "node --test $SCRIPT_DIR/../tests/validators.test.mjs"

echo ""
echo "─── 2. Crypto + Data ───"
run_check "HMAC sanity check" "node $SCRIPT_DIR/hmac-test.cjs"

# verify-schema needs wrangler which needs D1 access — make it a warning if it fails
warn_check "D1 schema check" "node $SCRIPT_DIR/verify-schema.cjs 2>/dev/null || node $SCRIPT_DIR/verify-schema.cjs"

echo ""
echo "─── 3. URLs ───"
if [ -f "$SCRIPT_DIR/.env.json" ]; then
  run_check "Preflight (env + URLs + HMAC)" "node $SCRIPT_DIR/preflight.cjs"
else
  echo -e "${YELLOW}⚠️  No .env.json found — skipping preflight. Create from .env.example.${NC}"
  TOTAL_WARN=$((TOTAL_WARN+1))
fi

warn_check "Deployment URLs respond" "bash $SCRIPT_DIR/verify-deployment.sh $SUBDOMAIN"

echo ""
echo "─── 4. Integration tests ───"
if [ -f "$SCRIPT_DIR/.env.json" ]; then
  run_check "Run all integration tests" "node $SCRIPT_DIR/run-tests.cjs"
  run_check "Collect evidence" "node $SCRIPT_DIR/collect-evidence.cjs"
else
  echo -e "${YELLOW}⚠️  No .env.json — skipping integration tests. Create from .env.example.${NC}"
  TOTAL_WARN=$((TOTAL_WARN+1))
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "  RESULTS: ${GREEN}${TOTAL_PASS} passed${NC} | ${RED}${TOTAL_FAIL} failed${NC} | ${YELLOW}${TOTAL_WARN} warnings${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""

if [ $TOTAL_FAIL -gt 0 ]; then
  echo -e "${RED}❌ Some checks failed. Fix before submitting.${NC}"
  echo ""
  echo "Common fixes:"
  echo "  - Run scripts/hmac-test.cjs to see what's wrong with crypto"
  echo "  - Run scripts/verify-schema.cjs if schema check failed"
  echo "  - Re-apply migration: wrangler d1 execute helpdesk-db --remote --file=What-i-can/migrations/0005_wellbeing_fields.sql"
  echo "  - Check URL in scripts/.env.json"
  echo "  - See What-i-can/TROUBLESHOOTING.md"
  exit 1
elif [ $TOTAL_WARN -gt 0 ]; then
  echo -e "${YELLOW}⚠️  Some non-critical warnings. Review before submitting.${NC}"
  exit 0
else
  echo -e "${GREEN}🎉 All checks passed. Ready to submit A5.${NC}"
  exit 0
fi
