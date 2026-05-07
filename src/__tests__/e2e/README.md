# Blaze CLI Agent E2E Tests

This directory contains end-to-end tests for the Blaze CLI agent mode implementation.

## Test Files

### agent-memory.e2e.test.ts
Tests the agent's memory persistence system:
- Recurring payment patterns (save, retrieve, fuzzy matching)
- Payment history logging (max 20 entries)
- Contact aliases
- Markdown serialization/parsing
- File system persistence across instances

**Requirements:** None (tests use isolated temp directory)

### agent-tools.e2e.test.ts
Tests the agent's tool system against the staging API:
- Tool schema generation
- Memory tool execution (read_memory, save_pattern, log_payment)
- Balance tools (get_balance, get_business_balance)
- Customer tools (create, list, get)
- FX tools (fx_rates, fx_quote)
- Payment link tools (create, list)
- Transaction tools (list with filters)
- Error handling and input validation

**Requirements:**
- `BLAZE_TEST_API_KEY` (staging API key)
- `BLAZE_TEST_BASE_URL` (optional, defaults to production URL)

### agent-llm.e2e.test.ts
Tests the LLM-based agent with real Claude API calls:
- Basic tool calling (balance, FX rates, FX quotes)
- Customer management via natural language
- Payment link creation via natural language
- Memory integration
- Multi-turn conversations
- Error handling
- Transaction queries
- Safety and confirmation behaviors
- Natural language understanding variations

**Requirements:**
- `ANTHROPIC_API_KEY` (Claude API key)
- `BLAZE_TEST_API_KEY` (staging API key)
- `BLAZE_TEST_BASE_URL` (optional)

**Note:** Tests are automatically skipped if `ANTHROPIC_API_KEY` is not set.

### agent-evals.e2e.test.ts
Evaluates the agent's reasoning quality and behavior:
- Ambiguous input handling (missing amounts, recipients)
- Tool selection accuracy (choosing correct tools for queries)
- Hallucination prevention (not making up data)
- Error recovery (API failures, suggestions)
- Safety guardrails (large amounts, balance checks)
- Context understanding (terminology variations)
- Memory usage accuracy
- Response quality (clarity, formatting, verbosity)
- Cross-border payment understanding
- System prompt instruction following

**Requirements:**
- `ANTHROPIC_API_KEY` (Claude API key)
- `BLAZE_TEST_API_KEY` (staging API key)

**Note:** Tests are automatically skipped if `ANTHROPIC_API_KEY` is not set.

## Running Tests

### Run All E2E Tests
```bash
cd blaze-cli
yarn test:e2e
```

### Run Specific Test File
```bash
cd blaze-cli
yarn test:e2e agent-memory.e2e.test.ts
yarn test:e2e agent-tools.e2e.test.ts
yarn test:e2e agent-llm.e2e.test.ts
yarn test:e2e agent-evals.e2e.test.ts
```

### Run Tests Without LLM (No Anthropic API Key Required)
```bash
cd blaze-cli
yarn test:e2e agent-memory.e2e.test.ts
yarn test:e2e agent-tools.e2e.test.ts
```

### Run in Watch Mode (for development)
```bash
cd blaze-cli
yarn test:e2e --watch agent-memory.e2e.test.ts
```

## Environment Setup

### Required Environment Variables

**For agent-tools tests:**
```bash
export BLAZE_TEST_API_KEY="sk_test_..."
export BLAZE_TEST_BASE_URL="https://api-staging.blaze.money"  # Optional
```

