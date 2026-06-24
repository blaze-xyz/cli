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

Browser-based authentication stores your OAuth token in a per-OS config file
managed by the `conf` library:

- **macOS:** `~/Library/Preferences/blaze-cli-nodejs/config.json`
- **Linux:** `~/.config/blaze-cli-nodejs/config.json` (or under `$XDG_CONFIG_HOME`)
- **Windows:** `%APPDATA%\blaze-cli-nodejs\Config\config.json`

Because that path is OS-specific and awkward to find by hand, use
`blaze auth token` to print the token — e.g. to copy it into `BLAZE_TOKEN` on a
headless box (see [Headless & Remote Environments](#headless--remote-environments)).

The token:
- Expires after 30 days
- Is tied to your Blaze account
- Grants personal access **and** business access for any business you're a member of
- Can be revoked by logging out (`blaze auth logout`)

> **Note:** the token does **not** auto-refresh. After 30 days, run `blaze auth` again.

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

## Headless & Remote Environments

The CLI works on machines with no browser — a VPS over SSH, cloud IDEs (GitHub
Codespaces, Gitpod), cloud agents (OpenAI Codex, Cursor background agents, Devin),
Docker, and CI.

### Recommended: inject a personal token

A personal token gives a headless agent the same access you have — personal **and**
every business you belong to.

```bash
# 1. On a machine with a browser, log in:
blaze auth

# 2. Print your token:
blaze auth token

# 3. On the headless box, set it (ideally via a secret store):
export BLAZE_TOKEN=<token>
blaze whoami        # verify
```

Pick a context per command (or via env), exactly like an interactive session:

```bash
blaze me --personal                  # personal context
blaze transfers --business biz_123   # a business you're a member of
export BLAZE_BUSINESS_ID=biz_123     # default business context for this shell
export BLAZE_PERSONAL=true           # force personal context
```

### Business-only automation

For a machine that should act purely as one business, use a business API key
(`BLAZE_API_KEY`) instead. It cannot reach personal/consumer endpoints.

### Interactive remote shells (SSH, Codespaces terminal)

You can still run `blaze auth` directly — the CLI detects a headless environment,
**skips trying to open a browser**, and prints the URL + code for you to open on
any device (e.g. your phone). Force this anywhere with `--no-browser`.

### Non-interactive (CI, cron, no terminal)

`blaze auth` needs a human to approve, so in CI / non-TTY contexts it fails fast
with guidance instead of hanging. Set `BLAZE_TOKEN` (personal) or `BLAZE_API_KEY`
(business) ahead of time.

> **⚠️ Security — `BLAZE_TOKEN` is full-account access, including money movement.**
> The personal CLI token is **not** read-only. After you've run `blaze auth` once,
> Blaze holds a delegated signer for your wallet, so this token **alone** can
> **send money, withdraw to a bank/card, and pay recipients** — with no further
> approval or per-transaction prompt on the CLI path. Treat it like a
> withdrawal-capable password:
> - Only place it on a host/agent you fully trust. Prefer a secret store
>   (Codespaces/Gitpod/Codex secrets, 1Password, CI secrets) over a plaintext env
>   file, and an env var over a `--token` flag (flags leak via process lists/history).
> - For an agent that only needs **business** data, mint a **read-only scoped
>   business API key** (`BLAZE_API_KEY`) instead — that can be limited to read scopes.
> - Scoped / read-only **personal** tokens are planned but not yet available
>   (see `docs/projects/headless-cli-auth`). Until then, a personal `BLAZE_TOKEN`
>   is all-or-nothing.
> - `blaze auth logout` (or revoking the session) is the kill switch.

---

## Authentication Resolution Order

When the CLI needs credentials, it checks these sources in order (first match wins):

```
1. --token <jwt>     flag    (personal access token / JWT)
2. --api-key <key>   flag    (business API key)
3. BLAZE_TOKEN       env     (personal access token / JWT)
4. BLAZE_API_KEY     env     (business API key)
5. stored OAuth session      (from `blaze auth`)
6. ~/.blaze/config.json      (legacy API key from `blaze auth login --api-key`)
```

A **personal token** (rows 1, 3, 5) authenticates as *you* — it acts personally
and on behalf of any business you're a member of (switch with `--personal` /
`--business <id>`). A **business API key** (rows 2, 4, 6) is scoped to a single
business. If no credential is found, the command exits with guidance to run
`blaze auth`.

---

## Config Files

### Browser-Based Auth Config

**Location:** per-OS (see [Where Credentials Are Stored](#where-credentials-are-stored)) — e.g. `~/Library/Preferences/blaze-cli-nodejs/config.json` on macOS, `~/.config/blaze-cli-nodejs/config.json` on Linux.

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
| `BLAZE_TOKEN` | Personal access token / JWT (personal + your businesses). **Full-account access incl. money movement** — see the security note above. Highest-priority env credential. |
| `BLAZE_API_KEY` | Business API key (single-business scope). |
| `BLAZE_BUSINESS_ID` | Default business context (sends `x-business-id`); same as `--business`. |
| `BLAZE_PERSONAL` | Set to `true` to force personal context (sends `x-blaze-personal`); same as `--personal`. |
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

When using the Blaze MCP server with AI assistants, credentials are provided through the MCP client configuration. The server resolves them with the same precedence as the CLI:

1. `BLAZE_TOKEN` — a personal access token (personal + your businesses).
2. `BLAZE_API_KEY` — a business API key.
3. The stored OAuth session from `blaze auth`.
4. The legacy `~/.blaze/config.json` API key.

See [MCP Server Setup](./mcp.md) for configuration examples.

---

## Security Best Practices

### For Interactive Use (Development)

**Use browser-based authentication.** Run `blaze auth` to authenticate via OAuth. This is more secure than storing API keys in config files.

**Log out when done.** If you're on a shared machine, run `blaze auth logout` to clear your credentials.

**Protect config files.** The CLI stores tokens in the per-OS config file (see [Where Credentials Are Stored](#where-credentials-are-stored)). Ensure it has appropriate permissions, e.g. on Linux:

```bash
chmod 600 ~/.config/blaze-cli-nodejs/config.json
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
.config/blaze-cli-nodejs/
```

**Use test keys during development.** Test keys (`sk_test_*`) operate in a sandbox environment and never move real funds. Only use live keys (`sk_live_*`) in production.

**Rotate keys if compromised.** If you suspect a key has been exposed, revoke it immediately in the Blaze dashboard and generate a new one.

**Restrict key permissions.** Create API keys with only the scopes your application needs. A key that only needs to read transactions should not have write access to transfers.

**Prefer OAuth tokens over API keys.** When possible, use browser-based authentication (`blaze auth`) rather than long-lived API keys. OAuth tokens:
- Expire after 30 days (no auto-refresh — re-run `blaze auth` when they lapse)
- Can be revoked by logging out (`blaze auth logout`)
- Are tied to your user account (audit trail)
- Don't require manual key management
