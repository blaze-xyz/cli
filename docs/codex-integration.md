# Blaze CLI + Codex: Business Integration Guide

Comprehensive guide for businesses using Blaze CLI with Claude Code, Codex, and AI agents for automated financial operations.

> **Prerequisites**: This guide assumes you've completed the [basic MCP setup](mcp.md). If you haven't configured your AI agent with Blaze yet, start there first.

## Who Should Use This Guide

- **Finance teams** automating accounts payable and spend reporting
- **Operations managers** streamlining recurring bill payments
- **Business owners** seeking AI-powered financial insights
- **Developers** building custom agent workflows for financial operations

## Five Integration Patterns

Blaze CLI offers multiple ways to integrate with AI agents. Choose the pattern that best fits your workflow.

### Pattern 1: Direct MCP Tool Usage

**Best for**: Single, well-defined operations with clear parameters.

The AI agent directly invokes Blaze MCP tools to perform specific actions. This is the most straightforward pattern for simple queries.

**Example interactions**:
```
User: "What's my account balance?"
Agent: [Uses blaze_get_balance]
Result: { available: $12,450.00, pending: $500.00 }

User: "Show me all transfers from last month"
Agent: [Uses blaze_list_transfers with date filters]
Result: [List of 23 transfers totaling $45,320]
```

**When to use**:
- Checking balances
- Listing customers, transactions, or transfers
- Getting FX rates or quotes
- Single-step operations with clear inputs

**Available tools**: 82 MCP tools organized by domain. See full list in [mcp.md](mcp.md).

---

### Pattern 2: Agent CLI Mode

**Best for**: Natural language workflows that parse complex intent.

The agent uses `blaze agent "<command>"` to parse natural language into CLI commands, then executes them.

**Example interaction**:
```
User: "Pay my rent to John Smith, $2,500 for May"
Agent: [Uses blaze agent mode to parse intent]
Agent: Executing: blaze send --to john@example.com --amount 2500 --note "Rent - May 2026"
Result: Transfer created, $2,500 sent to John Smith
```

**How it works**:
1. User provides natural language instruction
2. Agent parses intent using LLM
3. Agent constructs appropriate CLI command
4. Agent executes command via `blaze agent` wrapper
5. Agent returns structured result

**When to use**:
- Complex multi-step operations
- Ambiguous instructions requiring interpretation
- Workflows combining multiple tools
- User prefers conversational interface

See [agent.md](agent.md) for full agent mode documentation.

---

### Pattern 3: Skill-Based Delegation

**Best for**: Reusable multi-step workflows with clear inputs/outputs.

Pre-built agent skills encapsulate common workflows into tested, documented patterns.

**Example skill**: Send Transfer to Customer

```markdown
## What it does
Finds or creates a customer by email, then creates a transfer.

## Prerequisites
- Blaze CLI authenticated
- Valid customer email
- Sufficient account balance

## Workflow
1. Call blaze_list_customers with email filter
2. If no customer exists, call blaze_create_customer
3. Call blaze_create_transfer with customer_id
4. Return transfer confirmation
```

**When to use**:
- Repeatedly performing the same multi-step flow
- Team needs consistent execution patterns
- Onboarding new agents or team members
- Building a library of approved workflows

---

### Pattern 4: Sub-Agent Investigation

**Best for**: Specialized diagnostic tasks that preserve main context.

Spawn parallel sub-agents with different MCP access to investigate complex issues without cluttering the main conversation.

**Example scenario**: Investigating why a transaction failed

```
Main Agent: [Spawns 3 sub-agents in parallel]
  - database-investigator: Query transaction + user records
  - logs-investigator: Search logs for error traces
  - provider-investigator: Check provider API status

[Sub-agents complete in parallel]

Main Agent: "Transaction failed due to insufficient funds at provider level.
User had $100 balance, but provider required $102 (including $2 fee)."
```

**When to use**:
- Debugging production failures
- Root cause analysis across multiple systems
- Preserving main context for user interaction
- Parallel data gathering from different sources

---

### Pattern 5: SDK Integration in Custom Scripts

**Best for**: Programmatic automation beyond CLI capabilities.

Use the TypeScript SDK directly in custom Node.js scripts for scheduled jobs, batch operations, or custom business logic.

