<p align="center">
  <img src="./assets/blaze-agent-demo-slow.gif" alt="Blaze — AI Agent Payments" width="100%">
</p>

<h1 align="center">@blaze-money/cli</h1>

<p align="center">
Payments infrastructure for modern businesses. SDK, CLI, MCP server, and AI agent — all in one package.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@blaze-money/cli"><img src="https://img.shields.io/npm/v/@blaze-money/cli.svg" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node >= 18"></a>
  <a href="https://www.typescriptlang.org"><img src="https://img.shields.io/badge/TypeScript-strict-blue.svg" alt="TypeScript"></a>
</p>

<br>

<table align="center">
  <tr>
    <td align="center" width="33%">
      <strong>TypeScript SDK</strong><br>
      Type-safe client for every Blaze API endpoint
    </td>
    <td align="center" width="33%">
      <strong>CLI</strong><br>
      Manage payments, customers, and transfers from your terminal
    </td>
    <td align="center" width="33%">
      <strong>AI-Native</strong><br>
      55-tool MCP server for Claude, Cursor, and any MCP client
    </td>
  </tr>
</table>

<br>

---

## Quick Start

```bash
npm install -g @blaze-money/cli
blaze auth login --api-key sk_test_...
blaze balance
```

```json
{
  "object": "balance",
  "available": 10250.00,
  "pending": 500.00,
  "currency": "USD"
}
```

---

## SDK

Use Blaze programmatically in any Node.js or TypeScript project.

```typescript
import { BlazeClient } from "@blaze-money/cli"

const client = new BlazeClient({ apiKey: "sk_test_..." })

// Check balance
const balance = await client.getBalance()

// Create a customer
const customer = await client.createCustomer({
  email: "maria@example.com",
  first_name: "Maria",
  last_name: "Santos",
})

// Send a transfer
const transfer = await client.createTransfer({
  amount: 500,
  currency: "USD",
  customer_id: customer.id,
})

// Get an FX quote
const quote = await client.createFxQuote({
  from_currency: "USD",
  to_currency: "MXN",
  amount: 500,
})
```

Every method returns typed responses. Errors throw typed exceptions (`BlazeAuthenticationError`, `BlazeValidationError`, etc.) so you always know what went wrong.

See [docs/sdk.md](docs/sdk.md) for the full SDK reference.

---

## CLI

A complete command-line interface for your Blaze account.

| Command | Description |
|---------|-------------|
| `blaze auth login` | Authenticate with your API key |
| `blaze auth whoami` | Show current authentication status |
| `blaze balance` | Check account balance |
| `blaze customers list\|get\|create\|update\|archive` | Manage customers |
| `blaze transfers list\|get\|create` | Manage transfers |
| `blaze withdrawals list\|get\|create` | Manage withdrawals |
| `blaze payment-links list\|get\|create\|update\|cancel` | Payment links |
| `blaze accounts list\|create\|delete` | External accounts |
| `blaze recipients list\|add\|remove` | Manage recipients |
| `blaze transactions list\|get` | View transactions |
| `blaze api-keys list\|create\|update\|revoke` | Manage API keys |
| `blaze team list\|invite\|update-role\|remove` | Manage team members |
| `blaze webhooks list\|get\|create\|update\|delete` | Webhook endpoints |
| `blaze analytics overview` | Transaction analytics |
| `blaze disputes list\|get\|submit-evidence\|close` | Manage disputes |
| `blaze invoices list\|get\|create\|send\|mark-paid\|void` | Invoices |
| `blaze subscriptions list\|get\|create\|cancel\|pause\|resume` | Subscriptions |
| `blaze fx rates\|quote` | FX rates and quotes |
| `blaze agent "<command>"` | Natural language agent |

### Global Flags

```
--api-key     Override the API key for a single command
--base-url    Point to a different Blaze API environment
--format      Output format: json | table (default: json)
```

See [docs/cli.md](docs/cli.md) for detailed usage and examples.

---

## AI-Native Payments

Give Claude, Cursor, or any MCP-compatible AI assistant the ability to manage payments, customers, and transfers.

### Setup for Claude Desktop

Add this to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "blaze": {
      "command": "npx",
      "args": ["-y", "@blaze-money/cli", "mcp"],
      "env": {
        "BLAZE_API_KEY": "sk_test_..."
      }
    }
  }
}
```

That's it. Your AI assistant now has full access to the Blaze API.

### Setup for Claude Code

```bash
claude mcp add blaze -- npx -y @blaze-money/cli mcp
```

Then set your API key as an environment variable:

```bash
export BLAZE_API_KEY="sk_test_..."
```

Or add the server to your project's `.claude/settings.json`:

```json
{
  "mcpServers": {
    "blaze": {
      "command": "npx",
      "args": ["-y", "@blaze-money/cli", "mcp"],
      "env": {
        "BLAZE_API_KEY": "sk_test_..."
      }
    }
  }
}
```

### Setup for Codex

```bash
BLAZE_API_KEY="sk_test_..." codex --full-auto \
  --mcp-config '{"blaze":{"command":"npx","args":["-y","@blaze-money/cli","mcp"]}}'
