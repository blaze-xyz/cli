# Authentication

All Blaze API operations require an API key. This document covers how to obtain a key, how the CLI resolves credentials, and security best practices.

## Getting an API Key

API keys are issued from the Blaze dashboard at [https://dashboard.blaze.money](https://dashboard.blaze.money). Navigate to **Settings > API Keys** to create a new key.

There are two types of keys:

| Key Type | Prefix | Purpose |
|----------|--------|---------|
| Test | `sk_test_` | Safe for development and testing. Does not move real funds. |
| Live | `sk_live_` | Production use. Moves real money. |

The CLI automatically detects which environment you are using based on the key prefix.

---

## Three Methods of Authentication

The CLI supports three ways to provide an API key. They are checked in the following order -- the first one found wins.

### 1. CLI Flag (highest priority)

Pass the key directly to any command with the `--api-key` flag.

```bash
blaze balance --api-key sk_test_your_key_here
```

This overrides all other methods. Useful for one-off commands or scripting with a specific key.

### 2. Environment Variable

Set the `BLAZE_API_KEY` environment variable.

```bash
export BLAZE_API_KEY=sk_test_your_key_here
blaze balance
```

This is the recommended approach for CI/CD pipelines, Docker containers, and server environments.

### 3. Config File (lowest priority)

Save the key to the local config file using `blaze auth login`.

```bash
blaze auth login --api-key sk_test_your_key_here
```

The key is stored in `~/.blaze/config.json` and used automatically for all subsequent commands.

---

## Resolution Order

When the CLI needs an API key, it checks these sources in order:

```
1. --api-key flag     (if provided)
2. BLAZE_API_KEY      (environment variable)
3. ~/.blaze/config.json  (saved config file)
```

The first non-empty value found is used. If no key is found through any method, the command exits with an error.

---

## Config File

### Location

```
~/.blaze/config.json
```

The `~/.blaze/` directory and config file are created automatically when you run `blaze auth login`.

### Format

```json
{
  "api_key": "sk_test_your_key_here",
  "base_url": "https://api.blaze.money",
  "environment": "test"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `api_key` | `string` | Your Blaze API key |
| `base_url` | `string` | API base URL (optional, defaults to `https://api.blaze.money`) |
| `environment` | `"test" \| "live"` | Detected automatically from the key prefix |

### Manual Editing

You can edit `~/.blaze/config.json` directly if needed. The file is plain JSON.

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BLAZE_API_KEY` | API key for authentication |
| `BLAZE_BASE_URL` | Override the API base URL (defaults to `https://api.blaze.money`) |

The base URL variable follows the same precedence as the API key: the `--base-url` CLI flag takes priority over `BLAZE_BASE_URL`, which takes priority over the `base_url` field in the config file.

---

## Test vs Live Mode

The CLI detects the environment from the API key prefix:

| Prefix | Environment | Behavior |
|--------|-------------|----------|
| `sk_test_` | Test | Uses sandbox. No real money moves. |
| Any other prefix | Live | Production. Real financial transactions. |

You can verify which environment you are using at any time:

```bash
blaze auth whoami
```

```
Authenticated
Environment: test
Balance: $1,250.00 USD (pending: $50.00)
```

---

## MCP Server Authentication

When using the Blaze MCP server with AI assistants, the API key is provided through the MCP client configuration. The server reads the key from:

1. The `BLAZE_API_KEY` environment variable (set in the MCP config).
2. The `~/.blaze/config.json` file.

See [MCP Server Setup](./mcp.md) for configuration examples.

---

## Security Best Practices

**Never commit API keys to version control.** Add your config file to `.gitignore`:

```
# .gitignore
.blaze/
```

**Use environment variables in CI/CD.** Set `BLAZE_API_KEY` as a secret in your CI provider (GitHub Actions, GitLab CI, etc.) rather than hardcoding it in scripts.

```yaml
# GitHub Actions example
env:
  BLAZE_API_KEY: ${{ secrets.BLAZE_API_KEY }}
```

**Use test keys during development.** Test keys (`sk_test_*`) operate in a sandbox environment and never move real funds. Only use live keys (`sk_live_*`) in production.

**Rotate keys if compromised.** If you suspect a key has been exposed, revoke it immediately in the Blaze dashboard and generate a new one.

**Restrict key permissions.** If the Blaze dashboard supports scoped permissions, create keys with only the permissions your application needs. A key that only needs to read transactions should not have write access to transfers.

**Keep the config file private.** The `~/.blaze/config.json` file contains your API key in plain text. Ensure the file has appropriate permissions:

```bash
chmod 600 ~/.blaze/config.json
```
