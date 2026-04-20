#!/usr/bin/env bash
#
# End-to-End Test Suite for Blaze CLI
# Tests all CLI commands against a real API endpoint
#
# Usage:
#   ./test-cli-e2e.sh                          # Read-only tests (safe)
#   ./test-cli-e2e.sh --with-writes            # Include create/update/delete tests
#   ./test-cli-e2e.sh --api-key <key>          # Override API key
#   ./test-cli-e2e.sh --base-url <url>         # Override API base URL
#
# Environment:
#   BLAZE_TEST_API_KEY  - API key (required unless --api-key is provided)
#   BLAZE_TEST_BASE_URL - Base URL override (optional)
#
# Requirements:
#   - Node.js 18+ installed
#   - CLI built (yarn build) — looks for dist/cli/index.js
#   - jq for JSON validation (optional but recommended)

set -euo pipefail

# ---------------------------------------------------------------------------
# Colors and formatting
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ---------------------------------------------------------------------------
# Test counters
# ---------------------------------------------------------------------------
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
CLI_BIN="./dist/cli/index.js"
API_KEY=""
API_BASE_URL=""
WITH_WRITES=false
VERBOSE=false
DRY_RUN=false

# IDs captured during write tests for cleanup
CREATED_CUSTOMER_ID=""
CREATED_WEBHOOK_ID=""
CREATED_PAYLINK_ID=""

# ---------------------------------------------------------------------------
# Parse command line arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --api-key)
      API_KEY="$2"
      shift 2
      ;;
    --base-url)
      API_BASE_URL="$2"
      shift 2
      ;;
    --with-writes)
      WITH_WRITES=true
      shift
      ;;
    --verbose)
      VERBOSE=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --help)
      echo "Usage: $0 [OPTIONS]"
      echo ""
      echo "Options:"
      echo "  --api-key KEY       API key (or set BLAZE_TEST_API_KEY env var)"
      echo "  --base-url URL      API base URL override"
      echo "  --with-writes       Enable create/update/delete tests (not just read-only)"
      echo "  --verbose           Show full command output"
      echo "  --dry-run           Print commands without executing"
      echo "  --help              Show this help"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Resolve API key: flag > BLAZE_TEST_API_KEY > BLAZE_API_KEY
# ---------------------------------------------------------------------------
if [[ -z "$API_KEY" ]]; then
  API_KEY="${BLAZE_TEST_API_KEY:-${BLAZE_API_KEY:-}}"
fi

if [[ -z "$API_KEY" ]]; then
  echo -e "${RED}Error: API key not provided${NC}"
  echo "Set BLAZE_TEST_API_KEY environment variable or use --api-key flag"
  exit 1
fi

# ---------------------------------------------------------------------------
# Logging helpers
# ---------------------------------------------------------------------------
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[PASS]${NC} $1"
  ((TESTS_PASSED++)) || true
}

