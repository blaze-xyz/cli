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

## setup

Interactive onboarding flow — authenticate, confirm/create a business, and generate an API key. Use this the first time you install the CLI.

```bash
blaze setup
```

Walks through:

1. Pick an authentication method (browser OAuth, JWT token, or paste an existing API key)
2. Confirm an existing business or create a new one
3. Generate a scoped API key (test or live)
4. Verify the key by fetching your balance

The resulting config is saved to `~/.blaze/config.json`. Cancel anytime with Ctrl+C.

---

## whoami

Show the currently active authentication source and business context. Use this whenever a command behaves unexpectedly.

```bash
blaze whoami
```

**Example output:**

```
User:             gerson@blaze.money (usr_abc123)
Auth source:     Bearer token (expires in 29 days)
Active business: Blaze Payments (Admin) — bus_xyz789
API base URL:    https://api.blaze.money
```

Unlike `blaze auth whoami` (which only checks the configured API key), `blaze whoami` includes the active business, the auth source in effect (bearer token vs API key vs config file), and bearer-token expiry.

---

## me

View and update your Blaze profile.

### me show

```bash
blaze me show
```

Shows your name, blazetag, email, phone, and user ID.

### me blazetag

Set or update your blazetag — the `@handle` you use on the Blaze P2P network.

```bash
blaze me blazetag <tag>
```

| Argument | Required | Description |
|---|---|---|
| `<tag>` | Yes | Your new blazetag (e.g. `gerson` → shows as `@gerson`) |

---

## businesses

Manage which business context the CLI uses for requests. Required when your account is a member of one or more businesses and you want the API to return business-scoped data.

### businesses list

```bash
blaze businesses list
```

Lists every business you belong to with your role for each.

### businesses use

Switch the active business context. Subsequent commands will send `x-business-id: <businessId>` so the API returns business-scoped data.

```bash
# Switch into a business
blaze businesses use bus_abc123

# Switch back to personal / consumer mode
blaze businesses use
```

The active business is persisted in `~/.blaze/config.json` and survives between shell sessions. Per-command override: `--business <id>` (force a specific business) or `--personal` (ignore active business for this call).

---

## send

Send a P2P payment to another Blaze user.

```bash
# By blazetag (exact match)
blaze send @alex --amount 25

# By name (fuzzy search; prompts to choose if multiple match)
blaze send "Alex Rivera" --amount 25 --note "Coffee"
```

| Flag | Required | Description |
|---|---|---|
| `<recipient>` | Yes | Positional. Blazetag like `@alex` or a name to fuzzy-search |
| `--amount <n>` | Yes | Amount to send |
| `--currency <code>` | No | Three-letter currency code (default `USD`). Non-USD/USDC routes through an FX quote first |
| `--note <text>` | No | Optional payment note |
| `-y`, `--yes` | No | Skip the confirmation prompt |

