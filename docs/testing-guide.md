# Blaze CLI Testing Guide

This guide explains how to test the Blaze CLI, SDK, and MCP server at different levels.

## Table of Contents

- [Overview](#overview)
- [Test Levels](#test-levels)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [CI/CD Integration](#cicd-integration)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Blaze CLI testing strategy follows the testing pyramid:

```
         /\
        /  \  E2E Tests (Shell scripts + real API)
       /____\
      /      \  Integration Tests (Jest + real API)
     /________\
    /          \  Unit Tests (Jest + mocks)
   /____________\
```

- **Unit Tests**: Fast, isolated tests of individual functions/classes
- **Integration Tests**: Test SDK methods against real staging API
- **E2E Tests**: Test CLI commands end-to-end via shell script

---

## Test Levels

### 1. Unit Tests

**Purpose**: Test individual functions and classes in isolation

**Location**: `src/**/__tests__/*.test.ts`

**What they test**:
- Argument parsing and validation
- Output formatting (JSON, table, CSV)
- Error handling logic
- Type guards and validators
- Utility functions

**Characteristics**:
- Fast (<10ms per test)
- No external dependencies
- Use mocks for API calls
- High code coverage (>85% target)

**Example**:
```typescript
// src/cli/__tests__/formatters.test.ts
describe("formatters", () => {
  test("formatJSON should stringify objects correctly", () => {
    const data = { id: "123", name: "Test" }
    expect(formatJSON(data)).toBe(JSON.stringify(data, null, 2))
  })

  test("formatTable should create table from array", () => {
    const data = [{ name: "Alice", age: 30 }]
    const table = formatTable(data)
    expect(table).toContain("Alice")
    expect(table).toContain("30")
  })
})
```

### 2. Integration Tests

**Purpose**: Test SDK methods against real Blaze API

**Location**: `src/__tests__/integration/*.integration.test.ts`

**What they test**:
- SDK client methods (users, transactions, fx, etc.)
- API authentication and authorization
- Response parsing and error handling
- Pagination and filtering
- Rate limiting behavior

**Characteristics**:
- Slower (~100-500ms per test)
- Requires valid API key
- Makes real HTTP requests to staging
- Tests may be rate-limited
- Runs sequentially (`maxWorkers: 1`)

**Setup Requirements**:
```bash
# Required environment variables
export BLAZE_API_KEY="your-staging-api-key"
export BLAZE_API_BASE_URL="https://blaze-spark-staging.fly.dev"
```

**Example**:
```typescript
// src/__tests__/integration/sdk.integration.test.ts
describe("BlazeClient Integration Tests", () => {
  let client: BlazeClient

  beforeAll(() => {
    client = new BlazeClient({
      apiKey: process.env.BLAZE_API_KEY!,
      baseUrl: process.env.BLAZE_API_BASE_URL,
    })
  })

  test("should fetch current user", async () => {
    const user = await client.users.me()
    expect(user.id).toBeDefined()
    expect(user.email).toBeDefined()
  })
})
```

### 3. E2E Tests

**Purpose**: Test complete CLI workflows from shell

**Location**: `test-cli-e2e.sh`

**What they test**:
- CLI command execution
- Help text and version info
- Error messages and exit codes
- Output format validation
- API connectivity
- Authentication failures

**Characteristics**:
- Slowest (~10-30s total)
- Tests full user experience
- Uses shell script + curl
- Validates actual command output
- Can test against staging or production

**Setup Requirements**:
```bash
# Build CLI first
yarn build

# Run E2E tests
./test-cli-e2e.sh --env staging --api-key YOUR_KEY
```

---

## Running Tests

### Local Development

**Run all unit tests**:
```bash
yarn test
```

**Run unit tests with coverage**:
```bash
yarn test:coverage
```

**Run unit tests in watch mode**:
```bash
yarn test --watch
```

**Run integration tests** (requires API key):
```bash
export BLAZE_API_KEY="your-staging-api-key"
yarn test:integration
```

**Run E2E tests** (requires API key and build):
```bash
yarn build
export BLAZE_API_KEY="your-staging-api-key"
./test-cli-e2e.sh --env staging --api-key "$BLAZE_API_KEY"
```

**Run specific test file**:
```bash
yarn test src/sdk/__tests__/client.test.ts
```

**Run tests matching pattern**:
```bash
yarn test --testNamePattern="should fetch user"
```

### CI/CD

Tests run automatically in GitHub Actions on:
- Pull requests that modify `blaze-cli/**`
- Pushes to `main` branch
- Manual workflow dispatch

**View test results**:
- Go to GitHub Actions tab
- Find "Blaze CLI - Test & Quality" workflow
- Check individual job logs for details

**Coverage reports**:
- Uploaded as artifacts in GitHub Actions
- Can download and view locally

---

## Writing Tests

### Unit Test Guidelines

**File naming**:
- Place tests adjacent to source: `src/module/__tests__/file.test.ts`
- Or group by feature: `src/__tests__/unit/feature.test.ts`

**Test structure** (AAA pattern):
```typescript
describe("Feature Name", () => {
  test("should do something specific", () => {
    // Arrange: Set up test data
    const input = { foo: "bar" }

    // Act: Execute the code under test
    const result = myFunction(input)

    // Assert: Verify the result
    expect(result).toBe(expected)
  })
})
```

**Best practices**:
- One assertion per test (when possible)
- Descriptive test names ("should X when Y")
- Use `beforeEach` for common setup
- Clean up resources in `afterEach`
- Mock external dependencies
- Test edge cases and errors

**Example - Testing error handling**:
```typescript
describe("validateApiKey", () => {
  test("should throw error for empty key", () => {
    expect(() => validateApiKey("")).toThrow("API key cannot be empty")
  })

  test("should throw error for invalid format", () => {
    expect(() => validateApiKey("invalid")).toThrow("Invalid API key format")
  })

  test("should accept valid key", () => {
    expect(() => validateApiKey("sk_live_abc123")).not.toThrow()
  })
})
```

### Integration Test Guidelines

**Setup**:
```typescript
describe("Feature Integration Tests", () => {
  let client: BlazeClient

  beforeAll(() => {
    // Create client once for all tests
    client = new BlazeClient({
      apiKey: process.env.BLAZE_API_KEY!,
      baseUrl: process.env.BLAZE_API_BASE_URL,
    })
  })

  test("should handle real API interaction", async () => {
    const result = await client.someMethod()
    expect(result).toBeDefined()
  })
})
```

**Best practices**:
- Minimize API calls (they're slow and may be rate-limited)
- Use staging environment, never production
- Handle cases where test data might not exist
- Test both success and error paths
- Be aware of rate limits
- Use `beforeAll` instead of `beforeEach` when possible

**Example - Handling missing data**:
```typescript
test("should get transaction by id", async () => {
  // First get a transaction ID from the list
  const listResult = await client.transactions.list({ limit: 1 })

  if (listResult.data.length > 0) {
    const txId = listResult.data[0].id
    const transaction = await client.transactions.get(txId)
    expect(transaction.id).toBe(txId)
  } else {
    // No transactions available, skip the test
    console.warn("No transactions available for testing")
  }
})
```

### E2E Test Guidelines

**Adding new E2E tests** (edit `test-cli-e2e.sh`):

```bash
test_new_feature() {
  log_info "=== Testing New Feature ==="

  local output

  # Test command execution
  output=$(run_cli "new-command --arg value")
  assert_contains "$output" "expected text" "Command output is correct"
  assert_json_valid "$output" "Command returns valid JSON"

  echo ""
}

# Add to main() function
main() {
  # ... existing tests ...
  test_new_feature
  # ... rest of tests ...
}
```

**Best practices**:
- Test happy path first
- Test error cases separately
- Use descriptive assertion messages
- Group related tests in functions
- Keep tests independent
- Clean up any created resources

---

## CI/CD Integration

### GitHub Actions Workflow

**File**: `.github/workflows/blaze-cli-test.yml`

**Jobs**:
1. **check-changes**: Detect if blaze-cli directory changed
2. **lint**: ESLint and TypeScript type checking
3. **unit-tests**: Jest unit tests with coverage
4. **integration-tests**: SDK integration tests vs staging
5. **e2e-tests**: Shell script E2E tests
6. **build-check**: Verify builds on Node 18, 20, 22
7. **security-audit**: Check for vulnerabilities
8. **package-check**: Validate package.json and npm pack
9. **test-summary**: Post results as PR comment

### Required Secrets

Add to GitHub repository settings:

- `BLAZE_STAGING_API_KEY`: Valid API key for staging environment

### Coverage Enforcement

**Target**: 80% overall coverage for unit tests

**Enforcement**:
- CI job fails if coverage drops below threshold
- Coverage report uploaded as artifact
- Can be viewed in GitHub Actions

**Local check**:
```bash
yarn test:coverage

# Manual threshold check
node -e "
  const summary = require('./coverage/coverage-summary.json');
  const total = summary.total;
  const avg = Math.round((
    total.lines.pct +
    total.statements.pct +
    total.functions.pct +
    total.branches.pct
  ) / 4);
  console.log('Coverage:', avg + '%');
  process.exit(avg < 80 ? 1 : 0);
"
```

### Matrix Testing

**Node versions tested**: 18, 20, 22

Ensures compatibility across supported Node.js versions.

---

## Troubleshooting

### Common Issues

#### "BLAZE_API_KEY is required"

**Problem**: Integration/E2E tests can't find API key

**Solution**:
```bash
export BLAZE_API_KEY="your-api-key"
# Or pass directly to test script
./test-cli-e2e.sh --api-key "your-api-key"
```

#### "401 Unauthorized" errors in tests

**Problem**: API key is invalid or expired

**Solution**:
- Verify API key is correct
- Check if key has necessary permissions
- Regenerate key if needed from Blaze dashboard

#### Rate limit errors during integration tests

**Problem**: Too many API calls in short time

**Solution**:
- Tests already run sequentially (`maxWorkers: 1`)
- Add delays between tests if needed
- Run fewer tests at once
- Wait a few minutes before re-running

#### "Cannot reach API" in E2E tests

**Problem**: Network connectivity or API is down

**Solution**:
- Check if staging API is accessible: `curl https://blaze-spark-staging.fly.dev/healthcheck`
- Verify firewall/VPN settings
- Check GitHub Actions status page if in CI

#### Tests pass locally but fail in CI

**Problem**: Environment differences

**Solution**:
- Check GitHub Actions logs for specific error
- Verify secrets are set in GitHub repo settings
- Test with `--verbose` flag for more output
- Try running with same Node version as CI

#### "Command not found: blaze" in E2E tests

**Problem**: CLI not built

**Solution**:
```bash
yarn build
# Verify dist/cli/index.js exists
ls -la dist/
```

#### Coverage below threshold

**Problem**: New code isn't tested enough

**Solution**:
- Add unit tests for new functions
- Aim for >85% coverage on new code
- Use `yarn test:coverage` to see gaps
- View HTML coverage report: `open coverage/lcov-report/index.html`

### Debug Mode

**Enable verbose output** in E2E tests:
```bash
./test-cli-e2e.sh --env staging --api-key "$KEY" --verbose
```

**Run single test file**:
```bash
yarn test src/path/to/specific.test.ts
```

**Debug with Node inspector**:
```bash
node --inspect-brk node_modules/.bin/jest --runInBand src/path/to/test.ts
```

**Check API connectivity manually**:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://blaze-spark-staging.fly.dev/graphql \
     -X POST \
     -H "Content-Type: application/json" \
     -d '{"query":"{ __typename }"}'
```

---

## Test Maintenance

### Regular Tasks

**Weekly**:
- Review failing tests in CI
- Update snapshots if needed
- Check coverage trends

**Monthly**:
- Review and update test data
- Verify integration tests still pass
- Update E2E test expectations if API changed

**Before Releases**:
- Run full test suite locally
- Review and close test-related issues
- Ensure CI is green
- Smoke test CLI manually

### Test Debt

**Signs of test debt**:
- Flaky tests that fail intermittently
- Tests skipped with `test.skip()`
- Low coverage on critical paths
- Slow test suite (>5 minutes for unit tests)

**How to address**:
- Prioritize fixing flaky tests
- Remove or fix skipped tests
- Add tests for uncovered code
- Optimize slow tests or move to integration layer

---

## Resources

- **Jest Documentation**: https://jestjs.io/docs/getting-started
- **Testing Best Practices**: https://testingjavascript.com/
- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Blaze API Docs**: https://api.blaze.money/docs

---

## Questions?

If you encounter issues not covered here:

1. Check GitHub Issues for similar problems
2. Ask in team Slack channel
3. Create new issue with test failure logs
4. Tag `@testing` in PR for test-related reviews
