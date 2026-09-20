# Makefile — convenience commands for What-i-can
# Run from this directory: cd What-i-can && make <target>
# Or specify path: make -C What-i-can <target>

# --- Setup ---
.env:
	@test -f scripts/.env.json || cp .env.example scripts/.env.json
	@echo "Created scripts/.env.json from .env.example — edit with your URLs"
	@exit 1

.PHONY: install
install:
	@echo "Run from project root: npm install"

# --- Tests ---
.PHONY: test
test: test-unit

.PHONY: test-unit
test-unit:
	@echo "Running unit tests..."
	@node --test tests/

.PHONY: test-hmac
test-hmac:
	@node scripts/hmac-test.cjs

.PHONY: test-all
test-all: test-unit test-hmac
	@echo "All tests passed"

# --- Verification ---
.PHONY: preflight
preflight: .env
	@node scripts/preflight.cjs

.PHONY: verify-schema
verify-schema:
	@node scripts/verify-schema.cjs

.PHONY: verify-deployment
verify-deployment:
	@bash scripts/verify-deployment.sh $(SUBDOMAIN)

# --- Integration tests ---
.PHONY: run-tests
run-tests: .env
	@node scripts/run-tests.cjs

.PHONY: collect-evidence
collect-evidence: run-tests
	@node scripts/collect-evidence.cjs

# --- Inspection (debug) ---
.PHONY: inspect-mock
inspect-mock: .env
	@node scripts/inspect-mock.cjs

.PHONY: inspect-mock-tail
inspect-mock-tail: .env
	@node scripts/inspect-mock.cjs --tail

.PHONY: inspect-queue
inspect-queue:
	@node scripts/inspect-queue.cjs

.PHONY: logs
logs:
	@wrangler tail helpdesk-team14 --format=pretty

.PHONY: mock-logs
mock-logs:
	@cd mocks && wrangler tail wellbeing-mock --format=pretty

# --- Setup ---
.PHONY: start-dev
start-dev:
	@powershell -ExecutionPolicy Bypass -File scripts/start-dev.ps1

.PHONY: cleanup
cleanup:
	@node scripts/cleanup.cjs --include-mock

.PHONY: load-test
load-test: .env
	@node scripts/load-test.cjs --concurrency=20 --total=100

# --- Deploy ---
.PHONY: deploy-mock
deploy-mock:
	@cd mocks && wrangler deploy

.PHONY: deploy-helpdesk
deploy-helpdesk:
	@cd ../.. && wrangler deploy

.PHONY: migrate
migrate:
	@cd ../.. && wrangler d1 execute helpdesk-db --remote --file=What-i-can/migrations/0005_wellbeing_fields.sql

.PHONY: migrate-local
migrate-local:
	@cd ../.. && wrangler d1 execute helpdesk-db --local --file=What-i-can/migrations/0005_wellbeing_fields.sql

# --- Backup ---
.PHONY: backup
backup:
	@bash scripts/backup-db.sh

# --- CI helpers ---
.PHONY: ci
ci: test-unit test-hmac verify-schema
	@echo "CI checks passed"

.PHONY: help
help:
	@echo "Common targets:"
	@echo "  make preflight        - validate env + URLs + HMAC"
	@echo "  make run-tests        - run all 12 integration tests"
	@echo "  make collect-evidence - auto-fill evidence doc"
	@echo "  make cleanup          - reset test data"
	@echo "  make inspect-mock     - show mock state"
	@echo "  make logs             - tail Helpdesk logs"
	@echo "  make deploy-mock      - deploy mock to Cloudflare"
	@echo "  make migrate          - apply DB migration to remote"
	@echo ""
	@echo "  make help             - show this help"

.DEFAULT_GOAL := help