log_error() {
  echo -e "${RED}[FAIL]${NC} $1"
  ((TESTS_FAILED++)) || true
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_skip() {
  echo -e "${YELLOW}[SKIP]${NC} $1"
  ((TESTS_SKIPPED++)) || true
}

log_section() {
  echo ""
  echo -e "${CYAN}${BOLD}=== $1 ===${NC}"
}

# ---------------------------------------------------------------------------
# Run a CLI command and capture output + exit code
#
# Usage:
#   output=$(run_cli "balance" 0)
#   output=$(run_cli "nonexistent" 1)
#
# Global flags (--api-key, --base-url, --format) are injected automatically.
# The second argument is the expected exit code (default 0).
# ---------------------------------------------------------------------------
run_cli() {
  local args="$1"
  local expected_exit_code="${2:-0}"
  local format="${3:-}"  # optional format override

  # Build the full command with global flags
  local global_flags="--api-key $API_KEY"
  if [[ -n "$API_BASE_URL" ]]; then
    global_flags="$global_flags --base-url $API_BASE_URL"
  fi
  if [[ -n "$format" ]]; then
    global_flags="$global_flags --format $format"
  fi

  local full_cmd="node $CLI_BIN $global_flags $args"

  if [[ "$VERBOSE" == true ]]; then
    echo -e "${BLUE}[INFO]${NC} Running: $full_cmd" >&2
  fi

  if [[ "$DRY_RUN" == true ]]; then
    echo "[dry-run] $full_cmd"
    return 0
  fi

  local output
  local exit_code

  local stderr_file
  stderr_file=$(mktemp)

  set +e
  output=$(eval "$full_cmd" 2>"$stderr_file")
  exit_code=$?
  set -e

  local stderr_output
  # Filter out zsh compdef warnings from stderr
  stderr_output=$(grep -v "^compdef:" "$stderr_file" 2>/dev/null || true)
  rm -f "$stderr_file"

  if [[ "$VERBOSE" == true ]]; then
    [[ -n "$stderr_output" ]] && echo "[stderr] $stderr_output" >&2
    echo "$output" >&2
  fi

  if [[ $exit_code -ne $expected_exit_code ]]; then
    log_error "Exit code $exit_code (expected $expected_exit_code) for: $full_cmd"
    if [[ "$VERBOSE" == false ]]; then
      echo "  Output: $output" >&2
      [[ -n "$stderr_output" ]] && echo "  Stderr: $stderr_output" >&2
    fi
    return 0
  fi

  # For error-expected tests (non-zero exit), include stderr in output
  # so assertions can match against error messages
  if [[ $expected_exit_code -ne 0 && -n "$stderr_output" ]]; then
    output="$output"$'\n'"$stderr_output"
  fi

  echo "$output"
  return 0
}

# ---------------------------------------------------------------------------
# Assertion helpers
# ---------------------------------------------------------------------------
assert_contains() {
  local output="$1"
  local expected="$2"
  local description="$3"

  if echo "$output" | grep -q "$expected"; then
    log_success "$description"
    return 0
  else
    log_error "$description -- expected to contain: $expected"
    return 0
  fi
}

assert_not_contains() {
  local output="$1"
  local unexpected="$2"
  local description="$3"

  if echo "$output" | grep -q "$unexpected"; then
    log_error "$description -- unexpectedly found: $unexpected"
    return 0
  else
    log_success "$description"
    return 0
  fi
}

assert_json_valid() {
  local output="$1"
  local description="$2"

  if command -v jq &> /dev/null; then
    if echo "$output" | jq . &> /dev/null; then
      log_success "$description"
      return 0
    else
      log_error "$description -- invalid JSON output"
      return 0
    fi
  else
    # Fall back: check it starts with [ or {
    if echo "$output" | grep -qE '^\s*[\[\{]'; then
      log_success "$description (jq not installed, basic check)"
      return 0
    else
      log_error "$description -- does not look like JSON"
      return 0
    fi
  fi
}

assert_exit_zero() {
  local description="$1"
  # Called after run_cli which already checked exit code
  log_success "$description"
}

# Extract a field from JSON using jq (returns empty string if jq unavailable)
json_field() {
  local json="$1"
  local field="$2"
  if command -v jq &> /dev/null; then
    echo "$json" | jq -r "$field" 2>/dev/null || echo ""
  else
    echo ""
  fi
}

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------
preflight_check() {
  log_info "Running pre-flight checks..."

  # Check CLI binary
  if [[ ! -f "$CLI_BIN" ]]; then
    echo -e "${RED}CLI not built. Run 'yarn build' first.${NC}"
    echo "  Expected: $CLI_BIN"
    exit 1
  fi

  # Check Node.js version
  local node_version
  node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
  if [[ $node_version -lt 18 ]]; then
    echo -e "${RED}Node.js 18+ required (found: $(node --version))${NC}"
    exit 1
  fi
  log_success "Node.js $(node --version) detected"

  # Check jq availability
  if command -v jq &> /dev/null; then
    log_success "jq available for JSON validation"
  else
    log_warn "jq not installed -- JSON validation will use basic checks"
  fi

  log_info "API key: ${API_KEY:0:8}****${API_KEY: -4}"
  if [[ -n "$API_BASE_URL" ]]; then
    log_info "Base URL: $API_BASE_URL"
  else
    log_info "Base URL: (default -- https://api.blaze.money)"
  fi
  log_info "Write tests: $WITH_WRITES"
  echo ""
}

# ===========================================================================
# TEST SUITES
# ===========================================================================

# ---------------------------------------------------------------------------
# Help and version
# ---------------------------------------------------------------------------
test_help_and_version() {
  log_section "Help & Version"

  local output

  # --help
  output=$(run_cli "--help") || true
  assert_contains "$output" "blaze" "help: displays program name"
  assert_contains "$output" "balance" "help: lists balance command"
  assert_contains "$output" "customers" "help: lists customers command"
  assert_contains "$output" "transfers" "help: lists transfers command"

  # --version
  output=$(run_cli "--version") || true
  assert_contains "$output" "0\." "version: returns a version number"
}

# ---------------------------------------------------------------------------
# Auth commands
# ---------------------------------------------------------------------------
test_auth_commands() {
  log_section "Auth Commands"

  local output

  # auth whoami
  output=$(run_cli "auth whoami") || true
  assert_contains "$output" "API key:" "auth whoami: shows masked API key"
  assert_contains "$output" "Environment:" "auth whoami: shows environment"
}

# ---------------------------------------------------------------------------
# Balance
# ---------------------------------------------------------------------------
test_balance() {
  log_section "Balance"

  local output

  # JSON format (default)
  output=$(run_cli "balance") || true
  assert_json_valid "$output" "balance: returns valid JSON"

  # Table format
  output=$(run_cli "balance" 0 "table") || true
  assert_contains "$output" "│\|─\|┌\|└" "balance --format table: renders table characters"
}

# ---------------------------------------------------------------------------
# Customers
# ---------------------------------------------------------------------------
test_customers_read() {
  log_section "Customers (read-only)"

  local output

  # customers list
  output=$(run_cli "customers list --limit 3") || true
  assert_json_valid "$output" "customers list: returns valid JSON"

  # customers list with table format
  output=$(run_cli "customers list --limit 3" 0 "table") || true
  # Table output or "No results." are both valid
  if echo "$output" | grep -q "No results\.\|│\|─"; then
    log_success "customers list --format table: renders table or empty message"
  else
    log_error "customers list --format table: unexpected output"
  fi
}

test_customers_write() {
  log_section "Customers (write)"

  local output

  # Create a customer
  output=$(run_cli "customers create --email e2e-test-$(date +%s)@example.com --first-name E2ETest --last-name User") || true
  assert_json_valid "$output" "customers create: returns valid JSON"
  CREATED_CUSTOMER_ID=$(json_field "$output" ".id")
  if [[ -n "$CREATED_CUSTOMER_ID" && "$CREATED_CUSTOMER_ID" != "null" ]]; then
    log_success "customers create: captured customer ID $CREATED_CUSTOMER_ID"
  else
    log_warn "customers create: could not extract customer ID for subsequent tests"
  fi

  # Update the customer (if we got an ID)
  if [[ -n "$CREATED_CUSTOMER_ID" && "$CREATED_CUSTOMER_ID" != "null" ]]; then
    output=$(run_cli "customers update $CREATED_CUSTOMER_ID --last-name UpdatedUser") || true
    assert_json_valid "$output" "customers update: returns valid JSON"

    # Get the customer
    output=$(run_cli "customers get $CREATED_CUSTOMER_ID") || true
    assert_json_valid "$output" "customers get: returns valid JSON"
    assert_contains "$output" "UpdatedUser" "customers get: reflects updated last name"

    # Archive the customer (cleanup)
    output=$(run_cli "customers archive $CREATED_CUSTOMER_ID") || true
    assert_contains "$output" "archived" "customers archive: confirms archival"
    CREATED_CUSTOMER_ID=""  # cleaned up
  fi
}

# ---------------------------------------------------------------------------
# Transfers
# ---------------------------------------------------------------------------
test_transfers_read() {
  log_section "Transfers (read-only)"

  local output

  # transfers list
  output=$(run_cli "transfers list --limit 5") || true
  assert_json_valid "$output" "transfers list: returns valid JSON"

  # transfers list with status filter
  output=$(run_cli "transfers list --status completed --limit 3") || true
  assert_json_valid "$output" "transfers list --status: returns valid JSON"
}

# ---------------------------------------------------------------------------
# Withdrawals
# ---------------------------------------------------------------------------
test_withdrawals_read() {
  log_section "Withdrawals (read-only)"

  local output

  # withdrawals list
  output=$(run_cli "withdrawals list --limit 5") || true
  assert_json_valid "$output" "withdrawals list: returns valid JSON"
}

# ---------------------------------------------------------------------------
# Payment Links
# ---------------------------------------------------------------------------
test_paylinks_read() {
  log_section "Payment Links (read-only)"

  local output

  # paylinks list
  output=$(run_cli "paylinks list --limit 5") || true
  assert_json_valid "$output" "paylinks list: returns valid JSON"
}

test_paylinks_write() {
  log_section "Payment Links (write)"

  local output

  # Create a payment link
  output=$(run_cli "paylinks create --amount 1.00 --currency USD --name E2E-Test-Link") || true
  assert_json_valid "$output" "paylinks create: returns valid JSON"
  CREATED_PAYLINK_ID=$(json_field "$output" ".id")
  if [[ -n "$CREATED_PAYLINK_ID" && "$CREATED_PAYLINK_ID" != "null" ]]; then
    log_success "paylinks create: captured paylink ID $CREATED_PAYLINK_ID"
  else
    log_warn "paylinks create: could not extract paylink ID"
  fi

  if [[ -n "$CREATED_PAYLINK_ID" && "$CREATED_PAYLINK_ID" != "null" ]]; then
    # Update the paylink
    output=$(run_cli "paylinks update $CREATED_PAYLINK_ID --name E2E-Updated-Link") || true
    assert_json_valid "$output" "paylinks update: returns valid JSON"

    # Get the paylink
    output=$(run_cli "paylinks get $CREATED_PAYLINK_ID") || true
    assert_json_valid "$output" "paylinks get: returns valid JSON"
    assert_contains "$output" "E2E-Updated-Link" "paylinks get: reflects updated name"

    # Cancel the paylink (cleanup)
    output=$(run_cli "paylinks cancel $CREATED_PAYLINK_ID") || true
    assert_contains "$output" "cancelled" "paylinks cancel: confirms cancellation"
    CREATED_PAYLINK_ID=""  # cleaned up
  fi
}

# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------
test_transactions_read() {
  log_section "Transactions (read-only)"

  local output

  # transactions list
  output=$(run_cli "transactions list --limit 5") || true
  assert_json_valid "$output" "transactions list: returns valid JSON"

  # transactions list with filters
  output=$(run_cli "transactions list --status completed --limit 3") || true
  assert_json_valid "$output" "transactions list --status: returns valid JSON"

  # transactions list with type filter
  output=$(run_cli "transactions list --type transfer --limit 3") || true
  assert_json_valid "$output" "transactions list --type: returns valid JSON"

  # Table format
  output=$(run_cli "transactions list --limit 3" 0 "table") || true
  if echo "$output" | grep -q "No results\.\|│\|─"; then
    log_success "transactions list --format table: renders table or empty"
  else
    log_error "transactions list --format table: unexpected output"
  fi
}

# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------
test_api_keys_read() {
  log_section "API Keys (read-only)"

  local output

  # api-keys list
  output=$(run_cli "api-keys list") || true
  assert_json_valid "$output" "api-keys list: returns valid JSON"
}

test_api_keys_write() {
  log_section "API Keys (write)"

  local output

  # Create an API key
  output=$(run_cli "api-keys create --name e2e-test-key --scopes read,write --test") || true
  # The output includes both the console.log line and the JSON
  assert_contains "$output" "API Key" "api-keys create: shows API key message"

  # We skip revoke since the created key is test-mode and we
  # don't have a reliable way to extract the ID from mixed output
  log_skip "api-keys revoke: skipped (would require parsing mixed output)"
}

# ---------------------------------------------------------------------------
# Team
# ---------------------------------------------------------------------------
test_team_read() {
  log_section "Team (read-only)"

  local output

  # team list
  output=$(run_cli "team list") || true
  assert_json_valid "$output" "team list: returns valid JSON"

  # team invitations
  output=$(run_cli "team invitations") || true
  assert_json_valid "$output" "team invitations: returns valid JSON"
}

# ---------------------------------------------------------------------------
# Webhooks
# ---------------------------------------------------------------------------
test_webhooks_read() {
  log_section "Webhooks (read-only)"

  local output

  # webhooks list
  output=$(run_cli "webhooks list --limit 5") || true
  assert_json_valid "$output" "webhooks list: returns valid JSON"
}

test_webhooks_write() {
  log_section "Webhooks (write)"

  local output

  # Create a webhook
  output=$(run_cli "webhooks create --url https://example.com/e2e-test-webhook --events payment.completed,transfer.completed --description E2E-Test") || true
  # Output includes signing secret line + JSON
  assert_contains "$output" "Signing Secret\|secret" "webhooks create: shows signing secret"
  # Try to extract ID from the JSON portion
  local json_portion
  json_portion=$(echo "$output" | grep -A9999 '{' | head -50)
  CREATED_WEBHOOK_ID=$(json_field "$json_portion" ".id")
  if [[ -n "$CREATED_WEBHOOK_ID" && "$CREATED_WEBHOOK_ID" != "null" ]]; then
    log_success "webhooks create: captured webhook ID $CREATED_WEBHOOK_ID"
  else
    log_warn "webhooks create: could not extract webhook ID"
  fi

  if [[ -n "$CREATED_WEBHOOK_ID" && "$CREATED_WEBHOOK_ID" != "null" ]]; then
    # Get the webhook
    output=$(run_cli "webhooks get $CREATED_WEBHOOK_ID") || true
    assert_json_valid "$output" "webhooks get: returns valid JSON"
    assert_contains "$output" "e2e-test-webhook" "webhooks get: contains expected URL"

    # Update the webhook
    output=$(run_cli "webhooks update $CREATED_WEBHOOK_ID --description E2E-Updated") || true
    assert_json_valid "$output" "webhooks update: returns valid JSON"

    # Delete the webhook (cleanup, -y to skip interactive prompt)
    output=$(run_cli "webhooks delete $CREATED_WEBHOOK_ID -y") || true
    assert_contains "$output" "deleted" "webhooks delete: confirms deletion"
    CREATED_WEBHOOK_ID=""  # cleaned up
  fi
}

# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------
test_analytics_read() {
  log_section "Analytics (read-only)"

  local output

  # analytics overview (default period)
  output=$(run_cli "analytics overview") || true
  assert_json_valid "$output" "analytics overview: returns valid JSON"

  # analytics overview with period
  output=$(run_cli "analytics overview --period LAST_30_DAYS") || true
  assert_json_valid "$output" "analytics overview --period LAST_30_DAYS: returns valid JSON"
}

# ---------------------------------------------------------------------------
# Disputes
# ---------------------------------------------------------------------------
test_disputes_read() {
  log_section "Disputes (read-only)"

  local output

  # disputes list
  output=$(run_cli "disputes list --limit 5") || true
  assert_json_valid "$output" "disputes list: returns valid JSON"

  # disputes list with status filter
  output=$(run_cli "disputes list --status open --limit 3") || true
  assert_json_valid "$output" "disputes list --status: returns valid JSON"
}

# ---------------------------------------------------------------------------
# Invoices
# ---------------------------------------------------------------------------
test_invoices_read() {
  log_section "Invoices (read-only)"

  local output

  # invoices list
  output=$(run_cli "invoices list --limit 5") || true
  assert_json_valid "$output" "invoices list: returns valid JSON"

  # invoices list with status filter
  output=$(run_cli "invoices list --status draft --limit 3") || true
  assert_json_valid "$output" "invoices list --status: returns valid JSON"
}

# ---------------------------------------------------------------------------
# Subscriptions
# ---------------------------------------------------------------------------
test_subscriptions_read() {
  log_section "Subscriptions (read-only)"

  local output

  # subscriptions list
  output=$(run_cli "subscriptions list --limit 5") || true
  assert_json_valid "$output" "subscriptions list: returns valid JSON"

  # subscriptions list with status filter
  output=$(run_cli "subscriptions list --status active --limit 3") || true
  assert_json_valid "$output" "subscriptions list --status: returns valid JSON"
}

# ---------------------------------------------------------------------------
# FX
# ---------------------------------------------------------------------------
test_fx_read() {
  log_section "FX (read-only)"

  local output

  # fx rates (default base)
  output=$(run_cli "fx rates") || true
  assert_json_valid "$output" "fx rates: returns valid JSON"

  # fx rates with base currency
  output=$(run_cli "fx rates --base USD") || true
  assert_json_valid "$output" "fx rates --base USD: returns valid JSON"

  # fx quote
  output=$(run_cli "fx quote --from USD --to MXN --amount 100") || true
  assert_json_valid "$output" "fx quote: returns valid JSON"
}

# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------
test_error_handling() {
  log_section "Error Handling"

  local output

  # Unknown command (Commander prints help to stderr and exits non-zero)
  output=$(run_cli "nonexistent-command" 1) || true
  assert_contains "$output" "unknown command\|error\|Usage" "unknown command: shows error or usage"

  # Missing required argument for transfers create
  output=$(run_cli "transfers create" 1) || true
  assert_contains "$output" "required\|missing\|error" "missing required arg: shows error"

  # Missing required argument for fx quote (--from, --to, --amount)
  output=$(run_cli "fx quote" 1) || true
  assert_contains "$output" "required\|missing\|error" "fx quote missing args: shows error"

  # Bad API key
  local save_key="$API_KEY"
  API_KEY="sk_test_invalid_key_12345"
  output=$(run_cli "balance" 1) || true
  assert_contains "$output" "Error\|error\|401\|Unauthorized\|unauthorized\|invalid\|denied" "invalid API key: returns auth error"
  API_KEY="$save_key"
}

# ---------------------------------------------------------------------------
# Output format tests
# ---------------------------------------------------------------------------
test_output_formats() {
  log_section "Output Formats"

  local output

  # JSON is default -- balance is a simple endpoint
  output=$(run_cli "balance" 0 "json") || true
  assert_json_valid "$output" "balance --format json: valid JSON"

  # Table format
  output=$(run_cli "balance" 0 "table") || true
  # Table output uses cli-table3 with box-drawing characters
  if echo "$output" | grep -q "│\|─\|┌\|└"; then
    log_success "balance --format table: contains table characters"
  else
    # Single-object table might not have all characters, just check it is not JSON
    if echo "$output" | grep -qE '^\s*\{'; then
      log_error "balance --format table: got JSON instead of table"
    else
      log_success "balance --format table: non-JSON output (likely table)"
    fi
  fi

  # Verify JSON list format
  output=$(run_cli "transactions list --limit 2" 0 "json") || true
  assert_json_valid "$output" "transactions list --format json: valid JSON"
}

# ===========================================================================
# Cleanup -- best-effort removal of any resources created during write tests
# ===========================================================================
cleanup() {
  if [[ "$WITH_WRITES" != true ]]; then
    return
  fi

  log_section "Cleanup"

  if [[ -n "$CREATED_CUSTOMER_ID" && "$CREATED_CUSTOMER_ID" != "null" ]]; then
    log_info "Archiving leftover customer $CREATED_CUSTOMER_ID..."
    run_cli "customers archive $CREATED_CUSTOMER_ID" 0 &>/dev/null || true
  fi

  if [[ -n "$CREATED_WEBHOOK_ID" && "$CREATED_WEBHOOK_ID" != "null" ]]; then
    log_info "Deleting leftover webhook $CREATED_WEBHOOK_ID..."
    run_cli "webhooks delete $CREATED_WEBHOOK_ID -y" 0 &>/dev/null || true
  fi

  if [[ -n "$CREATED_PAYLINK_ID" && "$CREATED_PAYLINK_ID" != "null" ]]; then
    log_info "Cancelling leftover paylink $CREATED_PAYLINK_ID..."
    run_cli "paylinks cancel $CREATED_PAYLINK_ID" 0 &>/dev/null || true
  fi

  log_info "Cleanup complete"
}

# Register cleanup on exit
trap cleanup EXIT

# ===========================================================================
# Main
# ===========================================================================
main() {
  echo ""
  echo "======================================================================"
  echo "              Blaze CLI -- End-to-End Test Suite"
  echo "======================================================================"
  echo ""

  if [[ "$DRY_RUN" == false ]]; then
    preflight_check
  else
    log_info "Dry-run mode: commands will be printed, not executed"
    echo ""
  fi

  # ---- Read-only tests (always run) ----
  test_help_and_version || true
  test_auth_commands || true
  test_balance || true
  test_customers_read || true
  test_transfers_read || true
  test_withdrawals_read || true
  test_paylinks_read || true
  test_transactions_read || true
  test_api_keys_read || true
  test_team_read || true
  test_webhooks_read || true
  test_analytics_read || true
  test_disputes_read || true
  test_invoices_read || true
  test_subscriptions_read || true
  test_fx_read || true
  test_error_handling || true
  test_output_formats || true

  # ---- Write tests (only with --with-writes) ----
  if [[ "$WITH_WRITES" == true ]]; then
    test_customers_write || true
    test_paylinks_write || true
    test_webhooks_write || true
    test_api_keys_write || true
  else
    echo ""
    log_info "Skipping write tests. Pass --with-writes to enable."
  fi

  # ---- Summary ----
  echo ""
  echo "======================================================================"
  echo "                         Test Summary"
  echo "======================================================================"
  echo ""
  echo -e "  ${GREEN}Passed:${NC}  $TESTS_PASSED"
  echo -e "  ${RED}Failed:${NC}  $TESTS_FAILED"
  echo -e "  ${YELLOW}Skipped:${NC} $TESTS_SKIPPED"
  echo -e "  Total:   $((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))"
  echo ""

  if [[ $TESTS_FAILED -gt 0 ]]; then
    echo -e "${RED}${BOLD}Some tests failed.${NC}"
    exit 1
  else
    echo -e "${GREEN}${BOLD}All tests passed.${NC}"
    exit 0
  fi
}

main
