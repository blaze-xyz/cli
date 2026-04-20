# Quick Testing Guide

Fast reference for running tests on the Blaze CLI.

## Prerequisites

```bash
# Install dependencies
yarn install

# Build the CLI (required for E2E tests)
yarn build
```

## Running Tests

### Unit Tests (Fast)
```bash
# Run all unit tests
yarn test

# With coverage
yarn test:coverage

# Watch mode (re-run on changes)
yarn test --watch

# Specific file
yarn test src/sdk/__tests__/client.test.ts
```

### Integration Tests (Requires API Key)
```bash
# Set your staging API key
export BLAZE_API_KEY="your-staging-api-key"

# Run integration tests
yarn test:integration
```

### E2E Tests (Requires Build + API Key)
```bash
# Build first
yarn build

# Run E2E tests against staging
export BLAZE_API_KEY="your-staging-api-key"
./test-cli-e2e.sh --env staging --api-key "$BLAZE_API_KEY"

# Verbose output
./test-cli-e2e.sh --env staging --api-key "$BLAZE_API_KEY" --verbose

# Dry run (see what would be tested)
./test-cli-e2e.sh --dry-run
```

## CI/CD

Tests run automatically on:
- Pull requests (if `blaze-cli/**` changed)
- Pushes to `main`
- Manual workflow dispatch

View results: **GitHub Actions** → **Blaze CLI - Test & Quality**

## Coverage Target

- **Unit tests**: 80% overall coverage
- **Integration tests**: Critical paths covered
- **E2E tests**: All commands smoke-tested

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| "API key required" | `export BLAZE_API_KEY="..."` |
| "401 Unauthorized" | Check API key is valid |
| "Cannot reach API" | Verify staging is up: `curl https://blaze-spark-staging.fly.dev/healthcheck` |
| "Command not found" | Run `yarn build` first |
| Tests fail in CI only | Check GitHub Actions logs, verify secrets are set |
| Rate limiting | Tests run sequentially, wait and retry |

## More Details

See [docs/testing-guide.md](./docs/testing-guide.md) for comprehensive documentation.
