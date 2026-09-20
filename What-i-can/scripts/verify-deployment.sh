#!/bin/bash
# scripts/verify-deployment.sh
# Quick bash check that all production URLs respond correctly.
# Run from terminal to verify everything is up.
#
# Usage:
#   chmod +x scripts/verify-deployment.sh
#   ./scripts/verify-deployment.sh [subdomain]
#
# Example:
#   ./scripts/verify-deployment.sh itemfound

set -e

SUBDOMAIN="${1:-YOUR-SUBDOMAIN}"
HELPDESK_URL="https://helpdesk-team14.${SUBDOMAIN}.workers.dev"
MOCK_URL="https://wellbeing-mock.${SUBDOMAIN}.workers.dev"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

check() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"

  printf "%-50s " "$name"

  local response=$(curl -s -o /tmp/resp_body -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

  if [ "$response" = "$expected_status" ]; then
    echo -e "${GREEN}✅ ${response}${NC}"
    PASS=$((PASS+1))
  else
    echo -e "${RED}❌ ${response}${NC} (expected ${expected_status})"
    head -c 200 /tmp/resp_body 2>/dev/null
    echo ""
    FAIL=$((FAIL+1))
  fi
}

check_json_field() {
  local name="$1"
  local url="$2"
  local field="$3"
  local expected="$4"

  printf "%-50s " "$name"

  local body=$(curl -s --max-time 10 "$url" 2>/dev/null)
  local actual=$(echo "$body" | grep -o "\"$field\":\"[^\"]*\"" | head -1 | grep -o '[^\"]*$' || echo "missing")

  if [ "$actual" = "$expected" ]; then
    echo -e "${GREEN}✅ $field=$actual${NC}"
    PASS=$((PASS+1))
  else
    echo -e "${RED}❌ $field=$actual (expected $expected)${NC}"
    FAIL=$((FAIL+1))
  fi
}

echo ""
echo "🔍 Verifying deployment (subdomain: $SUBDOMAIN)"
echo ""
echo "─── Helpdesk ───"
check "GET  /healthz"           "$HELPDESK_URL/healthz"
check "GET  /webhooks/wellbeing (expect 401)" "$HELPDESK_URL/webhooks/wellbeing" 401

echo ""
echo "─── Mock ───"
check "GET  /v1/_debug/calls"   "$MOCK_URL/v1/_debug/calls"
check "GET  /v1/_debug/docs"     "$MOCK_URL/v1/_debug/docs"
check "POST /v1/_debug/reset"    "$MOCK_URL/v1/_debug/reset" 200
check "POST /v1/cases (expect 201)" "$MOCK_URL/v1/cases" 201

# Use curl with body for POST test
RESP=$(curl -s -X POST "$MOCK_URL/v1/cases" \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: verify-$(date +%s)" \
  -d "{\"ticket_ref\":\"TKT-VERIFY\",\"urgency\":\"medium\"}" \
  -w "\n%{http_code}")
STATUS=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)
if [ "$STATUS" = "201" ]; then
  CASE_ID=$(echo "$BODY" | grep -o '"case_id":"[^"]*"' | head -1 | cut -d'"' -f4)
  if [ -n "$CASE_ID" ]; then
    echo -e "${GREEN}✅ POST /v1/cases returned case_id=${CASE_ID}${NC}"
    PASS=$((PASS+1))
  fi
fi

echo ""
echo "─── Summary ───"
echo -e "${GREEN}Passed: ${PASS}${NC}"
echo -e "${RED}Failed: ${FAIL}${NC}"

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "💡 Troubleshooting:"
  echo "  - Wait 1-2 min after first deploy (DNS + SSL cert)"
  echo "  - Check subdomain: curl -s https://${SUBDOMAIN}.workers.dev"
  echo "  - See What-i-can/TROUBLESHOOTING.md"
  exit 1
fi

echo ""
echo "🎉 All checks passed — deployment is healthy"