**Example**: Monthly invoicing automation

```typescript
import { BlazeClient } from "@blaze-money/cli"

const client = new BlazeClient({ apiKey: process.env.BLAZE_API_KEY })

async function generateMonthlyInvoices() {
  // Get all active customers
  const customers = await client.listCustomers({ limit: 100 })
  
  for (const customer of customers.data) {
    // Create invoice for each customer
    await client.createInvoice({
      customer_id: customer.id,
      line_items: [
        {
          description: "Monthly subscription - Pro Plan",
          quantity: 1,
          unit_price: 9900, // $99.00
        },
      ],
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    })
    
    console.log(`Invoice created for ${customer.email}`)
  }
}

generateMonthlyInvoices()
```

**When to use**:
- Scheduled batch operations (cron jobs)
- Complex business logic requiring loops/conditionals
- Integration with other systems (CRM, accounting)
- Custom reporting or data exports

See [sdk.md](sdk.md) for full SDK documentation and [examples/](../examples/) for more code samples.

---

## Common Business Workflows

### Workflow 1: Business Spend Insights

**Use case**: Finance team wants weekly spend reports without manual data entry.

**Tools used**:
- `blaze_get_spending_summary`
- `blaze_list_bank_transactions`
- `blaze_get_bank_balances`

**Example interaction**:

```
CFO: "Show me our software spend this month"

Agent: [Uses blaze_get_spending_summary with current month dates]
Result: {
  total_spend: $12,450,
  by_category: {
    "Software & Services": $8,920,
    "Cloud Infrastructure": $3,530
  },
  top_merchants: [
    { name: "AWS", amount: $5,200 },
    { name: "Vercel", amount: $2,100 },
    { name: "GitHub", amount: $800 }
  ]
}

CFO: "What's our current bank balance?"

Agent: [Uses blaze_get_bank_balances]
Result: { 
  accounts: [
    { name: "Operating Account", available: $45,200 },
    { name: "Payroll Account", available: $123,500 }
  ]
}
```

**Value proposition**:
- Save 10+ hours/month on manual categorization
- Real-time spend visibility
- Data-driven vendor negotiation
- Automated compliance reporting

---

### Workflow 2: Automated Bill Payment (Human-in-the-Loop)

**Use case**: Operations team pays 30+ recurring bills monthly with approval workflow.

**Tools used**:
- `blaze_list_bills`
- `blaze_quote_bill_payment`
- `blaze_pay_bill`
- `blaze_approve_bill`

**Example interaction**:

```
Manager: "Show me bills due this week"

Agent: [Uses blaze_list_bills with due_before=2026-05-31]
Result: [
  { id: "bill_1", vendor: "AWS", amount: $2,100, due: "2026-05-30" },
  { id: "bill_2", vendor: "Slack", amount: $800, due: "2026-05-28" },
  { id: "bill_3", vendor: "GitHub", amount: $200, due: "2026-05-29" }
]

Manager: "Get quotes for all three"

Agent: [Uses blaze_quote_bill_payment for each bill in parallel]
Result: [
  { quote_id: "quote_1", bill_id: "bill_1", total: $2,102, fee: $2, eta: "1 business day" },
  { quote_id: "quote_2", bill_id: "bill_2", total: $801, fee: $1, eta: "same-day" },
  { quote_id: "quote_3", bill_id: "bill_3", total: $201, fee: $1, eta: "same-day" }
]

Manager: "Pay the AWS bill"

Agent: [Uses blaze_pay_bill with quote_1, confirm=true]
Result: { payment_id: "pmt_abc123", status: "Payment initiated" }
```

**Safety mechanisms**:
- **Quote-then-confirm pattern**: Always show quote before payment
- **Server-side policy**: High-value bills may require additional approval
- **Audit trail**: Every action logged
- **Human approval**: Agent cannot bypass approval requirements

**Value proposition**:
- Reduce manual data entry (30+ bills/month → 0 manual entries)
- Eliminate late payment fees
- Clear audit trail for every payment

---

### Workflow 3: P2P Payments for Freelancer Payouts

**Use case**: HR manager pays 100+ freelancers weekly across 12 countries.

**Tools used**:
- `blaze_send_money` (convenience wrapper)
- `blaze_create_transfer`

