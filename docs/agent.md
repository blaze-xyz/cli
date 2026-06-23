# Agent Mode

Agent mode lets you interact with Blaze using natural language from the
terminal. The agent is a Claude (Anthropic) tool-calling loop wrapped around the
CLI's SDK — you describe what you want, the agent picks the right tools, and it
surfaces confirmation prompts before any money moves.

```bash
blaze agent "How much cash do we have?"
blaze agent "Send $50 to @alex with note 'lunch'"
blaze agent "Pay the AWS bill"
```

## Setup

The agent calls Claude under the hood, so `ANTHROPIC_API_KEY` must be set in the
shell environment in addition to the standard Blaze auth.

```bash
export ANTHROPIC_API_KEY="sk-ant-..."
blaze auth                            # or `blaze setup` for a guided onboarding
blaze agent "balance"
```

To install via Claude Code / Cursor / Codex as an MCP server, see
[mcp.md](./mcp.md). To bundle the agent's natural-language behavior into Claude
Code as a skill, see [`skills/blaze/SKILL.md`](../skills/blaze/SKILL.md).

### Auth & context modes

The agent inherits the CLI's two auth/context modes:

- **Consumer / personal** — a bearer token (OAuth device flow); requests send
  `x-blaze-personal: true`. This powers P2P sends, contacts, payments, and
  withdrawing your own balance to your own connected method.
- **Business** — an API key (`sk_test_` / `sk_live_`) or `--business <id>`;
  requests send `x-business-id`. This powers customers, transfers, payouts,
  bills, and analytics.

Credential priority is explicit `--api-key` / `BLAZE_API_KEY` > bearer token >
config-file `api_key`. See
[`docs/cli-functionality-map.md`](./cli-functionality-map.md) for the canonical
description of both modes.

---

## How It Works

The agent is **not** a regex parser — it is a multi-turn Claude tool-use loop
driven by a Blaze-specific system prompt and a curated tool registry.

1. **System prompt** loads a strict set of behavioral rules: read-only by
   default, confirm before moving money, check memory for recurring patterns,
   never claim a payment succeeded unless the tool actually returned success.
   Custom `agents/skills/*` files are also injected if present.
2. **Tool loop** — Claude is given a curated set of read and write tools
   mirroring the CLI surface: balance, customers, transfers, payment links, FX
   quotes, bills (with quote-then-confirm), bank insights, P2P send, contacts,
   payments, and a persistent memory store.
3. **Confirmation gate** — for any money-movement tool, the agent surfaces what
   it intends to do (recipient + amount + fees) and waits for an explicit "yes"
   before invoking the tool.

If the API key in use lacks a required scope, the server (not the agent) rejects
the call — so a read-only key physically cannot move money even if the model
tries.

---

## Capabilities

These are the tools registered in [`src/agent/tools.ts`](../src/agent/tools.ts)
— the agent will use them based on the question it receives.

### Read & answer (no scope risk)

| You ask                                     | Tools called                                      |
| ------------------------------------------- | ------------------------------------------------- |
| "What's my balance?"                        | `blaze_get_balance`, `blaze_get_business_balance` |
| "How much cash do we have?"                 | `blaze_get_bank_balances` (live Plaid balances)   |
| "What did we spend on software last month?" | `blaze_get_spending_summary`                      |
| "List bank transactions for last week"      | `blaze_list_bank_transactions`                    |
| "Show me my last 5 transfers"               | `blaze_list_transactions`, `blaze_list_transfers` |
| "List my recent payments"                   | `blaze_list_payments`, `blaze_get_payment`        |
| "Which banks/cards can I withdraw to?"      | `blaze_list_connected_payment_methods`            |
| "Find my contact 'Alex'"                    | `blaze_list_contacts`                             |
| "Search for blazetag @alex"                 | `blaze_search_users`                              |
| "What's the USD→MXN rate right now?"        | `blaze_fx_rates`, `blaze_fx_quote`                |
| "List my unpaid bills"                      | `blaze_list_bills`, `blaze_get_bill`              |
| "Show pending bill approvals"               | `blaze_list_pending_bill_approvals`               |
| "What's my blazetag?"                       | `blaze_get_me`                                    |

### Write (gated by confirmation + API-key scope)

| You ask                                | Tools called                                                                                                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Send $50 to @alex"                    | `blaze_send_payment`                                                                                                                                        |
| "Pay Acme Supplies $250"               | `blaze_pay_contact`                                                                                                                                         |
| "Withdraw $100 to my bank/card"        | `blaze_list_connected_payment_methods` → user confirms amount + destination → `blaze_withdraw` (IRREVERSIBLE; balance pre-check + explicit confirm in-tool) |
| "Add a new bank contact"               | `blaze_add_contact` (then `blaze_delete_contact` to remove)                                                                                                 |
| "Create a payment link for $100"       | `blaze_create_payment_link`                                                                                                                                 |
| "Add a customer with email …"          | `blaze_create_customer`                                                                                                                                     |
| "Pay the AWS bill"                     | `blaze_quote_bill_payment` → user confirms → `blaze_pay_bill` with `confirm: true`                                                                          |
| "Connect my Gmail for bill extraction" | `blaze_connect_gmail_start` → user opens URL → `blaze_connect_gmail_finalize` polls                                                                         |

### Memory (persistent state)

