#!/bin/bash
# scripts/ts-check.sh
# TypeScript syntax/basic check for What-i-can code without full build.
# Run before commit to catch obvious errors.
#
# Usage:
#   chmod +x scripts/ts-check.sh
#   ./scripts/ts-check.sh

set -e

echo "🔍 TypeScript syntax check (What-i-can/src + scripts)"
echo ""

ERRORS=0
CHECKED=0

for f in What-i-can/src/lib/*.ts What-i-can/src/routes/*.ts What-i-can/src/workers/*.ts What-i-can/src/types/*.ts; do
  if [ ! -f "$f" ]; then continue; fi
  CHECKED=$((CHECKED+1))

  # Try tsc on the file (will give errors if types broken)
  output=$(node What-i-can/../node_modules/typescript/bin/tsc --noEmit --target ES2022 --module ES2022 --moduleResolution Bundler --strict --skipLibCheck --types "" "$f" 2>&1 | grep -v "^$" | head -20 || true)

  if [ -z "$output" ]; then
    echo "  ✅ $f"
  else
    # Only show as error if it has actual errors (not just warnings)
    if echo "$output" | grep -qE "error TS"; then
      echo "  ❌ $f"
      echo "$output" | sed 's/^/      /'
      echo ""
      ERRORS=$((ERRORS+1))
    else
      echo "  ⚠️  $f (warnings only)"
      echo "$output" | sed 's/^/      /' | head -3
      echo ""
    fi
  fi
done

echo ""
echo "Checked: $CHECKED files"
echo "Errors:  $ERRORS"

if [ $ERRORS -gt 0 ]; then
  echo ""
  echo "💡 Tips:"
  echo "  - Check imports (use correct relative paths)"
  echo "  - Verify TypeScript types match runtime usage"
  echo "  - Run full project build: cd ../.. && npx tsc --noEmit"
  exit 1
fi

echo ""
echo "🎉 All TypeScript files have valid syntax + types"