```

Or create an `mcp.json` file in your project root:

```json
{
  "blaze": {
    "command": "npx",
    "args": ["-y", "@blaze-money/cli", "mcp"],
    "env": {
      "BLAZE_API_KEY": "sk_test_..."
    }
  }
}
```

Then reference it when running Codex:

```bash
codex --full-auto --mcp-config mcp.json
```

### 55 Tools Available

**Balance** — `blaze_get_balance`, `blaze_whoami`

**Customers** — `blaze_list_customers`, `blaze_get_customer`, `blaze_create_customer`, `blaze_update_customer`, `blaze_archive_customer`

**External Accounts** — `blaze_list_external_accounts`, `blaze_create_external_account`, `blaze_delete_external_account`

**Transfers** — `blaze_list_transfers`, `blaze_get_transfer`, `blaze_create_transfer`

**Withdrawals** — `blaze_list_withdrawals`, `blaze_get_withdrawal`, `blaze_create_withdrawal`

**Payment Links** — `blaze_list_payment_links`, `blaze_get_payment_link`, `blaze_create_payment_link`, `blaze_update_payment_link`, `blaze_cancel_payment_link`

**Virtual Accounts** — `blaze_list_virtual_accounts`, `blaze_get_virtual_account`, `blaze_create_virtual_account`

**Transactions** — `blaze_list_transactions`, `blaze_get_transaction`

**Team Members** — `blaze_list_team_members`, `blaze_list_pending_invitations`, `blaze_invite_team_member`, `blaze_update_member_role`

**Webhooks** — `blaze_list_webhooks`, `blaze_get_webhook`, `blaze_create_webhook`, `blaze_update_webhook`, `blaze_delete_webhook`

**Analytics** — `blaze_get_analytics_overview`

**Disputes** — `blaze_list_disputes`, `blaze_get_dispute`, `blaze_submit_dispute_evidence`, `blaze_close_dispute`

**Invoices** — `blaze_list_invoices`, `blaze_get_invoice`, `blaze_create_invoice`, `blaze_send_invoice`, `blaze_mark_invoice_paid`, `blaze_void_invoice`

**Subscriptions** — `blaze_list_subscriptions`, `blaze_get_subscription`, `blaze_create_subscription`, `blaze_cancel_subscription`, `blaze_pause_subscription`, `blaze_resume_subscription`

**FX** — `blaze_get_fx_rates`, `blaze_create_fx_quote`

**Convenience** — `blaze_send_money`

### How It Works

```
Your AI Assistant  <-->  stdio  <-->  Blaze MCP Server  <-->  Blaze REST API
```

The MCP server communicates over standard input/output using the [Model Context Protocol](https://modelcontextprotocol.io), giving any compatible AI client structured access to the full Blaze API surface.

See [docs/mcp.md](docs/mcp.md) for integration guides and advanced configuration.

---

## Agent Mode

Natural language interface for common payment operations.

```bash
blaze agent "send $500 to maria@example.com"
```

```
[>>>] Looking up customer: maria@example.com
[ ->] Customer found: Maria Santos (cust_abc123)
[>>>] Checking external accounts...
[ ->] Using account: us_bank ending in 4567
[>>>] Creating transfer: $500.00 USD
[ OK] Transfer created!
{
  "id": "txn_xyz789",
  "status": "pending_approval",
  "amount": 500,
  "currency": "USD"
}
```

Works for any operation:

```bash
blaze agent "check balance"
blaze agent "list transactions 5"
```

See [docs/agent.md](docs/agent.md) for supported commands and customization.

---

## Authentication

Three methods, in order of precedence:

| Priority | Method | Example |
|----------|--------|---------|
| 1 | `--api-key` flag | `blaze balance --api-key sk_test_...` |
| 2 | Environment variable | `export BLAZE_API_KEY=sk_test_...` |
| 3 | Config file | `~/.blaze/config.json` |

**Test mode** — Keys starting with `sk_test_` hit the sandbox environment. No real money moves.

**Live mode** — Keys starting with `sk_live_` hit the production API. Handle with care.

See [docs/authentication.md](docs/authentication.md) for setup instructions.

---

## Supported Currencies

| Code | Currency |
|------|----------|
| USD | US Dollar |
| MXN | Mexican Peso |
| EUR | Euro |
| GBP | British Pound |
| BRL | Brazilian Real |
| COP | Colombian Peso |
| PEN | Peruvian Sol |
| ARS | Argentine Peso |

---

## Error Handling

All errors are typed and predictable.

```typescript
import { BlazeClient, BlazeValidationError } from "@blaze-money/cli"

try {
  await client.createCustomer({ email: "invalid" })
} catch (err) {
  if (err instanceof BlazeValidationError) {
    console.error(err.errors) // { email: ["Invalid email format"] }
  }
}
```

| Error Class | HTTP Status | When |
|-------------|-------------|------|
| `BlazeError` | — | Base class for all errors |
| `BlazeAuthenticationError` | 401 | Invalid or missing API key |
| `BlazePermissionError` | 403 | Insufficient permissions |
| `BlazeNotFoundError` | 404 | Resource does not exist |
| `BlazeValidationError` | 400 | Invalid request parameters |
| `BlazeRateLimitError` | 429 | Too many requests |

---

## Contributing

We welcome contributions. Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on how to get started.

---

## License

MIT — see [LICENSE](LICENSE) for details.
