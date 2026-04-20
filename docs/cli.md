# CLI Reference

The Blaze CLI provides command-line access to your Blaze account. Manage customers, transfers, payment links, and more directly from your terminal.

## Installation

```bash
# Install globally
npm install -g @blaze-money/cli

# Or run directly with npx
npx @blaze-money/cli balance
```

After installing, the `blaze` command is available in your shell.

## Global Options

These flags can be passed to any command.

| Flag | Description |
|------|-------------|
| `--api-key <key>` | Override the API key for this invocation |
| `--base-url <url>` | Override the API base URL |
| `--format <json\|table>` | Output format. Defaults to `table` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BLAZE_API_KEY` | API key. Takes precedence over the config file but not the `--api-key` flag. |
| `BLAZE_BASE_URL` | API base URL override. |

See [Authentication](./authentication.md) for full details on key resolution order.

---

## auth

Manage authentication credentials.

### auth login

Store an API key in the local config file.

```bash
blaze auth login --api-key sk_test_your_key_here
```

| Flag | Required | Description |
|------|----------|-------------|
| `--api-key <key>` | Yes | The API key to store |

The key is saved to `~/.blaze/config.json`.

### auth whoami

Check the currently configured API key and account status.

```bash
blaze auth whoami
```

**Example output:**

```
Authenticated
Environment: test
Balance: $1,250.00 USD (pending: $50.00)
```

---

## balance

Display your account balance.

```bash
blaze balance
```

**Table output:**

```
Available    Pending    Currency
$1,250.00    $50.00    USD
```

**JSON output:**

```bash
blaze balance --format json
```

```json
{
  "object": "balance",
  "available": 1250,
  "pending": 50,
  "currency": "USD"
}
```

---

## customers

Manage customers.

### customers list

```bash
blaze customers list [--limit N] [--email EMAIL] [--include-archived]
```

| Flag | Description |
|------|-------------|
| `--limit N` | Max results to return (1-100) |
| `--email EMAIL` | Filter by exact email |
| `--include-archived` | Include archived customers |

**Example:**

```bash
blaze customers list --limit 5
```

```
ID             Email                  Name          Created
cus_abc123     john@example.com       John Doe      2025-03-15
cus_def456     jane@example.com       Jane Smith    2025-03-10
```

### customers get

```bash
blaze customers get <id>
```

**Example:**

```bash
blaze customers get cus_abc123
```

### customers create

```bash
blaze customers create --email <email> [--first-name NAME] [--last-name NAME] [--phone PHONE]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--email <email>` | Yes | Customer email |
| `--first-name <name>` | No | First name |
| `--last-name <name>` | No | Last name |
| `--phone <phone>` | No | Phone number |

**Example:**

```bash
blaze customers create --email john@example.com --first-name John --last-name Doe
```

### customers update

```bash
blaze customers update <id> [--first-name NAME] [--last-name NAME] [--phone PHONE]
```

| Flag | Description |
|------|-------------|
| `--first-name <name>` | Update first name |
| `--last-name <name>` | Update last name |
| `--phone <phone>` | Update phone number |

**Example:**

```bash
blaze customers update cus_abc123 --phone "+1-555-0200"
```

### customers archive

Soft-delete a customer.

```bash
blaze customers archive <id>
```

**Example:**

```bash
blaze customers archive cus_abc123
```

---

## transfers

Manage transfers between accounts.

### transfers list

```bash
blaze transfers list [--limit N] [--status STATUS]
```

| Flag | Description |
|------|-------------|
| `--limit N` | Max results to return (1-100) |
| `--status STATUS` | Filter by status (e.g. `pending`, `completed`, `failed`) |

**Example:**

```bash
blaze transfers list --status completed --limit 10
```

### transfers get

```bash
blaze transfers get <id>
```

### transfers create

```bash
blaze transfers create --amount N [--currency CODE] [--customer-id ID] [--destination-type TYPE] [--destination-id ID] [--note TEXT]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--amount N` | Yes | Transfer amount |
| `--currency CODE` | No | Currency code (defaults to `USD`) |
| `--customer-id ID` | No | Customer ID |
| `--destination-type TYPE` | No | `wallet`, `external_account`, `virtual_account`, or `payment_link` |
| `--destination-id ID` | No | Destination resource ID |
| `--note TEXT` | No | Transfer note |

**Example:**

```bash
blaze transfers create --amount 500 --currency USD --customer-id cus_abc123 --destination-type external_account --destination-id ext_xyz789 --note "Invoice #1234"
```

---

## withdrawals

Manage withdrawals to external accounts.

### withdrawals list

```bash
blaze withdrawals list [--limit N] [--status STATUS]
```

| Flag | Description |
|------|-------------|
| `--limit N` | Max results to return (1-100) |
| `--status STATUS` | Filter by status |

### withdrawals get

```bash
blaze withdrawals get <id>
```

### withdrawals create

```bash
blaze withdrawals create --external-account-id <id> --amount N [--currency CODE] [--note TEXT]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--external-account-id <id>` | Yes | External account to withdraw to |
| `--amount N` | Yes | Withdrawal amount |
| `--currency CODE` | No | Currency code (defaults to `USD`) |
| `--note TEXT` | No | Withdrawal note |

**Example:**

```bash
blaze withdrawals create --external-account-id ext_xyz789 --amount 1000 --note "Monthly payout"
```

---

## payment-links

Manage shareable payment links.

### payment-links list

```bash
blaze payment-links list [--limit N] [--status STATUS]
```

| Flag | Description |
|------|-------------|
| `--limit N` | Max results to return (1-100) |
| `--status STATUS` | Filter by status (e.g. `active`, `completed`, `cancelled`) |

### payment-links get

```bash
blaze payment-links get <id>
```

### payment-links create

```bash
blaze payment-links create --amount N [--currency CODE] [--name TEXT] [--note TEXT] [--success-url URL]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--amount N` | Yes | Payment amount |
| `--currency CODE` | No | Currency code (defaults to `USD`) |
| `--name TEXT` | No | Display name |
| `--note TEXT` | No | Note or description |
| `--success-url URL` | No | Redirect URL after successful payment |

**Example:**

```bash
blaze payment-links create --amount 75 --name "Invoice #42" --success-url "https://example.com/thanks"
```

```
Payment link created:
  ID:     pml_abc123
  URL:    https://pay.blaze.money/pml_abc123
  Amount: $75.00 USD
  Status: active