`blaze send` only delivers to other Blaze users. To pay an external bank account or crypto wallet, use [contacts pay](#contacts-pay).

---

## contacts

Manage saved external recipients (bank accounts, CLABEs, crypto wallets) and pay them directly. Contacts are CLI-only — they are not exposed through the MCP server.

### contacts list

```bash
blaze contacts list
blaze contacts list --search "Acme"
```

### contacts add

Add a new contact.

```bash
# US bank account
blaze contacts add \
  --first-name Alex --last-name Rivera \
  --phone +14155551234 \
  --type bank \
  --routing-number 121000248 \
  --account-number 1234567890

# Mexican CLABE
blaze contacts add \
  --first-name Maria --last-name Lopez \
  --phone +525555551234 \
  --type clabe --clabe 002180078000001234

# Crypto wallet
blaze contacts add \
  --first-name Pat --last-name Doe \
  --phone +14155555678 \
  --type crypto \
  --wallet-address GABC...XYZ --network stellar
```

### contacts pay

Pay a contact's bank account by name or ID. Confirms before sending (use `-y` to skip).

```bash
blaze contacts pay "Acme Supplies" --amount 250.00
```

| Flag | Required | Description |
|---|---|---|
| `<nameOrId>` | Yes | Contact name (fuzzy search) or CUID |
| `--amount <n>` | Yes | Amount to send |
| `--currency <code>` | No | Defaults to the bank account's currency |
| `--bank-account-id <id>` | No | Pick a specific account (prompts if multiple and omitted) |
| `--note <text>` | No | Optional payment note |
| `-y`, `--yes` | No | Skip the confirmation prompt |

### contacts remove

```bash
blaze contacts remove <id>
blaze contacts remove <id> --yes   # skip confirmation
```

---

## payments

List and inspect P2P payments — the outbound history from `blaze send`.

### payments list

```bash
blaze payments list
blaze payments list --limit 5
```

### payments get

```bash
blaze payments get <id>
```

---

## bills

Accounts Payable bills — Gmail-synced invoice ingestion, approval workflow, and the two-phase quote-then-confirm payment pattern. Requires a business context (`blaze businesses use <id>`) and the `BILLS_PAGE` feature enabled on the business.

### bills list

```bash
blaze bills list
blaze bills list --status unpaid
blaze bills list --vendor-id ven_abc --due-before 2026-06-30 --limit 50
```

### bills show

```bash
blaze bills show <id>
```

### bills approve / bills reject

```bash
blaze bills approve <id>
blaze bills reject <id> --reason "duplicate"
```

### bills pay

Two-phase quote-then-confirm payment. The CLI fetches a quote (amount + fees + ETA), prints it, and waits for your `yes` before executing.

```bash
blaze bills pay <id>
blaze bills pay <id> --from <fundingAccountId> --expedite -y
```

| Flag | Required | Description |
|---|---|---|
| `<id>` | Yes | Bill ID |
| `--from <id>` | No | Source funding account (defaults to the business's default wallet) |
| `--expedite` | No | Pay via expedited routing if available (higher fees) |
| `-y`, `--yes` | No | Skip the confirmation prompt after the quote is shown |

### bills pending-approvals

Bills that require human approval before they can be paid.

```bash
blaze bills pending-approvals list
blaze bills pending-approvals approve <approvalId>
blaze bills pending-approvals reject <approvalId> --reason "wrong amount"
```

### bills logs

Audit-trail entries for compliance review.

```bash
blaze bills logs
blaze bills logs --bill <billId> --category PAYMENT --limit 50
```

### bills vendors list

```bash
blaze bills vendors list
```

### bills connect-gmail

Start the Gmail OAuth flow so Blaze can extract invoices from your inbox.

```bash
blaze bills connect-gmail
blaze bills connect-gmail --no-browser   # print URL only; don't auto-open
```

Prints a URL, waits for you to authenticate, then polls the session for up to 5 minutes.

### bills gmail-integrations

```bash
blaze bills gmail-integrations list
blaze bills gmail-integrations disconnect <id>
```

### bills sync

Force a manual Gmail sync.

```bash
blaze bills sync                          # sync all integrations
blaze bills sync --integration <id>       # sync a single integration
```

### bills setup

Prints onboarding instructions only — no API call.

```bash
blaze bills setup
```

---

## insights

Read-only analytics over the business's Plaid-connected bank accounts. Requires the `SPENDING_INSIGHTS` feature gate enabled on the business and at least one connected bank.

### insights summary

Spending summary by category and top merchants for a date range.

```bash
blaze insights summary
blaze insights summary --period 7d
blaze insights summary --period 30d
blaze insights summary --period 90d
blaze insights summary --period 3m
blaze insights summary --start-date 2026-04-01 --end-date 2026-04-30
```

| Flag | Description |
|---|---|
| `--period <duration>` | Quick range: `7d`, `30d`, `90d`, `1m`, `3m`, `6m`, `1y`. Overrides `--start-date`/`--end-date` when both are passed. |
| `--start-date <iso>` | Filter range start (ISO 8601). Ignored if `--period` is set. |
| `--end-date <iso>` | Filter range end (ISO 8601). Ignored if `--period` is set. |

### insights transactions

Bank transaction line items with merchant + category data.

```bash
blaze insights transactions
blaze insights transactions --period 30d --limit 50
blaze insights transactions \
  --start-date 2026-04-01 --account-id acc_abc --cursor <c>
```

| Flag | Description |
|---|---|
| `--period <duration>` | Quick range: `7d`, `30d`, `90d`, `1m`, `3m`, `6m`, `1y`. Overrides `--start-date`/`--end-date` when both are passed. |
| `--start-date <iso>` | Filter range start (ISO 8601) |
| `--end-date <iso>` | Filter range end (ISO 8601) |
| `--account-id <id>` | Filter to a single connected Plaid account |
| `--limit <n>` | Page size (max 100) |
| `--cursor <c>` | Pagination cursor |

### insights balances

Live current/available balances across all connected bank accounts.

```bash
blaze insights balances
```

All three commands are read-only — they cannot move money.

---

## memory

Manage the agent's local memory file at `~/.blaze/agent-memory.md`. Used by `blaze agent` to recall recurring payment patterns (e.g. "pay my rent") and recent payment history.

### memory show

```bash
blaze memory show
```

### memory clear

Wipe the entire memory file.

```bash
blaze memory clear
blaze memory clear --yes   # skip confirmation
```

### memory forget

Remove a single section by pattern (matches against headings).

```bash
blaze memory forget "rent"
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
