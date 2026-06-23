# Blaze CLI — Complete Functionality Map

## AI Context Summary

**Purpose**: Single authoritative map of everything the `@blaze-money/cli`
package does across all four surfaces (CLI, SDK, MCP server, NL agent) plus the
Claude skill. **Use When**: Onboarding to the CLI, deciding where a new
capability belongs, or reconciling docs against the implementation. **Source**:
Produced by a full read-only audit of `blaze-cli/src/**` (commands, SDK, MCP,
agent) and cross-checked against the Spark backend. Tracks issue #3696.
**Related**: `docs/cli.md`, `docs/sdk.md`, `docs/mcp.md`, `docs/agent.md`,
`skills/blaze/SKILL.md`.

---

The `@blaze-money/cli` package exposes **four surfaces over one Blaze API**: a
command-line interface (`blaze ...`), a TypeScript SDK (`BlazeClient`), an MCP
server (83 registered tools), and a natural-language agent (`blaze agent`), plus
a Claude skill (`skills/blaze/SKILL.md`). It operates in two auth/context modes:

- **Consumer / personal** — bearer token (OAuth device flow). Sends
  `x-blaze-personal: true` by default. Surfaces: `send` (P2P), `contacts`,
  `payments`, `me`, `balance`.
- **Business** — API key (`sk_test_`/`sk_live_`) or `--business <id>`. Sends
  `x-business-id`. Surfaces: `customers`, `transfers`, `withdrawals`,
  `recipients`, `accounts`, `paylinks`, `bills`, `team`, `api-keys`, `webhooks`,
  `analytics`, `insights`, `accounting`.

The split is enforced at the SDK by `client.authContext` (`client.ts:165`:
`consumer` for bearer, `business` for API key) and the server's
`ConsumerOnlyGuard` / tenant middleware.

## 1. Auth, Config & Identity

| Command                      | Subcommands / Flags                                                                                                               | SDK / Endpoint                                                      |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `blaze auth` / `blaze login` | bare → OAuth device flow (`generateDeviceCode`/`pollDeviceToken` GraphQL); `auth login [--api-key]`; `auth whoami`; `auth logout` | `POST {baseUrl}/graphql`; validates API key via `getBalance()`      |
| `blaze logout`               | clears bearer auth                                                                                                                | —                                                                   |
| `blaze setup`                | interactive 4-step onboarding (browser OAuth / JWT / API key); generates API key with all 14 scopes                               | GraphQL `createBusiness`, `createBusinessAPIKey`; REST `getBalance` |
| `blaze whoami`               | shows user, auth source, active business, base URL (falls back to `/v1/team-members` for API-key auth)                            | `GET /v1/me/businesses`, `GET /v1/team-members`                     |
| `blaze me`                   | `me show`, `me blazetag <tag>` — **always `personal: true`**                                                                      | `GET /v1/me`, `PUT /v1/me/blazetag`                                 |
| `blaze businesses`           | `businesses list`; `businesses use [id]` (sets/clears `activeBusinessId` — canonical context switch)                              | `GET /v1/me/businesses`                                             |
| `blaze team`                 | `list`, `invitations`, `invite --email --role`, `update-role <id> --role`, `remove <id>`, `transfer-ownership --new-owner-id`     | `/v1/team-members*`                                                 |
| `blaze api-keys`             | `list`, `create --name --scopes [--test] [--expires-in-days]`, `update <id> --scopes`, `revoke <id> [--reason]`                   | `/v1/api-keys*`                                                     |
| `blaze webhooks`             | `list`, `get <id>`, `create --url [--events] [--description]`, `update <id> [...]`, `delete <id>`                                 | `/v1/webhooks*`                                                     |
| `blaze memory`               | `show`, `clear`, `forget <pattern>` — local file `~/.blaze/agent-memory.md`, **no API**                                           | —                                                                   |

**Global flags** (every command): `--api-key`, `--base-url`,
`--format <json\|table>`, `--personal`, `--business <id>`.

**Credential priority** (`utils.ts:74` `getClient`): explicit
`--api-key`/`BLAZE_API_KEY` > bearer token > config-file `api_key`. **API-key
scopes** (14): `PAYMENT_LINKS_READ/WRITE`, `TRANSACTIONS_READ`,
`PAYOUTS_READ/WRITE`, `CUSTOMERS_READ/WRITE`, `WEBHOOKS_READ/WRITE`,
`BALANCE_READ`, `CHECKOUT_SESSIONS_READ/WRITE`, `REFUNDS_READ/WRITE`.
`PAYOUTS_WRITE` gates withdrawals/transfers.

## 2. Money Movement (the money-out surface)