**Example interaction**:

```
Manager: "Send $500 to maria@example.com for Project Alpha"

Agent: [Uses blaze_send_money]
Result: {
  transfer_id: "txn_xyz789",
  amount: $500.00,
  recipient: "Maria Santos",
  status: "Pending",
  eta: "1 business day"
}

Manager: "Send bulk payments from this CSV"

Agent: [Reads CSV, creates batch transfers]
Result: ✓ 15/15 successful, total: $12,750, fees: $38.25
```

**Value proposition**:
- Process 100+ payouts in minutes vs hours
- Multi-currency support (USD, MXN, EUR, BRL, etc.)
- Automatic customer creation for new recipients
- Transparent fee calculation upfront

---

### Workflow 4: Payment Link Generation for Sales Teams

**Use case**: Sales team creates payment links for customer invoices on demand.

**Tools used**:
- `blaze_create_payment_link`
- `blaze_list_payment_links`

**Example interaction**:

```
Sales Rep: "Create a payment link for $2,500 for Acme Corp's Q1 subscription"

Agent: [Uses blaze_create_payment_link]
Result: {
  url: "https://pay.blaze.money/links/lnk_abc123",
  amount: $2,500,
  expires_at: "2026-06-27"
}

Agent: "Payment link created. Want me to send it to billing@acme.com?"
```

**Value proposition**:
- Instant payment link creation
- No manual invoice formatting
- Automated payment tracking
- Metadata for accounting reconciliation

---

### Workflow 5: Webhook-Driven Reconciliation Automation

**Use case**: Finance team reconciles 1,000+ daily transactions automatically.

**Setup**:

```typescript
// 1. Create webhook endpoint
await client.createWebhook({
  url: "https://your-app.com/webhooks/blaze",
  events: ["payment.completed", "payout.succeeded"],
  enabled: true,
})

// 2. Handle webhook in your app
app.post("/webhooks/blaze", async (req, res) => {
  const event = req.body
  
  if (event.type === "payment.completed") {
    // Match to order in your system
    const order = await findOrderById(event.data.metadata.order_id)
    
    // Update accounting system
    await markInvoiceAsPaid({
      invoice_id: order.invoice_id,
      amount: event.data.amount,
    })
    
    console.log(`Auto-reconciled payment for order ${order.id}`)
  }
  
  res.sendStatus(200)
})
```

**Value proposition**:
- Zero manual reconciliation for matching transactions
- Real-time updates to accounting systems
- Exception-only human review

---

## Security & Safety Model

### Production Database: Read-Only Access

AI agents have **read-only access** to production data by design.

**Read-only tools**:
- All `blaze_list_*` operations
- All `blaze_get_*` operations  
- `blaze_get_balance`
- `blaze_get_spending_summary`

**Write operations require explicit confirmation**:
- All `blaze_create_*` operations
- All `blaze_update_*` operations
- `blaze_pay_bill` (irrevocable payment)

---

### API Key Scopes: Principle of Least Privilege

Create **scoped API keys** that grant only the permissions an agent needs:

```bash
# Read-only reporting agent
blaze api-keys create \
  --name "Analytics Agent" \
  --scopes balance:read,transactions:read,customers:read \
  --expires-in-days 90

# Payment collection agent
blaze api-keys create \
  --name "Billing Agent" \
  --scopes customers:read,customers:write,transactions:write \
  --expires-in-days 90
```

**Recommended scope sets**:

| Agent Type | Scopes |
|-----------|--------|
| Read-only reporting | `balance:read`, `transactions:read`, `customers:read` |
| Customer management | `customers:read`, `customers:write` |
| Payment collection | `customers:read`, `customers:write`, `transactions:write` |

See [authentication.md](authentication.md) for full scope documentation.

---

### Quote-Then-Confirm Pattern for Bill Payments

Bill payments follow a **two-phase pattern** to ensure human oversight:

**Phase 1: Quote**
```typescript
// Agent gets quote first
const quote = await client.quoteBillPayment({
  billId: "bill_123",
})

// Show quote to user - amount, fee, ETA
```

**Phase 2: Confirm**
```typescript
// User confirms → agent executes
const payment = await client.payBill({
  billId: "bill_123",
  quoteId: quote.id, // Fresh quote required
  confirm: true, // Must be literally true
})
```