The agent has a small persistent memory at `~/.blaze/agent-memory.md`, used for
recurring-payment patterns and recent-payment deduplication.

| Tool                 | Purpose                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `blaze_read_memory`  | Read patterns + recent payment log                                     |
| `blaze_save_pattern` | Save a trigger phrase like `"pay my rent"` with the recipient + amount |
| `blaze_log_payment`  | Automatically appended after every completed payment                   |

You can inspect or clear memory from outside the agent via the
[`memory` CLI commands](./cli.md#memory).

---

## Tool naming vs the MCP catalog

A few agent tools intentionally use **different names** than their
[MCP](./mcp.md) equivalents for the **same capability**. This is **intentional,
not a bug**: the agent's `toolDefs` (in
[`src/agent/tools.ts`](../src/agent/tools.ts)) and the MCP catalog (in
[`src/mcp/tools.ts`](../src/mcp/tools.ts)) are **independent public contracts**
with separate callers, so renaming either to match the other would be a breaking
change for existing integrations.

| Capability | Agent tool           | MCP tool                |
| ---------- | -------------------- | ----------------------- |
| P2P send   | `blaze_send_payment` | `blaze_send_money`      |
| FX rates   | `blaze_fx_rates`     | `blaze_get_fx_rates`    |
| FX quote   | `blaze_fx_quote`     | `blaze_create_fx_quote` |

Every other shared tool uses an **identical name** across both surfaces. The two
catalogs are also not one-to-one: some MCP tools have no agent equivalent and
some agent tools have no MCP equivalent — these surface differences are
intentional. See [`docs/cli-functionality-map.md`](./cli-functionality-map.md)
for the canonical, audited catalog of all four surfaces.

---

## Safety rules

The system prompt enforces:

- Check balance before any send/payment
- Confirm with the user before executing any money-moving tool, showing
  recipient + amount
- Check memory before recurring-language requests ("pay my rent") to avoid
  duplicates
- After a successful payment, offer to save it as a pattern if the request used
  role-based language ("my rent", "the cleaner")
- Disambiguate when a search returns multiple results — never assume
- Warn on duplicate payments (same recipient + amount within 24h)
- Never retry after a network error — surface the payment ID and let the user
  check
- Honor "cancel" / "stop" / "abort" at any point — exit without making the
  payment
- For cross-border payments, always fetch an FX quote and show the rate before
  confirming
- When adding a crypto contact on the **Stellar** network, a destination `memo`
  is required (`blaze_add_contact`'s `memo` param) — a Stellar contact can't
  receive USDC without it. If the user hasn't provided one, the agent asks for
  it (found on the recipient's deposit details or exchange) before creating the
  contact.

The model can't override these rules, but the ultimate guarantee is server-side
scope enforcement: a key without `PAYOUTS_WRITE` will be rejected at the API
regardless of what the model intends to do.

---

## Examples

### Read account state

```bash
blaze agent "How much cash do we have?"
blaze agent "What did we spend on software in April?"
blaze agent "Show me my recent contacts"
blaze agent "List my unpaid bills"
```

### Send money

```bash
blaze agent "Send \$50 to @alex with note 'lunch'"
blaze agent "Pay Acme Supplies \$250"
blaze agent "Send 1500 MXN to Maria"           # triggers an FX quote first
```

The agent will:

1. Look up the recipient (and disambiguate if multiple match)
2. For cross-border: fetch an FX quote and show the rate
3. Ask "Send $X USD to Y?" — wait for `yes`
4. Call the payment tool
5. Log to agent memory

### Pay a bill (two-phase)

```bash
blaze agent "Pay the AWS bill"
```

The agent will:

1. List bills, find the AWS one
2. Call `blaze_quote_bill_payment` — print amount, fees, ETA
3. Wait for explicit `yes`
4. Call `blaze_pay_bill` with the fresh `quote_id` and `confirm: true`

If the bill is over a policy threshold (server-side `BillsPolicyEngine`), the
agent will report that the payment needs human approval out-of-band — it cannot
bypass.

### Recurring patterns

```bash
# First time — agent pays, then offers to save as a pattern
blaze agent "Pay my landlord \$2000 for rent"

# Next time — agent recalls the pattern and asks to confirm
blaze agent "Pay my rent"
```

Patterns live in `~/.blaze/agent-memory.md`. Manage them with `blaze memory`.

---

## Comparison with CLI commands

Agent mode is a convenience layer over the direct CLI surface. Roughly
equivalent invocations:

| Agent                                    | Direct CLI                                              |
| ---------------------------------------- | ------------------------------------------------------- |
| `agent "balance"`                        | `balance`                                               |
| `agent "how much cash do we have?"`      | `insights balances`                                     |
| `agent "what did we spend on software?"` | `insights summary`                                      |
| `agent "send $50 to @alex"`              | `send @alex --amount 50`                                |
| `agent "pay Acme Supplies $250"`         | `contacts pay "Acme Supplies" --amount 250`             |
| `agent "list my unpaid bills"`           | `bills list --status unpaid`                            |
| `agent "pay the AWS bill"`               | `bills pay <id>` (quote-then-confirm flow is identical) |
| `agent "show me my contacts"`            | `contacts list`                                         |

Use agent mode for quick, ambiguous, or compound requests; use direct CLI
commands when you need exact flag control or fully scriptable, deterministic
output.