| Command                         | Required / Optional                                                                                 | SDK / Endpoint                                                                                                   | Context                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `blaze send <recipient>`        | `--amount` (req); `--currency`, `--note`, `-y`                                                      | `sendPayment()` → `POST /v1/payments`                                                                            | consumer P2P (blazetag/name → Blaze user)         |
| `blaze transfers create`        | `--amount` (req); `--currency`, `--customer-id`, `--destination-type`, `--destination-id`, `--note` | `createTransfer()` → `POST /v1/transfers`                                                                        | business                                          |
| `blaze withdrawals create`      | `--amount`, **`--external-account-id`** (req); `--currency`, `--note`                               | `createWithdrawal()` → `POST /v1/withdrawals`                                                                    | business                                          |
| `blaze withdrawals to-method`   | `--amount` (req); `--payment-method-id`, `--currency`, `--instant`/`--no-instant`, `--watch`, `-y`  | `withdrawToPaymentMethod()` → `withdrawAccount` GraphQL mutation                                                 | **consumer** (own balance → own connected method) |
| `blaze contacts pay <nameOrId>` | `--amount` (req); `--bank-account-id`, `--crypto-address-id`, `--currency`, `--note`, `-y`          | `payContact()` (`BankTransfer`) / `payContactCrypto()` (`CryptoTransfer`) → `POST /v1/recipients/{id}/transfers` | consumer (third-party payee)                      |

- `transfers`: also `list` (`--limit --status`), `get <id>`.
  `--destination-type` ∈
  `wallet\|external_account\|virtual_account\|payment_link`
  (`TransferSourceType`). CLI omits `--source-type`/`--source-id` though
  `CreateTransferInput` supports them.
- `withdrawals create/list/get`: business — pays out to a pre-registered
  **customer** `ExternalAccount`; no destination discovery/listing.
- `withdrawals methods/to-method/status`: **consumer** — `methods` lists the
  user's own connected methods (`listConnectedPaymentMethods`, filter
  `canWithdraw`); `to-method` withdraws the user's own balance to their own
  bank/card (`withdrawToPaymentMethod`); `status <rampTransferId>` polls via
  `getRampTransfer`. Pre-submit: **live minimum + limit check** via
  `checkWithdrawalLimits` (`checkLimits` query — server-sourced minimum,
  currently $5 USD-equiv; never hardcoded) + balance pre-check + confirm
  (default on, `-y` to skip). Post-submit: an **accurate fee receipt** built
  from the real `feeCollections` on the transfer (amount received, fee, total
  USDC debited). Business-context guard errors clearly.
- `payments`: read-only — `list` (`--limit`), `get <id>` → `GET /v1/payments`.
- `send`: non-USD/USDC routes through FX estimate; self-send guard; balance
  pre-check. Only delivers to other Blaze users.
- `contacts pay`: balance pre-check; min-transfer (USD 1/MXN 50/BRL 10/EUR 5/GBP
  5); crypto min $1 USDC; Travel Rule beneficiary check ≥ $3,000.