**Safety mechanisms**:
- Quote expires in 15 minutes
- `confirm` parameter must be literally `true`
- Server enforces policy (high-value bills may require approval)
- Cannot pay without surfacing quote to user first

---

### Environment Isolation: Test vs Live Keys

Always use **test API keys** for experimentation:

```bash
# Development/testing
export BLAZE_API_KEY="sk_test_..."

# Production (only when ready)
export BLAZE_API_KEY="sk_live_..."
```

Test keys hit the sandbox environment with fake money and simulated responses.

---

## Setup for Different AI Clients

### Claude Code (Recommended)

```bash
# 1. Install and authenticate (no API key needed)
npm install -g @blaze-money/cli
blaze auth

# 2. Select your business
blaze businesses list
blaze businesses use <your-business-id>

# 3. Add the MCP server
claude mcp add blaze -- npx -y @blaze-money/cli mcp

# 4. Install the Blaze skill (teaches Claude when and how to use Blaze tools)
claude skill add $(npm root -g)/@blaze-money/cli/skills/blaze
```

The skill ensures Claude routes financial questions to Blaze tools and knows the correct workflow for each operation.

---

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

No API key needed — uses your `blaze auth` session. Restart Claude Desktop after saving.

---

### Cursor / Windsurf

Add to `.cursor/mcp.json` (or `.windsurf/mcp.json`):

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

---

### Codex

```bash
codex --full-auto \
  --mcp-config '{"blaze":{"command":"npx","args":["-y","@blaze-money/cli","mcp"]}}'
```

---

### Legacy: API Key Authentication

For CI/CD or headless environments, use an API key instead of browser auth:

```bash
export BLAZE_API_KEY="sk_live_..."
```

See [mcp.md](mcp.md) for detailed setup instructions.

---

## Troubleshooting

### Authentication Failures

**Solutions**:
1. Verify API key: `echo $BLAZE_API_KEY`
2. Test key: `blaze auth whoami`
3. Check expiration: `blaze api-keys list`

### MCP Server Not Found

**Solutions**:
1. Verify MCP config location
2. Restart AI client after config changes
3. Test manually: `npx -y @blaze-money/cli mcp`
4. Clear npx cache: `npx clear-npx-cache`

### Tool Invocation Errors

**Solutions**:
1. Check required parameters
2. Verify data types (string vs number)
3. Currency codes must be uppercase (USD)
4. Dates must be ISO 8601 (YYYY-MM-DD)

### Rate Limiting

**Solutions**:
1. Implement exponential backoff
2. Reduce parallel tool calls
3. Cache frequently accessed data
4. Contact support for limit increase

---

## Best Practices

### 1. Use Test Keys for Experimentation

Always start with test API keys. Only switch to live when ready.

### 2. Create Scoped Keys for Different Agents

Don't reuse the same key. Create scoped keys to limit blast radius.

### 3. Monitor Agent Activity

Review agent operations in Dashboard → API Logs.

### 4. Set Up Webhooks

Track agent-initiated payments via webhooks for audit trail.

### 5. Document Custom Skills

When a workflow works well, document it as a skill for team reuse.

### 6. Rotate Keys Every 90 Days

Set expiration when creating keys:

```bash
blaze api-keys create --expires-in-days 90
```

### 7. Use Metadata for Tracking

Add metadata to all agent-initiated operations:

```typescript
await client.createTransfer({
  amount: 500,
  metadata: {
    initiated_by: "agent",
    workflow: "freelancer_payout"
  }
})
```

---

## Resources

- [SDK Reference](sdk.md)
- [CLI Reference](cli.md)
- [MCP Setup](mcp.md)
- [Agent Mode](agent.md)
- [Examples](../examples/)
- [GitHub Repository](https://github.com/blaze-xyz/cli)

---

## Next Steps

1. **Start with test keys**: Experiment safely in sandbox
2. **Try Pattern 1**: Direct MCP tool usage for simple queries
3. **Build a custom workflow**: Use Pattern 5 (SDK) for your use case
4. **Document as skill**: Share with your team
5. **Go live**: Switch to production keys when ready

Questions? [Email support](mailto:support@blaze.money) or [open an issue](https://github.com/blaze-xyz/cli/issues).
