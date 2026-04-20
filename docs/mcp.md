# MCP Server Setup

The Blaze CLI includes a built-in [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server. MCP is an open standard that lets AI assistants call external tools in a structured way. Once configured, your AI assistant can manage customers, send transfers, check balances, and more -- all through natural conversation.

## Prerequisites

- Node.js 18+
- A Blaze API key (see [Authentication](./authentication.md))
- An MCP-compatible client (Claude Desktop, Cursor, or any MCP-compatible tool)

---

## Setup for Claude Desktop

1. Open Claude Desktop settings and navigate to the MCP servers configuration file. On macOS this is typically `~/Library/Application Support/Claude/claude_desktop_config.json`. On Windows it is `%APPDATA%\Claude\claude_desktop_config.json`.

2. Add the Blaze server to the `mcpServers` object:

```json
{
  "mcpServers": {
    "blaze": {
      "command": "npx",
      "args": ["-y", "@blaze-money/cli", "mcp"],
      "env": {
        "BLAZE_API_KEY": "sk_test_your_key_here"
      }
    }
  }
}
```

3. Restart Claude Desktop. You should see "blaze" listed as an available MCP server with 55 tools.

**Alternative using a global install:**

If you have installed `@blaze-money/cli` globally, you can reference the binary directly:

```json
{
  "mcpServers": {
    "blaze": {
      "command": "blaze",
      "args": ["mcp"],
      "env": {
        "BLAZE_API_KEY": "sk_test_your_key_here"
      }
    }
  }
}
```

---

## Setup for Cursor

1. Open Cursor settings and navigate to **MCP Servers** (or edit `.cursor/mcp.json` in your project).

2. Add the Blaze server:

```json
{
  "mcpServers": {
    "blaze": {
      "command": "npx",
      "args": ["-y", "@blaze-money/cli", "mcp"],
      "env": {
        "BLAZE_API_KEY": "sk_test_your_key_here"
      }
    }
  }
}
```

3. Reload the window. The Blaze tools will be available in Cursor's agent mode.

---

## Setup for Claude Code

The fastest way to add Blaze to Claude Code is a single command:

```bash
claude mcp add blaze -- npx -y @blaze-money/cli mcp
```

Set your API key as an environment variable in your shell profile:

```bash
export BLAZE_API_KEY=sk_test_your_key_here
```

Alternatively, add the server to your project's `.claude/settings.json` to share the configuration with your team:

```json
{
  "mcpServers": {
    "blaze": {
      "command": "npx",
      "args": ["-y", "@blaze-money/cli", "mcp"],
      "env": {
        "BLAZE_API_KEY": "sk_test_your_key_here"
      }
    }
  }
}
```

Once configured, Claude Code can call any of the 55 Blaze tools directly inside your terminal. Try asking:

```
> check my blaze balance
> send $200 to jane@example.com
> create a payment link for $50
```

---

## Setup for Codex

Pass the Blaze MCP server inline when launching Codex:

```bash
BLAZE_API_KEY="sk_test_your_key_here" codex --full-auto \
  --mcp-config '{"blaze":{"command":"npx","args":["-y","@blaze-money/cli","mcp"]}}'
```

For repeated use, create an `mcp.json` file in your project:

```json
{
  "blaze": {
    "command": "npx",
    "args": ["-y", "@blaze-money/cli", "mcp"],
    "env": {
      "BLAZE_API_KEY": "sk_test_your_key_here"
    }
  }
}
```

Then reference it on each run:

```bash
codex --full-auto --mcp-config mcp.json
```

Codex will have access to all 55 Blaze tools and can perform payment operations autonomously.

---

## Setup for Generic MCP Clients

The Blaze MCP server communicates over **stdio** (standard input/output). Any MCP client that supports the stdio transport can connect.

**Server details:**

| Property | Value |
|----------|-------|
| Transport | stdio |
| Command | `npx -y @blaze-money/cli mcp` |
| Server name | `blaze` |
| Server version | `0.1.0` |

**Environment variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `BLAZE_API_KEY` | Yes | Your Blaze API key |
| `BLAZE_BASE_URL` | No | Override the API base URL |

The server reads the API key from the `BLAZE_API_KEY` environment variable or from `~/.blaze/config.json` (if previously saved with `blaze auth login`).

---

## Available Tools

The MCP server exposes 55 tools organized by resource.

> **Note:** API key management operations are intentionally excluded from the MCP server. 
> Team member removal and ownership transfer are also excluded. 
> These high-stakes operations are available only through the CLI and SDK.

### Balance

| Tool | Description |
|------|-------------|
| `blaze_get_balance` | Get your account balance (available and pending funds) |
| `blaze_whoami` | Check your API key status and account balance |

### Customers

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_customers` | List customers with optional filters | `limit`, `cursor`, `email`, `include_archived` |
| `blaze_get_customer` | Get a single customer by ID | `id` |
| `blaze_create_customer` | Create a new customer | `email`, `first_name`, `last_name`, `phone`, `address`, `metadata` |
| `blaze_update_customer` | Update a customer | `id`, `first_name`, `last_name`, `phone`, `address`, `metadata` |
| `blaze_archive_customer` | Archive (soft-delete) a customer | `id` |

### External Accounts

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_external_accounts` | List bank accounts and crypto wallets for a customer | `customer_id` |
| `blaze_create_external_account` | Add a bank account or crypto wallet | `customer_id`, `type`, `routing_number`, `account_number`, `iban`, `wallet_address`, `network` |
| `blaze_delete_external_account` | Remove an external account | `customer_id`, `account_id` |

### Transfers

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_transfers` | List transfers with optional status filter | `limit`, `cursor`, `status` |
| `blaze_get_transfer` | Get a single transfer by ID | `id` |
| `blaze_create_transfer` | Create a transfer between accounts | `amount`, `currency`, `customer_id`, `source_type`, `source_id`, `destination_type`, `destination_id`, `note`, `metadata` |

### Withdrawals

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_withdrawals` | List withdrawals with optional status filter | `limit`, `cursor`, `status` |
| `blaze_get_withdrawal` | Get a single withdrawal by ID | `id` |
| `blaze_create_withdrawal` | Create a withdrawal to an external account | `external_account_id`, `amount`, `currency`, `note`, `metadata` |

### Payment Links

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_payment_links` | List payment links with optional status filter | `limit`, `cursor`, `status` |
| `blaze_get_payment_link` | Get a single payment link by ID | `id` |
| `blaze_create_payment_link` | Create a shareable payment link | `amount`, `currency`, `name`, `note`, `success_url`, `metadata` |
| `blaze_update_payment_link` | Update a payment link | `id`, `name`, `note`, `metadata` |
| `blaze_cancel_payment_link` | Cancel an active payment link | `id` |

### Virtual Accounts

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_virtual_accounts` | List virtual bank accounts for a customer | `customer_id`, `limit`, `cursor` |
| `blaze_get_virtual_account` | Get a single virtual account | `customer_id`, `va_id` |
| `blaze_create_virtual_account` | Create a virtual bank account for receiving funds | `customer_id`, `nickname` |

### Transactions

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_transactions` | List transactions with optional type and status filters | `limit`, `cursor`, `type`, `status` |
| `blaze_get_transaction` | Get a single transaction by ID | `id` |

### Webhooks

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_webhooks` | List webhook endpoints | `limit`, `cursor` |
| `blaze_get_webhook` | Get a single webhook endpoint by ID | `id` |
| `blaze_create_webhook` | Create a webhook endpoint | `url`, `events`, `enabled`, `description` |
| `blaze_update_webhook` | Update a webhook endpoint | `id`, `url`, `events`, `enabled`, `description` |
| `blaze_delete_webhook` | Delete a webhook endpoint | `id` |

### Analytics

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_get_analytics_overview` | Get transaction analytics for a time period | `period` |

### Disputes

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_disputes` | List disputes with optional status filter | `limit`, `cursor`, `status` |
| `blaze_get_dispute` | Get a single dispute by ID | `id` |
| `blaze_submit_dispute_evidence` | Submit evidence to contest a dispute | `id`, `description`, `document_urls` |
| `blaze_close_dispute` | Close/accept a dispute | `id` |

### Invoices

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_invoices` | List invoices with optional filters | `limit`, `cursor`, `status`, `customer_id` |
| `blaze_get_invoice` | Get a single invoice by ID | `id` |
| `blaze_create_invoice` | Create an invoice with line items | `customer_id`, `line_items`, `tax`, `description`, `due_date`, `currency_code` |
| `blaze_send_invoice` | Send an invoice to the customer | `id` |
| `blaze_mark_invoice_paid` | Manually mark an invoice as paid | `id` |
| `blaze_void_invoice` | Void an invoice | `id` |

### Subscriptions

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_subscriptions` | List subscriptions with optional filters | `limit`, `cursor`, `status`, `customer_id` |
| `blaze_get_subscription` | Get a single subscription by ID | `id` |
| `blaze_create_subscription` | Create a new subscription | `customer_id`, `product_id`, `interval` |
| `blaze_cancel_subscription` | Cancel a subscription | `id`, `cancel_immediately` |
| `blaze_pause_subscription` | Pause an active subscription | `id` |
| `blaze_resume_subscription` | Resume a paused subscription | `id` |

### FX Rates & Quotes

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_get_fx_rates` | Get current exchange rates | `base` |
| `blaze_create_fx_quote` | Create a locked-in FX quote | `from_currency`, `to_currency`, `amount` |

### Team Members (read-only)

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_list_team_members` | List team members | -- |
| `blaze_list_pending_invitations` | List pending team invitations | -- |
| `blaze_invite_team_member` | Invite a new team member | `email`, `role` |
| `blaze_update_member_role` | Change a team member's role | `id`, `role` |

### Convenience

| Tool | Description | Key Parameters |
|------|-------------|----------------|
| `blaze_send_money` | Send money by email (finds or creates customer, then creates transfer) | `email`, `amount`, `currency`, `note` |

---

## Example Conversations

Once configured, you can interact with Blaze through natural language in your AI assistant.

**Check balance:**
> "What is my Blaze balance?"

The assistant calls `blaze_get_balance` and reports the result.

**Send a payment:**
> "Send $200 to jane@example.com with the note 'March consulting'"

The assistant calls `blaze_send_money` with `email`, `amount`, and `note` parameters.

**List recent transfers:**
> "Show me my last 5 completed transfers"

The assistant calls `blaze_list_transfers` with `limit: 5` and `status: "completed"`.

**Create a payment link:**
> "Create a $50 payment link called 'Workshop Registration'"

The assistant calls `blaze_create_payment_link` with `amount: 50` and `name: "Workshop Registration"`.

---

## Troubleshooting

### "No API key configured"

The MCP server could not find an API key. Verify that:

1. The `BLAZE_API_KEY` environment variable is set in the MCP server configuration.
2. Or, you have previously run `blaze auth login --api-key <key>` to save a key to `~/.blaze/config.json`.

### "Authentication failed" (401)

The API key is present but invalid. Double check that the key is correct and has not been revoked. Test keys start with `sk_test_` and live keys start with `sk_live_`.

### Tools not appearing in Claude Desktop

- Confirm that `claude_desktop_config.json` has valid JSON (no trailing commas, correct quoting).
- Restart Claude Desktop after editing the configuration.
- Check the Claude Desktop logs for MCP connection errors.

### Connection timeout

The MCP server uses stdio transport. If the client reports a timeout:

- Verify that `npx @blaze-money/cli mcp` runs successfully in your terminal.
- Ensure Node.js 18+ is installed and on your PATH.
- If using a global install, confirm the `blaze` binary is accessible from the shell that the MCP client uses.

### Permission errors (403)

Your API key does not have the required permissions for the requested operation. Contact your Blaze account administrator to verify key permissions.

### Rate limiting (429)

You are sending too many requests. The AI assistant will see an error message and can retry after a brief pause. If this happens frequently, consider reducing the pace of automated workflows.
