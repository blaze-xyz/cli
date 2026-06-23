<p align="center">
  <img src="./assets/blaze-agent-demo-slow.gif" alt="Blaze — AI Agent Payments" width="100%">
</p>

<h1 align="center">@blaze-money/cli</h1>

<p align="center">
Give your AI agent the ability to manage payments, analyze spending, and automate financial operations.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@blaze-money/cli"><img src="https://img.shields.io/npm/v/@blaze-money/cli.svg" alt="npm version"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node >= 18"></a>
</p>

---

## What You Can Do

```
You:   "How much did I spend on Brex this month?"
Agent: You spent $2,720.45 on Brex across 2 transactions (May 1–27).

You:   "Pay all bills due this week"
Agent: 3 bills due by Friday totaling $3,478.17. Fees: $4.50. Confirm? → Paid.

You:   "Send $500 to @maria"
Agent: Sent $500 USD to Maria Santos. Transfer ID: txn_xyz789.

You:   "Create a payment link for $2,000 — client invoice"
Agent: Created: https://pay.blaze.money/links/lnk_abc123
```

---

## Quick Start

```bash
npm install -g @blaze-money/cli
blaze auth
blaze businesses use        # select your business (if you have one)
```

### Add to Claude Code

```bash
claude mcp add blaze -- npx -y @blaze-money/cli mcp
claude skill add $(npm root -g)/@blaze-money/cli/skills/blaze
```

Done. Ask your agent anything about your finances.

### Add to Codex

```bash
codex --full-auto --mcp-config '{"blaze":{"command":"npx","args":["-y","@blaze-money/cli","mcp"]}}'
```

---

## Other AI Environments

The Blaze skill ships with the CLI package. For environments that support skills, install with:

```bash
claude skill add $(npm root -g)/@blaze-money/cli/skills/blaze
```

For environments that only support MCP servers, add this config:

```json
{
  "command": "npx",
  "args": ["-y", "@blaze-money/cli", "mcp"]
}
```

No API key needed — the server uses your `blaze auth` session.

| Environment | Config Location | Notes |
|-------------|-----------------|-------|
| **Claude Code** | `claude mcp add` + `claude skill add` | Full skill support |
| **Codex** | `--mcp-config` flag or `mcp.json` | Inline or file-based |
| **Claude Desktop** | `~/Library/Application Support/Claude/claude_desktop_config.json` | Restart after edit |
| **Cursor** | `.cursor/mcp.json` | Project-level |
| **Windsurf** | `.windsurf/mcp.json` | Project-level |
| **Continue.dev** | `.continue/config.json` | MCP section |
| **Cline** | VS Code extension settings | MCP servers section |
| **Zed** | Zed settings | Extensions → MCP |

<details>
<summary>Full config example (Claude Desktop / Cursor / Windsurf)</summary>

```json
{
  "mcpServers": {
    "blaze": {
      "command": "npx",
      "args": ["-y", "@blaze-money/cli", "mcp"]
    }
  }
}
```

</details>

<details>
<summary>Full config example (Codex — file-based)</summary>

Create `mcp.json` in your project root:

```json
{
  "blaze": {
    "command": "npx",
    "args": ["-y", "@blaze-money/cli", "mcp"]
  }
}
```

Then: `codex --full-auto --mcp-config mcp.json`

</details>

---

## CLI

A complete command-line interface for your Blaze account.

```bash
blaze balance                    # Check account balance
blaze transactions list          # View recent transactions
blaze transactions list --personal  # Personal transactions
blaze businesses list            # List your businesses
blaze businesses use <id>        # Switch business context
```

| Category | Commands |
|----------|----------|
| **Account** | `balance`, `whoami`, `businesses`, `me` |
| **Payments** | `send`, `contacts`, `payments`, `withdrawals methods`, `withdrawals to-method`, `withdrawals status` |
| **Business** | `customers`, `transfers`, `withdrawals create/list/get`, `paylinks` |
| **Billing** | `invoices`, `subscriptions`, `bills` |
| **Insights** | `insights summary`, `insights transactions`, `insights balances` |
| **Operations** | `team`, `api-keys`, `webhooks`, `disputes` |
| **FX** | `fx rates`, `fx quote` |

### Context Flags

```bash
--personal      # Force personal mode (ignore active business)
--business <id> # Use a specific business for one command
--format json   # Raw JSON output (default: table)
```

See [docs/cli.md](docs/cli.md) for the full command reference.

### Staying Up to Date

The CLI checks npm for a newer version in the background (at most once a day) and
shows a one-line notice when an update is available:

```
  ╭───────────────────────────────────────────╮
  │                                             │
  │  Update available 1.1.0 → 1.2.0             │
  │  Run npm i -g @blaze-money/cli to update    │
  │                                             │
  ╰───────────────────────────────────────────╯
```

The check runs in a detached background process, so it never slows down or blocks
your command. The notice is printed to stderr after your output, and is
automatically suppressed for non-interactive use (piped output, `--format json`,
and CI). To opt out entirely, set `NO_UPDATE_NOTIFIER=1`.

---

## Authentication

```bash
blaze auth          # Browser login (recommended)
blaze auth login --api-key sk_live_...  # API key (CI/headless)
```

Your session persists across CLI and MCP — authenticate once, use everywhere.

---

## Supported Currencies

USD, MXN, EUR, GBP, BRL, COP, PEN, ARS — with real-time FX rates between all pairs.

---

## Documentation

| Doc | What it covers |
|-----|----------------|
| [docs/cli.md](docs/cli.md) | Full CLI command reference |
| [docs/sdk.md](docs/sdk.md) | TypeScript SDK (programmatic usage) |
| [docs/mcp.md](docs/mcp.md) | MCP server details and tool catalog |
| [docs/agent.md](docs/agent.md) | Natural language agent mode |
| [docs/codex-integration.md](docs/codex-integration.md) | Business integration patterns |
| [docs/authentication.md](docs/authentication.md) | Auth methods and API keys |

---

## Contributing

We welcome contributions. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT — see [LICENSE](LICENSE) for details.