```

### payment-links update

```bash
blaze payment-links update <id> [--name TEXT] [--note TEXT]
```

| Flag | Description |
|------|-------------|
| `--name TEXT` | Update display name |
| `--note TEXT` | Update note |

### payment-links cancel

```bash
blaze payment-links cancel <id>
```

**Example:**

```bash
blaze payment-links cancel pml_abc123
```

---

## accounts

Manage external accounts (bank accounts and crypto wallets) attached to customers.

### accounts list

```bash
blaze accounts list --customer-id <id>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--customer-id <id>` | Yes | Customer ID |

### accounts create

```bash
blaze accounts create --customer-id <id> --type <type> [bank/crypto fields]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--customer-id <id>` | Yes | Customer ID |
| `--type <type>` | Yes | `us_bank`, `iban`, or `crypto_wallet` |

**Additional flags for US bank accounts:**

| Flag | Description |
|------|-------------|
| `--account-holder-name` | Name on the account |
| `--bank-name` | Bank name |
| `--routing-number` | Routing number |
| `--account-number` | Account number |
| `--country-code` | Country code |

**Additional flags for IBAN accounts:**

| Flag | Description |
|------|-------------|
| `--account-holder-name` | Name on the account |
| `--iban` | IBAN |
| `--country-code` | Country code |

**Additional flags for crypto wallets:**

| Flag | Description |
|------|-------------|
| `--wallet-address` | Wallet address |
| `--network` | Network: `stellar`, `ethereum`, `polygon`, `solana`, or `base` |

**Example:**

```bash
blaze accounts create --customer-id cus_abc123 --type us_bank --routing-number 021000021 --account-number 123456789 --account-holder-name "John Doe"
```

### accounts delete

```bash
blaze accounts delete --customer-id <id> --account-id <id>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--customer-id <id>` | Yes | Customer ID |
| `--account-id <id>` | Yes | External account ID |

---

## recipients

Manage recipients (shorthand for customer + external account workflows).

### recipients list

```bash
blaze recipients list [--limit N]
```

### recipients add

```bash
blaze recipients add [fields]
```

### recipients remove

```bash
blaze recipients remove <id>
```

---

## transactions

View transaction history.

### transactions list

```bash
blaze transactions list [--limit N] [--type TYPE] [--status STATUS]
```

| Flag | Description |
|------|-------------|
| `--limit N` | Max results to return (1-100) |
| `--type TYPE` | Filter by transaction type |
| `--status STATUS` | Filter by status |

**Example:**

```bash
blaze transactions list --limit 5 --status completed
```

```
ID             Type       Amount       Status       Created
txn_abc123     transfer   $500.00      completed    2025-03-15
txn_def456     withdrawal $1,000.00    completed    2025-03-14
```

### transactions get

```bash
blaze transactions get <id>
```

---

## agent

Run natural language commands through the agent mode. See [Agent Mode](./agent.md) for full details.

```bash
blaze agent "<command>"
```

**Examples:**

```bash
blaze agent "send $500 to john@example.com"
blaze agent "check balance"
blaze agent "list transactions 5"
```

---

## api-keys

Manage API keys for programmatic access.

### api-keys list

```bash
blaze api-keys list
```

Lists all API keys with their name, prefix, scopes, and status.

### api-keys create

```bash
blaze api-keys create --name <name> --scopes <scopes> [--test] [--expires-in-days <n>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--name <name>` | Yes | Friendly name for the key |
| `--scopes <scopes>` | Yes | Comma-separated permission scopes |
| `--test` | No | Create a test key instead of live |
| `--expires-in-days <n>` | No | Days until key expires |

**Example:**

```bash
blaze api-keys create --name "CI Pipeline" --scopes TRANSACTIONS_READ,BALANCE_READ --test --expires-in-days 90
```

### api-keys update

```bash
blaze api-keys update <id> --scopes <scopes>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--scopes <scopes>` | Yes | New comma-separated permission scopes |

### api-keys revoke

```bash
blaze api-keys revoke <id> [--reason <reason>] [--yes]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--reason <reason>` | No | Reason for revocation |
| `--yes` | No | Skip confirmation prompt |

**Example:**

```bash
blaze api-keys revoke key_abc123 --reason "Employee offboarded" --yes
```

---

## team

Manage team members and invitations.

### team list

```bash
blaze team list
```

Lists all team members with their email, role, and status.

### team invitations

```bash
blaze team invitations
```

Lists pending invitations that have not yet been accepted.

### team invite

```bash
blaze team invite --email <email> --role <role>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--email <email>` | Yes | Email address to invite |
| `--role <role>` | Yes | Role: `admin`, `finance`, `support`, `developer`, `view_only`, `member` |

**Example:**

```bash
blaze team invite --email jane@company.com --role developer
```

### team update-role

```bash
blaze team update-role <id> --role <role>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--role <role>` | Yes | New role to assign |

### team remove

```bash
blaze team remove <id> [--yes]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--yes` | No | Skip confirmation prompt |

### team transfer-ownership

```bash
blaze team transfer-ownership --new-owner-id <id> [--yes]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--new-owner-id <id>` | Yes | Team member ID of the new owner |
| `--yes` | No | Skip confirmation prompt |

---

## webhooks

Manage webhook endpoints.

### webhooks list

```bash
blaze webhooks list [--limit <n>]
```

| Flag | Description |
|------|-------------|
| `--limit <n>` | Max results to return (1-100) |

### webhooks get

```bash
blaze webhooks get <id>
```

### webhooks create

```bash
blaze webhooks create --url <url> [--events <events>] [--description <desc>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--url <url>` | Yes | HTTPS URL to receive events |
| `--events <events>` | No | Comma-separated event types to subscribe to |
| `--description <desc>` | No | Description of the endpoint |

**Example:**

```bash
blaze webhooks create --url "https://example.com/webhooks" --events "payment.completed,payment.failed" --description "Production notifications"
```

### webhooks update

```bash
blaze webhooks update <id> [--url <url>] [--events <events>] [--enabled] [--disabled] [--description <desc>]
```

| Flag | Description |
|------|-------------|
| `--url <url>` | New URL |
| `--events <events>` | New comma-separated event subscriptions |
| `--enabled` | Enable the endpoint |
| `--disabled` | Disable the endpoint |
| `--description <desc>` | Updated description |

### webhooks delete

```bash
blaze webhooks delete <id> [--yes]
```

| Flag | Description |
|------|-------------|
| `--yes` | Skip confirmation prompt |

---

## analytics

View transaction analytics.

### analytics overview

```bash
blaze analytics overview [--period <period>]
```

| Flag | Description |
|------|-------------|
| `--period <period>` | Time period for analytics |

**Available periods:** `LAST_7_DAYS`, `LAST_30_DAYS`, `LAST_90_DAYS`, `LAST_365_DAYS`

**Example:**

```bash
blaze analytics overview --period LAST_7_DAYS
```

```
Period: 2025-03-08 - 2025-03-15
Volume:        $12,500.00
Transactions:  45
Successful:    42 (93.3%)
Failed:        2
Pending:       1
Avg size:      $277.78
```

---

## disputes

Manage payment disputes.

### disputes list

```bash
blaze disputes list [--limit <n>] [--status <status>]
```

| Flag | Description |
|------|-------------|
| `--limit <n>` | Max results to return (1-100) |
| `--status <status>` | Filter by status (e.g. `open`, `under_review`, `won`, `lost`) |

### disputes get

```bash
blaze disputes get <id>
```

### disputes submit-evidence

```bash
blaze disputes submit-evidence <id> --description <desc> [--document-urls <urls>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--description <desc>` | Yes | Evidence description |
| `--document-urls <urls>` | No | Comma-separated URLs to supporting documents |

**Example:**

```bash
blaze disputes submit-evidence dsp_abc123 --description "Service delivered as agreed" --document-urls "https://storage.example.com/receipt.pdf"
```

### disputes close

```bash
blaze disputes close <id>
```

---

## invoices

Manage invoices.

### invoices list

```bash
blaze invoices list [--limit <n>] [--status <status>] [--customer-id <id>]
```

| Flag | Description |
|------|-------------|
| `--limit <n>` | Max results to return (1-100) |
| `--status <status>` | Filter by status (e.g. `draft`, `sent`, `paid`, `void`) |
| `--customer-id <id>` | Filter by customer |

### invoices get

```bash
blaze invoices get <id>
```

### invoices create

```bash
blaze invoices create --customer-id <id> --line-items <json> [--tax <n>] [--description <desc>] [--due-date <date>] [--currency <code>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--customer-id <id>` | Yes | Customer to invoice |
| `--line-items <json>` | Yes | JSON array of line items |
| `--tax <n>` | No | Tax amount |
| `--description <desc>` | No | Invoice description |
| `--due-date <date>` | No | Due date (ISO 8601) |
| `--currency <code>` | No | Currency code (defaults to `USD`) |

**Example:**

```bash
blaze invoices create --customer-id cus_abc123 --line-items '[{"description":"Web Dev","unit_price":5000}]' --tax 250 --due-date 2025-05-01
```

### invoices send

```bash
blaze invoices send <id>
```

Sends the invoice to the customer via email.

### invoices mark-paid

```bash
blaze invoices mark-paid <id>
```

Manually marks the invoice as paid.

### invoices void

```bash
blaze invoices void <id>
```

Voids the invoice. This action cannot be undone.

---

## subscriptions

Manage recurring billing subscriptions.

### subscriptions list

```bash
blaze subscriptions list [--limit <n>] [--status <status>] [--customer-id <id>]
```

| Flag | Description |
|------|-------------|
| `--limit <n>` | Max results to return (1-100) |
| `--status <status>` | Filter by status (e.g. `active`, `paused`, `canceled`) |
| `--customer-id <id>` | Filter by customer |

### subscriptions get

```bash
blaze subscriptions get <id>
```

### subscriptions create

```bash
blaze subscriptions create --customer-id <id> --product-id <id> [--interval <interval>]
```

| Flag | Required | Description |
|------|----------|-------------|
| `--customer-id <id>` | Yes | Customer ID |
| `--product-id <id>` | Yes | Product ID to subscribe to |
| `--interval <interval>` | No | Billing interval (e.g. `monthly`, `yearly`) |

**Example:**

```bash
blaze subscriptions create --customer-id cus_abc123 --product-id prod_xyz789 --interval monthly
```

### subscriptions cancel

```bash
blaze subscriptions cancel <id> [--immediately]
```

| Flag | Description |
|------|-------------|
| `--immediately` | Cancel immediately instead of at period end |

### subscriptions pause

```bash
blaze subscriptions pause <id>
```

Pauses an active subscription. Billing stops until resumed.

### subscriptions resume

```bash
blaze subscriptions resume <id>
```

Resumes a paused subscription.

---

## fx

Get exchange rates and create FX quotes.

### fx rates

```bash
blaze fx rates [--base <currency>]
```

| Flag | Description |
|------|-------------|
| `--base <currency>` | Base currency code (defaults to `USD`) |

**Example:**

```bash
blaze fx rates --base USD
```

```
Base: USD
MXN:  17.15
EUR:  0.92
GBP:  0.79
BRL:  4.97
```

### fx quote

```bash
blaze fx quote --from <currency> --to <currency> --amount <n>
```

| Flag | Required | Description |
|------|----------|-------------|
| `--from <currency>` | Yes | Source currency code |
| `--to <currency>` | Yes | Target currency code |
| `--amount <n>` | Yes | Amount in source currency |

**Example:**

```bash
blaze fx quote --from USD --to MXN --amount 1000
```

```
Quote ID:     fxq_abc123
From:         $1,000.00 USD
To:           $17,150.00 MXN
Rate:         17.15
Expires:      2025-03-15T12:30:00Z
```

---

## Output Formats

All commands support two output formats via the `--format` flag.

### Table (default)

Human-readable formatted tables. This is the default when `--format` is not specified.

```bash
blaze customers list
```

### JSON

Machine-readable JSON output. Useful for scripting and piping to other tools.

```bash
blaze customers list --format json | jq '.data[].email'
```