> **Implemented (#3697):** a user can now withdraw their **own** balance to
> their **own** connected payment method (linked bank / debit card) via
> `blaze withdrawals to-method` / `methods` / `status` (plus the
> `blaze_withdraw_to_payment_method` MCP tool and `blaze_withdraw` agent tool).
> This mirrors the mobile app's consumer `withdrawAccount` GraphQL mutation and
> is distinct from the business `withdrawals create` (which targets a
> _customer's_ external account).

## 3. Destinations & Connected Accounts

| Command            | Subcommands                                                                                                                   | SDK / Endpoint                          | Notes                                                      |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| `blaze recipients` | `list --customer-id`, `add --customer-id --type <us_bank\|iban\|crypto_wallet> [fields]`, `remove --customer-id --account-id` | `/v1/customers/{id}/external_accounts*` | **Customer-scoped** external accounts (withdrawal targets) |
| `blaze accounts`   | `list/get/create --customer-id [--nickname]`                                                                                  | `/v1/customers/{id}/virtual_accounts*`  | **Inbound** virtual deposit accounts (money in, not out)   |
| `blaze contacts`   | `list [--search]`, `add [bank/clabe/crypto fields + Travel Rule]`, `pay`, `remove <id>`                                       | `/v1/recipients*`                       | Consumer's saved third-party payees                        |

`ExternalAccountType` = `us_bank \| iban \| crypto_wallet`. `CryptoNetwork` =
`stellar \| ethereum \| polygon \| solana \| base`. **No card type exists
anywhere in CLI types** (the consumer `UserPaymentMethod.type` enum —
`Bank|Card|Cash|Other|PayPal|Venmo|VirtualAccount|Zelle` — is not modeled in the
CLI yet).

## 4. Commerce / Business Resources

| Command               | Subcommands                                                                                                                       |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `blaze customers`     | `list`, `get <id>`, `create --email [names/phone]`, `update <id>`, `archive <id>`                                                 |
| `blaze paylinks`      | `list`, `get <id>`, `create --amount [...]`, `update <id>`, `cancel <id>`                                                         |
| `blaze invoices`      | `list`, `get <id>`, `create --customer-id --line-items <json>`, `send <id>`, `mark-paid <id>`, `void <id>`                        |
| `blaze products`      | `list [--active/--inactive]`, `get <id>`, `create --name --price [--image/--recurring/--interval]`, `update <id>`, `archive <id>` |
| `blaze subscriptions` | `list`, `get <id>`, `create --customer-id --product-id`, `cancel <id> [--immediately]`, `pause <id>`, `resume <id>`               |
| `blaze coupons`       | `list`, `get <id>`, `create --code --type --value`, `update <id>`, `deactivate <id>`, `validate --code --amount --currency`       |
| `blaze disputes`      | `list`, `get <id>`, `submit-evidence <id> --description`, `close <id>`                                                            |

## 5. Bills / Accounts-Payable (GraphQL-only)

`blaze bills` is the **only GraphQL-backed** command group (inline
query/mutation strings via `graphqlRequest`); every subcommand calls
`requireBusinessContext`.

| Subcommand                                                                      | GraphQL root                                                                                                                                 |
| ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `bills list/show/approve/reject`                                                | `businessBills` / `businessBill` / `approveBusinessBill` / `rejectBusinessBill`                                                              |
| `bills pay <id> [--from --expedite -y]`                                         | **two-phase**: `quoteBusinessBillPayment` then `payBusinessBill(input:{billId, quoteId, confirm:true})`                                      |
| `bills pending-approvals list/approve/reject`                                   | `businessBillPendingApprovals` / `approveBusinessBillApprovalRequest` / `rejectBusinessBillApprovalRequest`                                  |
| `bills logs`                                                                    | `businessActivityLog`                                                                                                                        |
| `bills vendors list`                                                            | `businessVendors`                                                                                                                            |
| `bills connect-gmail` / `gmail-integrations list/disconnect` / `sync` / `setup` | `generateGmailAuthUrl`, `gmailConnectSession`, `businessGmailIntegrations`, `disconnectBusinessGmailIntegration`, `triggerBusinessGmailSync` |

The `quote → confirm` pattern (with `confirm: true`) is the established template
for irreversible money movement that needs a fee preview.

## 6. Reporting / Read-Only

| Command              | Subcommands                                                                                                                                                                                                                    | Endpoint                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| `blaze balance`      | (single) — Blaze wallet `available`/`pending` (cents)                                                                                                                                                                          | `GET /v1/balance`                                                 |
| `blaze transactions` | `list [--limit --type --status]`, `get <id>`                                                                                                                                                                                   | `GET /v1/transactions` (business) / `GET /v1/payments` (personal) |
| `blaze insights`     | `summary`, `transactions`, `balances` — **Plaid bank data, read-only**                                                                                                                                                         | `/v1/insights/*`                                                  |
| `blaze analytics`    | `overview --period`                                                                                                                                                                                                            | `GET /v1/analytics/overview`                                      |
| `blaze fx`           | `rates [--base]`, `quote --from --to --amount`                                                                                                                                                                                 | `GET /v1/fx/rates`, `POST /v1/fx/quotes`                          |
| `blaze accounting`   | `connect`, `status`, `disconnect`, `pnl`, `balance-sheet`, `coa`, `trial-balance`, `cash-activity`, `vendor-spending`, `transactions`, `bills`, `invoices`, `sync-*`, `reconcile`, `close-status`, `push-bill`, `push-invoice` | `/v1/accounting/*`                                                |

`blaze balance` (Blaze wallet) ≠ `insights balances` (`getBankBalances` →
connected Plaid bank balances).

## 7. SDK Layer (`src/sdk/`)

`BlazeClient` (`client.ts`) wraps REST `/v1/*` (and GraphQL for bills) behind a
private `request(method, path, body)`:

- **Auth**: bearer → `Authorization: Bearer`; API key → `X-API-Key`. Bearer with
  no business context defaults `x-blaze-personal: true`.
- **Retries**: GET only (`MAX_RETRIES=2`, exp backoff w/ jitter, honors
  `Retry-After`). **POST/PATCH/PUT/DELETE are NEVER retried** (money-movement
  safety, `client.ts:185-188`).
- **Errors** (`errors.ts`): 401→`BlazeAuthenticationError`,
  403→`BlazePermissionError`, 404→`BlazeNotFoundError`,
  400→`BlazeValidationError`, 429→`BlazeRateLimitError`, 5xx→`BlazeServerError`,
  network→`BlazeNetworkError`; `translateError()` for user-safe display.
- **Pagination** (`pagination.ts`): `paginate()` generator over
  `{object:'list', data, has_more, next_cursor}`.
- **Withdrawal methods**: `listWithdrawals` / `getWithdrawal` /
  `createWithdrawal` (`client.ts:596-612`). `CreateWithdrawalInput`
  (`types.ts:191`) =
  `{ external_account_id, amount, currency?, note?, metadata? }` — **no
  idempotency key** (unlike `payContact`/`payContactCrypto` which inject
  `randomUUID()`).
- **GraphQL**: `graphqlRequest()` used only by bills/vendors/gmail. A separate
  `BlazeGraphQLClient` (`graphql.ts`) exists only for the setup/auth flow.

## 8. MCP Server (`src/mcp/`)

`registerTools()` registers **83 tools**
(`server.tool(name, description, zodSchema.shape, handler)`); each handler calls
one SDK method → `jsonResult` / `errorResult`. Groups: Balance/whoami (2),
Customers (5), External Accounts (3), Transfers (3), **Withdrawals (5: business
`blaze_list_withdrawals`, `blaze_get_withdrawal`, `blaze_create_withdrawal`;
consumer `blaze_list_connected_payment_methods`,
`blaze_withdraw_to_payment_method` with `confirm: z.literal(true)`)**, Payment
Links (5), Virtual Accounts (3), Transactions (2), `blaze_send_money`
(convenience), FX (2), Team (read subset), Webhooks (5), Analytics (1), Disputes
(4), Invoices (6), Subscriptions (6), Insights (3, Plaid), Bills/AP (16, GraphQL
incl. `blaze_quote_bill_payment` + `blaze_pay_bill` with
`confirm: z.literal(true)`), CFO (6). `blaze_create_withdrawal` (`tools.ts:227`)
takes `external_account_id + amount + currency + note + metadata`. Consumer P2P
methods (`payContact`, `payContactCrypto`, `sendPayment`) exist in the SDK but
are **not** exposed as MCP tools.

## 9. NL Agent (`src/agent/`)

Anthropic tool-use loop (`runAgent`, `index.ts:40`); `toolDefs` array in
`tools.ts`; LLM via `llm-provider.ts` (Anthropic or Bedrock, default
`claude-sonnet-4-6`); memory in `~/.blaze/agent-memory.md`. Money-movement agent
tools: `blaze_send_payment` (P2P, balance pre-check + FX), `blaze_pay_contact`
(bank/crypto, minimums + Travel Rule), `blaze_withdraw` (own balance → own
connected method; in-tool balance pre-check + destination resolution +
explicit-confirm pattern mirroring `blaze_pay_contact`), `blaze_create_transfer`
(**no balance/confirm/dupe check — weaker pattern**), `blaze_pay_bill`
(irrevocable, `confirm===true` + fresh quote). Read-only: balances, insights,
FX, bills, CFO, accounting, plus `blaze_list_connected_payment_methods` (own
withdrawal destinations). System-prompt money rules now name
`payment`/`transfer`/`withdrawal`/`bill payment`. The `agent` CLI command builds
its own client and does NOT thread `x-business-id`/`x-blaze-personal` headers.

## 10. Documentation Surface

`docs/cli.md`, `docs/sdk.md`, `docs/mcp.md` (now states "83 tools"),
`docs/agent.md`, `docs/authentication.md`, `docs/testing-guide.md`,
`docs/production-release-checklist.md`, `README.md` (command-category table),
`skills/blaze/SKILL.md` (v2.0.0 decision tree). Docs now describe both the
business withdrawal payout (`external_account_id`) **and** the consumer
self-service "withdraw my balance to my own connected method" flow
(`withdrawals to-method`/`methods`/`status`, `blaze_withdraw_to_payment_method`,
`blaze_withdraw`).

## Drift reconciled in this audit (#3696)

- **MCP tool count corrected to 83.** `docs/mcp.md` was stale at "74" in two
  spots (now 83 throughout); `registerTools()` in `src/mcp/tools.ts` registers
  **83** `server.tool(...)` calls.
- **`recipients add` field list now documented** in `docs/cli.md` (flag table +
  example), matching `src/cli/commands/recipients.ts`.
- **Agent↔MCP tool-name divergence is now documented & justified** in
  `docs/agent.md` ("Tool naming vs the MCP catalog"). The diverging pairs are
  the same capability under intentionally different names — `blaze_send_payment`
  vs `blaze_send_money`, `blaze_fx_rates` vs `blaze_get_fx_rates`,
  `blaze_fx_quote` vs `blaze_create_fx_quote`. The agent's `toolDefs` and the
  MCP catalog are independent public contracts, so renaming either would be a
  breaking change.
- ~~Agent + skill expose no withdrawal capability~~ — RESOLVED (#3697): consumer
  withdrawal now exposed on CLI/SDK/MCP/agent/skill.

### Still open

- `blaze_create_transfer` agent tool lacks the balance/confirm guard the other
  money tools have (weaker pattern).