**For agent-llm and agent-evals tests:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export BLAZE_TEST_API_KEY="sk_test_..."
export BLAZE_TEST_BASE_URL="https://api-staging.blaze.money"  # Optional
```

### Getting API Keys

**Blaze Test API Key:**
1. Log into Blaze staging environment
2. Navigate to Business Settings → API Keys
3. Create a new test API key with appropriate scopes

**Anthropic API Key:**
1. Sign up at https://console.anthropic.com/
2. Navigate to API Keys
3. Create a new API key
4. Note: LLM tests will incur API costs (approximately $0.10-0.50 per full test run)

## Test Configuration

Tests are configured via `jest.e2e.config.ts`:
- **Test timeout:** 30 seconds per test (some LLM tests may take longer)
- **Max workers:** 1 (serial execution to avoid API rate limits)
- **Bail on first failure:** Yes (to save API calls)
- **Test environment:** Node.js

## Resource Cleanup

All tests use the `TestContext` class from `setup.ts` which automatically tracks and cleans up created resources:
- Customers (archived via `archiveCustomer`)
- Payment links (cancelled via `cancelPaymentLink`)
- External accounts (deleted via `deleteExternalAccount`)
- Webhooks (deleted via `deleteWebhook`)

Cleanup runs in `afterAll` hooks for each test suite.

## Test Patterns

### Memory Tests (agent-memory)
- Use isolated temp directories per test run
- No API calls required
- Fast execution (< 1 second per test)
- Test markdown serialization and parsing

### Tool Tests (agent-tools)
- Use real staging API
- Track and cleanup all created resources
- Small amounts ($0.01) for transfers
- Verify tool schemas and execution

### LLM Tests (agent-llm)
- Use real Claude API (incurs cost)
- Capture stdout to verify agent responses
- Test natural language understanding
- Verify correct tool calling behavior

### Eval Tests (agent-evals)
- Focus on reasoning quality, not just functionality
- Test edge cases and error scenarios
- Verify hallucination prevention
- Test safety guardrails
- Measure response quality

## Known Limitations

1. **Multi-turn conversations:** Current implementation treats each `runAgent` call as independent. True multi-turn context would require modifying `runAgent` to accept previous message history.

2. **Confirmation flows:** Agent doesn't have interactive confirmation prompts built in yet. Tests verify the agent asks for confirmation in responses, but don't test actual user confirmation handling.

3. **LLM test flakiness:** LLM responses can vary between runs. Tests use pattern matching (regex) rather than exact string matching to handle this.

4. **API rate limits:** Running all LLM tests in rapid succession may hit Anthropic rate limits. Tests run serially (maxWorkers: 1) to minimize this.

5. **Memory isolation:** Each test file uses a separate temp directory for memory to avoid interference, but tests within a file share memory state.

## Cost Considerations

**LLM Tests (agent-llm.e2e.test.ts + agent-evals.e2e.test.ts):**
- Approximately 30-40 API calls per full run
- ~100-200k input tokens, ~10-20k output tokens
- Estimated cost: $0.20-0.80 per full run (using Claude Sonnet)
- Recommended: Set `BLAZE_AGENT_MODEL=claude-haiku-4` for cheaper testing

**Staging API Tests (agent-tools.e2e.test.ts):**
- Creates and archives test customers
- Creates and cancels test payment links
- No real money movement (uses $0.01 test amounts)
- No cost considerations

## Debugging

### Enable Verbose Logging
```bash
# Jest verbose output (enabled by default in jest.e2e.config.ts)
cd blaze-cli
yarn test:e2e --verbose

# Enable Claude API debug logs
export ANTHROPIC_LOG=debug
yarn test:e2e agent-llm.e2e.test.ts
```

### Run Single Test
```bash
cd blaze-cli
yarn test:e2e -t "calls blaze_get_balance tool for balance query"
```

### Inspect Memory State
```bash
# After running tests, memory is in temp directory
# Path is printed in test output: /tmp/blaze-test-{type}-{timestamp}
cat /tmp/blaze-test-llm-*/. blaze/agent-memory.md
```

### Check API Responses
```bash
# Set DEBUG environment variable for SDK debug logs
export DEBUG=blaze:*
yarn test:e2e agent-tools.e2e.test.ts
```

## CI Integration

These tests can be integrated into CI with:
```yaml
- name: Run Agent E2E Tests
  env:
    BLAZE_TEST_API_KEY: ${{ secrets.BLAZE_TEST_API_KEY }}
    BLAZE_TEST_BASE_URL: https://api-staging.blaze.money
    ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  run: |
    cd blaze-cli
    yarn test:e2e
```

**Recommendation:** Only run LLM tests on main branch merges to save costs. Memory and tool tests can run on every PR.

## Contributing

When adding new agent capabilities:
1. Add tool schema tests to `agent-tools.e2e.test.ts`
2. Add LLM integration tests to `agent-llm.e2e.test.ts`
3. Add reasoning quality evals to `agent-evals.e2e.test.ts`
4. Update this README with new requirements

## Related Documentation

- **Implementation Plan:** `docs/projects/blaze-cli/implementation-plan-v2.md`
- **Agent Implementation:** `blaze-cli/src/agent/`
- **SDK Client:** `blaze-cli/src/sdk/client.ts`
- **Test Setup:** `blaze-cli/src/__tests__/e2e/setup.ts`
