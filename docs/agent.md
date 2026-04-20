# Agent Mode

Agent mode lets you interact with Blaze using natural language commands from your terminal. Instead of remembering exact CLI flags, describe what you want to do in plain English.

```bash
blaze agent "send $500 to john@example.com"
```

## How It Works

The agent processes your command through three stages:

1. **Parser** -- Your natural language input is matched against a set of regex patterns to extract structured data (amount, currency, email, note, etc.).
2. **Intent** -- The parsed data is converted into a typed intent object (`send_money`, `check_balance`, or `list_transactions`).
3. **Orchestrator** -- The intent is executed as a multi-step workflow using the Blaze SDK. Each step is logged to the terminal so you can follow the progress.

If no pattern matches the input, the agent reports that it could not understand the command.

---

## Supported Commands

### Send Money

Send a payment to someone by email. The agent handles customer lookup/creation and transfer creation automatically.

**Patterns:**

```
send $500 to john@example.com
send 500 USD to john@example.com
send $500 USD to john@example.com
pay $500 to John Doe at john@example.com
transfer $500 to john@example.com note "invoice 123"
send 1000 MXN to john@example.com
```

**Accepted syntax:**

| Element | Format | Required |
|---------|--------|----------|
| Verb | `send`, `pay`, or `transfer` | Yes |
| Amount | `$500`, `500`, `1,000.50` | Yes |
| Currency | Three-letter code (e.g. `USD`, `MXN`) | No (defaults to `USD`) |
| Recipient email | Any valid email address | Yes |
| Recipient name | Free text before `at <email>` | No |
| Note | `note "your text here"` | No |

**Examples:**

```bash
# Basic send
blaze agent "send $500 to john@example.com"

# With currency
blaze agent "send 1000 MXN to john@example.com"

# With recipient name
blaze agent "pay $500 to John Doe at john@example.com"

# With note
blaze agent 'transfer $500 to john@example.com note "invoice 123"'
```

### Check Balance

View your current account balance.

**Patterns:**

```
check balance
balance
```

**Example:**

```bash
blaze agent "check balance"
```

### List Transactions

View recent transactions.

**Patterns:**

```
list transactions
show transactions
list transactions 5
show transactions 20
```

The optional number at the end sets the limit (default is 10).

**Examples:**

```bash
blaze agent "list transactions"
blaze agent "show transactions 5"
```

---

## Send Money Flow Walkthrough

When you run `blaze agent "send $500 to john@example.com"`, the orchestrator executes these steps:

**Step 1: Customer Lookup**

The agent searches for an existing customer with the email `john@example.com`.

```
[>>>] Looking up customer: john@example.com
```

If found:
```
[ ->] Customer found: John Doe (cus_abc123)
```

If not found, the agent creates a new customer:
```
[>>>] Customer not found. Creating new customer...
[ + ] Customer created: cus_abc123
```

When a recipient name is provided (e.g. `pay $500 to John Doe at john@example.com`), the name is split into first and last name for the new customer record.

**Step 2: External Account Check**

The agent checks whether the customer has any linked bank accounts or crypto wallets.

```
[>>>] Checking external accounts...
```

If one account is found, it is used as the transfer destination:
```
[ ->] Using account: us_bank ending in 6789
```

If multiple accounts exist, the first one is used:
```
[ i ] 3 accounts found. Using first account.
```

If no accounts are found, the transfer proceeds without a destination (wallet-to-wallet):
```
[ i ] No external accounts found. Creating transfer without destination (wallet-to-wallet).
```

**Step 3: Create Transfer**

The agent creates the transfer with the resolved parameters.

```
[>>>] Creating transfer: $500 USD
[ OK] Transfer created!
{
  "id": "txf_abc123",
  "object": "transfer",
  "status": "pending",
  "amount": 500,
  "currency": "USD",
  ...
}
```

---

## Check Balance Flow

When you run `blaze agent "balance"`:

```
[ OK] Balance: $1250 USD (pending: $50)
```

---

## List Transactions Flow

When you run `blaze agent "show transactions 5"`:

The agent fetches up to 5 recent transactions and prints the full JSON response:

```json
{
  "object": "list",
  "data": [
    {
      "id": "txn_abc123",
      "object": "transaction",
      "type": "transfer",
      "status": "completed",
      "amount": 500,
      "currency": "USD",
      "description": "Transfer to john@example.com",
      "created_at": "2025-03-15T10:30:00Z"
    }
  ],
  "has_more": false,
  "next_cursor": null
}
```

---

## Comparison with CLI Commands

Agent mode is a convenience layer over the standard CLI. The same operations can be performed with explicit commands:

| Agent Command | Equivalent CLI Command |
|---------------|----------------------|
| `blaze agent "send $500 to john@example.com"` | `blaze customers create --email john@example.com` then `blaze transfers create --amount 500 --customer-id cus_abc123` |
| `blaze agent "balance"` | `blaze balance` |
| `blaze agent "list transactions 5"` | `blaze transactions list --limit 5` |

The agent mode is best for quick, common operations. For full control over all parameters (destination type, metadata, source accounts), use the standard CLI commands directly.
