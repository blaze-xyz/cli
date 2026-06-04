# Authentication

The Blaze CLI supports two authentication methods: **browser-based OAuth** (recommended) and **API keys** (for programmatic access). This document covers both methods, credential resolution, and security best practices.

---

## Browser-Based Authentication (Recommended)

The recommended way to authenticate the Blaze CLI is through your browser using OAuth 2.0 Device Flow, similar to GitHub CLI and Vercel CLI.

### Quick Start

Run the following command to authenticate:

```bash
blaze auth
```

**What happens:**
1. The CLI generates a unique device code (e.g., `WDJB-MJHT`)
2. Your browser automatically opens to `https://blaze.money/cli-auth`
3. Log in to your Blaze account (if not already logged in)
4. The device code is pre-filled — just click "Authorize"
5. The CLI receives your credentials and stores them securely

**Example output:**

```
🔐 Authorize Blaze CLI

Visit: https://blaze.money/cli-auth

Enter code: WDJB-MJHT

✓ Opened browser automatically

⠋ Waiting for authorization...

✓ Authorization successful!

✓ Logged in as user@example.com
```

### Managing Authentication

```bash
# Check who you're logged in as
blaze auth whoami

# Log out and clear credentials
blaze auth logout
```

### Where Credentials Are Stored

Browser-based authentication stores your OAuth token in:

```
~/.config/blaze-cli/config.json
```

The token:
- Expires after 30 days
- Is tied to your Blaze account
- Automatically refreshes when needed
- Can be revoked from your Blaze dashboard

### Benefits of Browser-Based Auth

✅ **More secure** — No API keys to manage or accidentally expose  
✅ **Easier** — No need to copy/paste keys from the dashboard  
✅ **Automatic** — Browser opens automatically with the code pre-filled  
✅ **Revocable** — Manage CLI access from your dashboard

---

## API Key Authentication

For programmatic access (CI/CD pipelines, scripts, server environments), use API keys.

### Getting an API Key

API keys are issued from the Blaze dashboard at [https://dashboard.blaze.money](https://dashboard.blaze.money). Navigate to **Settings > API Keys** to create a new key.

There are two types of keys:

| Key Type | Prefix | Purpose |
|----------|--------|---------|
| Test | `sk_test_` | Safe for development and testing. Does not move real funds. |
| Live | `sk_live_` | Production use. Moves real money. |

The CLI automatically detects which environment you are using based on the key prefix.

---

## Three Methods of Providing API Keys

When using API key authentication, the CLI supports three ways to provide a key. They are checked in the following order -- the first one found wins.

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

Save the key to the local config file using `blaze auth login` (legacy method):

```bash
blaze auth login --api-key sk_test_your_key_here
```

<Note>
  **Deprecated:** This method stores the API key in plain text. Use browser-based authentication (`blaze auth`) or environment variables instead.
</Note>

---

## Authentication Resolution Order

When the CLI needs credentials, it checks these sources in order:

```
1. --api-key flag              (if provided)
2. BLAZE_API_KEY               (environment variable)
3. ~/.config/blaze-cli/config.json  (OAuth token from browser auth)
4. ~/.blaze/config.json        (legacy API key storage)
```

The first valid credential found is used. If no credentials are found through any method, the command exits with an error prompting you to run `blaze auth`.

---

## Config Files

### Browser-Based Auth Config

**Location:** `~/.config/blaze-cli/config.json`

This file is created automatically when you run `blaze auth` (browser-based authentication).

**Format:**

```json
{
  "auth": {
    "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "Bearer",
    "expires_in": 2592000,
    "user": {
      "id": "usr_abc123",
      "email": "user@example.com",
      "blazetag": "@user"
    },
    "created_at": 1704067200000
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `access_token` | `string` | JWT token for API authentication |
| `token_type` | `string` | Always "Bearer" |
| `expires_in` | `number` | Token lifetime in seconds (30 days) |
| `user` | `object` | Authenticated user information |
| `created_at` | `number` | Unix timestamp when token was issued |

<Warning>
  Do not manually edit this file. Use `blaze auth` to authenticate and `blaze auth logout` to clear credentials.
</Warning>

### Legacy API Key Config

**Location:** `~/.blaze/config.json`

This file is created when you run `blaze auth login --api-key` (deprecated).

**Format:**

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

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BLAZE_API_KEY` | API key for authentication |
| `BLAZE_BASE_URL` | Override the API base URL (defaults to `https://api.blaze.money`) |
| `BLAZE_API_URL` | Deprecated alias for `BLAZE_BASE_URL`. Still accepted for back-compat. |

The base URL variable follows the same precedence as the API key: the `--base-url` CLI flag takes priority over `BLAZE_BASE_URL`, which takes priority over `BLAZE_API_URL` (back-compat alias), which takes priority over the `base_url` field in the config file.

---

## Test vs Live Mode

### Browser-Based Auth
When using `blaze auth` (browser authentication), the CLI uses the environment associated with your Blaze account. You can switch environments from your dashboard.

### API Key Auth
When using API keys, the CLI detects the environment from the key prefix:

| Prefix | Environment | Behavior |
|--------|-------------|----------|
| `sk_test_` | Test | Uses sandbox. No real money moves. |
| Any other prefix | Live | Production. Real financial transactions. |

You can verify which environment you are using at any time:

```bash
blaze auth whoami
```

**Output (browser-based auth):**
```
Authenticated User:

Email:    user@example.com
Blazetag: @user
User ID:  usr_abc123
```

**Output (API key auth):**
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

### For Interactive Use (Development)

**Use browser-based authentication.** Run `blaze auth` to authenticate via OAuth. This is more secure than storing API keys in config files.

**Log out when done.** If you're on a shared machine, run `blaze auth logout` to clear your credentials.

**Protect config files.** The CLI stores tokens in `~/.config/blaze-cli/config.json`. Ensure this file has appropriate permissions:

```bash
chmod 600 ~/.config/blaze-cli/config.json
```

### For Programmatic Use (CI/CD, Servers)

**Use environment variables.** Set `BLAZE_API_KEY` as a secret in your CI provider (GitHub Actions, GitLab CI, etc.) rather than hardcoding it in scripts.

```yaml
# GitHub Actions example
env:
  BLAZE_API_KEY: ${{ secrets.BLAZE_API_KEY }}
```

**Never commit API keys to version control.** Add config files to `.gitignore`:

```
# .gitignore
.blaze/
.config/blaze-cli/
```

**Use test keys during development.** Test keys (`sk_test_*`) operate in a sandbox environment and never move real funds. Only use live keys (`sk_live_*`) in production.

**Rotate keys if compromised.** If you suspect a key has been exposed, revoke it immediately in the Blaze dashboard and generate a new one.

**Restrict key permissions.** Create API keys with only the scopes your application needs. A key that only needs to read transactions should not have write access to transfers.

**Prefer OAuth tokens over API keys.** When possible, use browser-based authentication (`blaze auth`) rather than long-lived API keys. OAuth tokens:
- Expire after 30 days (automatic rotation)
- Can be revoked from your dashboard
- Are tied to your user account (audit trail)
- Don't require manual key management
