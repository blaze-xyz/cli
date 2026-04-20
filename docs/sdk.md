# SDK Reference

The `@blaze-money/cli` package exports a TypeScript SDK for interacting with the Blaze API programmatically. Use it in Node.js scripts, backend services, or any TypeScript/JavaScript project.

## Installation

```bash
npm install @blaze-money/cli
# or
yarn add @blaze-money/cli
```

## Quick Start

```typescript
import { BlazeClient } from "@blaze-money/cli"

const client = new BlazeClient({
  apiKey: "sk_test_your_key_here",
})

const balance = await client.getBalance()
console.log(`Available: $${balance.available} ${balance.currency}`)
```

## Constructor

```typescript
new BlazeClient(options: BlazeClientOptions)
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `apiKey` | `string` | Yes | Your Blaze API key (`sk_test_*` or `sk_live_*`) |
| `baseUrl` | `string` | No | API base URL. Defaults to `https://api.blaze.money` |

---

## Balance

### getBalance()

Returns your account balance including available and pending funds.

```typescript
getBalance(): Promise<Balance>
```

**Response shape:**

```typescript
interface Balance {
  object: "balance"
  available: number
  pending: number
  currency: string
}
```

**Example:**

```typescript
const balance = await client.getBalance()
console.log(`Available: $${balance.available}`)
console.log(`Pending: $${balance.pending}`)
```

---

## Customers

### listCustomers()

List customers with optional filtering and pagination.

```typescript
listCustomers(params?: ListCustomersParams): Promise<PaginatedList<Customer>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Max results per page (1-100) |
| `cursor` | `string` | No | Pagination cursor from a previous response |
| `email` | `string` | No | Filter by exact email address |
| `include_archived` | `boolean` | No | Include archived customers in results |

**Example:**

```typescript
const customers = await client.listCustomers({ limit: 10 })
for (const customer of customers.data) {
  console.log(`${customer.first_name} ${customer.last_name} (${customer.email})`)
}
```

### getCustomer()

Retrieve a single customer by ID.

```typescript
getCustomer(id: string): Promise<Customer>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Customer ID |

**Example:**

```typescript
const customer = await client.getCustomer("cus_abc123")
console.log(customer.email)
```

### createCustomer()

Create a new customer.

```typescript
createCustomer(data: CreateCustomerInput): Promise<Customer>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | `string` | Yes | Customer email address |
| `first_name` | `string` | No | First name |
| `last_name` | `string` | No | Last name |
| `phone` | `string` | No | Phone number |
| `address` | `Address` | No | Customer address |
| `metadata` | `Record<string, string>` | No | Arbitrary key-value metadata |

**Address fields:**

| Field | Type | Description |
|-------|------|-------------|
| `line1` | `string` | Street address |
| `city` | `string` | City |
| `state` | `string` | State or province |
| `postal_code` | `string` | Postal / ZIP code |
| `country` | `string` | Country code (e.g. `US`, `MX`) |

**Example:**

```typescript
const customer = await client.createCustomer({
  email: "john@example.com",
  first_name: "John",
  last_name: "Doe",
  phone: "+1-555-0100",
  address: {
    line1: "123 Main St",
    city: "Austin",
    state: "TX",
    postal_code: "78701",
    country: "US",
  },
  metadata: { source: "onboarding" },
})
```

**Response shape:**

```typescript
interface Customer {
  id: string
  object: "customer"
  email: string
  first_name: string
  last_name: string
  phone: string
  address: Address
  metadata: Record<string, string>
  external_accounts: ExternalAccountSummary[]
  created_at: string
  updated_at: string
  archived_at: string | null
}
```

### updateCustomer()

Update an existing customer. Only provided fields are changed.

```typescript
updateCustomer(id: string, data: UpdateCustomerInput): Promise<Customer>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Customer ID |
| `first_name` | `string` | No | First name |
| `last_name` | `string` | No | Last name |
| `phone` | `string` | No | Phone number |
| `address` | `Address` | No | Customer address |
| `metadata` | `Record<string, string>` | No | Arbitrary key-value metadata |

**Example:**

```typescript
const updated = await client.updateCustomer("cus_abc123", {
  phone: "+1-555-0200",
  metadata: { tier: "premium" },
})
```

### archiveCustomer()

Soft-delete a customer. Archived customers are excluded from list results by default.

```typescript
archiveCustomer(id: string): Promise<void>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Customer ID |

**Example:**

```typescript
await client.archiveCustomer("cus_abc123")
```

---

## External Accounts

External accounts represent bank accounts or crypto wallets attached to a customer.

### listExternalAccounts()

List all external accounts for a customer.

```typescript
listExternalAccounts(customerId: string): Promise<PaginatedList<ExternalAccount>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | `string` | Yes | Customer ID |

**Example:**

```typescript
const accounts = await client.listExternalAccounts("cus_abc123")
for (const acct of accounts.data) {
  console.log(`${acct.type} - ${acct.bank_name} ending in ${acct.account_last4}`)
}
```

**Response shape:**

```typescript
interface ExternalAccount {
  id: string
  object: "external_account"
  type: "us_bank" | "iban" | "crypto_wallet"
  account_holder_name: string
  bank_name: string
  account_last4: string
  country_code: string
  wallet_address: string
  network: string
  is_validated: boolean
  created_at: string
}
```

### createExternalAccount()

Add a bank account or crypto wallet to a customer.

```typescript
createExternalAccount(customerId: string, data: CreateExternalAccountInput): Promise<ExternalAccount>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | `string` | Yes | Customer ID |
| `type` | `"us_bank" \| "iban" \| "crypto_wallet"` | Yes | Account type |
| `account_holder_name` | `string` | No | Name on the account |
| `bank_name` | `string` | No | Bank name |
| `routing_number` | `string` | No | Routing number (US bank) |
| `account_number` | `string` | No | Account number (US bank) |
| `iban` | `string` | No | IBAN (international bank) |
| `country_code` | `string` | No | Country code (e.g. `US`, `MX`) |
| `wallet_address` | `string` | No | Crypto wallet address |
| `network` | `CryptoNetwork` | No | Crypto network |

**Supported crypto networks:** `"stellar"`, `"ethereum"`, `"polygon"`, `"solana"`, `"base"`

**Example (US bank account):**

```typescript
const account = await client.createExternalAccount("cus_abc123", {
  type: "us_bank",
  account_holder_name: "John Doe",
  bank_name: "Chase",
  routing_number: "021000021",
  account_number: "123456789",
  country_code: "US",
})
```

**Example (crypto wallet):**

```typescript
const wallet = await client.createExternalAccount("cus_abc123", {
  type: "crypto_wallet",
  wallet_address: "0x1234567890abcdef1234567890abcdef12345678",
  network: "ethereum",
})
```

### deleteExternalAccount()

Remove an external account from a customer.

```typescript
deleteExternalAccount(customerId: string, accountId: string): Promise<void>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | `string` | Yes | Customer ID |
| `accountId` | `string` | Yes | External account ID |

**Example:**

```typescript
await client.deleteExternalAccount("cus_abc123", "ext_xyz789")
```

---

## Transfers

### listTransfers()

List transfers with optional filtering and pagination.

```typescript
listTransfers(params?: ListTransfersParams): Promise<PaginatedList<Transfer>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Max results per page (1-100) |
| `cursor` | `string` | No | Pagination cursor |
| `status` | `string` | No | Filter by status (e.g. `pending`, `completed`, `failed`) |

**Example:**

```typescript
const transfers = await client.listTransfers({ status: "completed", limit: 25 })
```

### getTransfer()

Retrieve a single transfer by ID.

```typescript
getTransfer(id: string): Promise<Transfer>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Transfer ID |

**Example:**

```typescript
const transfer = await client.getTransfer("txf_abc123")
console.log(`$${transfer.amount} ${transfer.currency} - ${transfer.status}`)
```

### createTransfer()

Create a new transfer between accounts.

```typescript
createTransfer(data: CreateTransferInput): Promise<Transfer>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | `number` | Yes | Transfer amount |
| `currency` | `Currency` | No | Currency code. Defaults to `USD` |
| `customer_id` | `string` | No | Customer ID |
| `source_type` | `TransferSourceType` | No | Source type |
| `source_id` | `string` | No | Source resource ID |
| `destination_type` | `TransferSourceType` | No | Destination type |
| `destination_id` | `string` | No | Destination resource ID |
| `note` | `string` | No | Transfer note or memo |
| `metadata` | `Record<string, string>` | No | Arbitrary key-value metadata |

**Transfer source/destination types:** `"wallet"`, `"external_account"`, `"virtual_account"`, `"payment_link"`

**Supported currencies:** `"USD"`, `"MXN"`, `"EUR"`, `"GBP"`, `"BRL"`, `"COP"`, `"PEN"`, `"ARS"`

**Response shape:**

```typescript
interface Transfer {
  id: string
  object: "transfer"
  status: string
  amount: number
  currency: string
  fee: number | null
  customer_id: string
  source: { type: string; id: string } | null
  destination: { type: string; id: string } | null
  note: string
  metadata: Record<string, string>
  created_at: string
  completed_at: string | null
}
```

**Example:**

```typescript
const transfer = await client.createTransfer({
  amount: 500,
  currency: "USD",
  customer_id: "cus_abc123",
  destination_type: "external_account",
  destination_id: "ext_xyz789",
  note: "Invoice #1234",
})
```

---

## Withdrawals

### listWithdrawals()

List withdrawals with optional filtering and pagination.

```typescript
listWithdrawals(params?: ListWithdrawalsParams): Promise<PaginatedList<Withdrawal>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Max results per page (1-100) |
| `cursor` | `string` | No | Pagination cursor |
| `status` | `string` | No | Filter by status |

**Example:**

```typescript
const withdrawals = await client.listWithdrawals({ limit: 10 })
```

### getWithdrawal()

Retrieve a single withdrawal by ID.

```typescript
getWithdrawal(id: string): Promise<Withdrawal>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Withdrawal ID |

**Example:**

```typescript
const withdrawal = await client.getWithdrawal("wdr_abc123")
```

### createWithdrawal()

Create a new withdrawal to an external account.

```typescript
createWithdrawal(data: CreateWithdrawalInput): Promise<Withdrawal>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `external_account_id` | `string` | Yes | External account ID to withdraw to |
| `amount` | `number` | Yes | Withdrawal amount |
| `currency` | `Currency` | No | Currency code. Defaults to `USD` |
| `note` | `string` | No | Withdrawal note or memo |
| `metadata` | `Record<string, string>` | No | Arbitrary key-value metadata |

**Response shape:**

```typescript
interface Withdrawal {
  id: string
  object: "withdrawal"
  status: string
  amount: number
  currency: string
  fee: number | null
  external_account_id: string
  note: string
  metadata: Record<string, string>
  created_at: string
  completed_at: string | null
}
```

**Example:**

```typescript
const withdrawal = await client.createWithdrawal({
  external_account_id: "ext_xyz789",
  amount: 1000,
  currency: "USD",
  note: "Monthly payout",
})
```

---

## Payment Links

### listPaymentLinks()

List payment links with optional filtering and pagination.

```typescript
listPaymentLinks(params?: ListPaymentLinksParams): Promise<PaginatedList<PaymentLink>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Max results per page (1-100) |
| `cursor` | `string` | No | Pagination cursor |
| `status` | `string` | No | Filter by status (e.g. `active`, `completed`, `cancelled`) |

**Example:**

```typescript
const links = await client.listPaymentLinks({ status: "active" })
```

### getPaymentLink()

Retrieve a single payment link by ID.

```typescript
getPaymentLink(id: string): Promise<PaymentLink>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Payment link ID |

**Example:**

```typescript
const link = await client.getPaymentLink("pml_abc123")
console.log(`Share this URL: ${link.url}`)
```

### createPaymentLink()

Create a shareable payment link for collecting payments.

```typescript
createPaymentLink(data: CreatePaymentLinkInput): Promise<PaymentLink>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | `number` | Yes | Payment amount |
| `currency` | `Currency` | No | Currency code. Defaults to `USD` |
| `name` | `string` | No | Display name for the payment link |
| `note` | `string` | No | Note or description |
| `success_url` | `string` | No | URL to redirect to after successful payment |
| `metadata` | `Record<string, string>` | No | Arbitrary key-value metadata |

**Response shape:**

```typescript
interface PaymentLink {
  id: string
  object: "payment_link"
  url: string
  short_code: string
  status: string
  amount: number
  currency: string
  name: string
  note: string
  metadata: Record<string, string>
  created_at: string
  updated_at: string
}
```

**Example:**

```typescript
const link = await client.createPaymentLink({
  amount: 75,
  currency: "USD",
  name: "Consulting Invoice #42",
  note: "Due within 30 days",
  success_url: "https://example.com/thank-you",
})
console.log(`Payment link: ${link.url}`)
```

### updatePaymentLink()

Update a payment link's name, note, or metadata.

```typescript
updatePaymentLink(id: string, data: UpdatePaymentLinkInput): Promise<PaymentLink>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Payment link ID |
| `name` | `string` | No | Display name |
| `note` | `string` | No | Note or description |
| `metadata` | `Record<string, string>` | No | Arbitrary key-value metadata |

**Example:**

```typescript
const updated = await client.updatePaymentLink("pml_abc123", {
  name: "Consulting Invoice #42 (Revised)",
})
```

### cancelPaymentLink()

Cancel an active payment link.

```typescript
cancelPaymentLink(id: string): Promise<void>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Payment link ID |

**Example:**

```typescript
await client.cancelPaymentLink("pml_abc123")
```

---

## Virtual Accounts

Virtual accounts are dedicated bank accounts that can receive incoming funds on behalf of a customer.

### listVirtualAccounts()

List virtual accounts for a customer.

```typescript
listVirtualAccounts(customerId: string, params?: ListVirtualAccountsParams): Promise<PaginatedList<VirtualAccount>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | `string` | Yes | Customer ID |
| `limit` | `number` | No | Max results per page (1-100) |
| `cursor` | `string` | No | Pagination cursor |

**Example:**

```typescript
const accounts = await client.listVirtualAccounts("cus_abc123")
for (const va of accounts.data) {
  console.log(`${va.nickname}: ${va.bank_name} ${va.account_number}`)
}
```

### getVirtualAccount()

Retrieve a single virtual account.

```typescript
getVirtualAccount(customerId: string, vaId: string): Promise<VirtualAccount>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | `string` | Yes | Customer ID |
| `vaId` | `string` | Yes | Virtual account ID |

**Example:**

```typescript
const va = await client.getVirtualAccount("cus_abc123", "va_xyz789")
```

### createVirtualAccount()

Create a new virtual bank account for a customer.

```typescript
createVirtualAccount(customerId: string, data?: CreateVirtualAccountInput): Promise<VirtualAccount>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | `string` | Yes | Customer ID |
| `nickname` | `string` | No | Friendly name for the virtual account |

**Response shape:**

```typescript
interface VirtualAccount {
  id: string
  object: "virtual_account"
  status: string
  account_number: string
  routing_number: string
  bank_name: string
  nickname: string
  currency: string
  created_at: string
}
```

**Example:**

```typescript
const va = await client.createVirtualAccount("cus_abc123", {
  nickname: "Payroll deposits",
})
console.log(`Route funds to: ${va.routing_number} / ${va.account_number}`)
```

---

## Transactions

### listTransactions()

List transactions with optional filtering and pagination.

```typescript
listTransactions(params?: ListTransactionsParams): Promise<PaginatedList<Transaction>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Max results per page (1-100) |
| `cursor` | `string` | No | Pagination cursor |
| `type` | `string` | No | Filter by transaction type |
| `status` | `string` | No | Filter by status |

**Example:**

```typescript
const txns = await client.listTransactions({ limit: 20, status: "completed" })
```

### getTransaction()

Retrieve a single transaction by ID.

```typescript
getTransaction(id: string): Promise<Transaction>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Transaction ID |

**Response shape:**

```typescript
interface Transaction {
  id: string
  object: "transaction"
  type: string
  status: string
  amount: number
  currency: string
  description: string
  created_at: string
}
```

**Example:**

```typescript
const txn = await client.getTransaction("txn_abc123")
console.log(`${txn.type}: $${txn.amount} ${txn.currency} - ${txn.description}`)
```

---

## Pagination

All list endpoints use cursor-based pagination. Every list response follows this shape:

```typescript
interface PaginatedList<T> {
  object: "list"
  data: T[]
  has_more: boolean
  next_cursor: string | null
}
```

To paginate through results, pass the `next_cursor` value from the previous response as the `cursor` parameter in the next request. Continue until `has_more` is `false`.

**Example -- iterating through all customers:**

```typescript
let cursor: string | undefined
const allCustomers = []

do {
  const page = await client.listCustomers({ limit: 100, cursor })
  allCustomers.push(...page.data)
  cursor = page.next_cursor ?? undefined
} while (cursor)

console.log(`Total customers: ${allCustomers.length}`)
```

---

## Error Handling

The SDK throws typed errors for different HTTP status codes. All errors extend the base `BlazeError` class.

| Error Class | HTTP Status | Description |
|-------------|-------------|-------------|
| `BlazeAuthenticationError` | 401 | Invalid or missing API key |
| `BlazePermissionError` | 403 | API key lacks required permissions |
| `BlazeNotFoundError` | 404 | Requested resource does not exist |
| `BlazeValidationError` | 400 | Request body failed validation |
| `BlazeRateLimitError` | 429 | Too many requests |
| `BlazeError` | Other | Generic error with optional `statusCode` |

**Example -- catching specific errors:**

```typescript
import {
  BlazeClient,
  BlazeNotFoundError,
  BlazeValidationError,
  BlazeRateLimitError,
  BlazeAuthenticationError,
} from "@blaze-money/cli"

const client = new BlazeClient({ apiKey: "sk_test_..." })

try {
  const customer = await client.getCustomer("cus_nonexistent")
} catch (err) {
  if (err instanceof BlazeNotFoundError) {
    console.log("Customer not found")
  } else if (err instanceof BlazeAuthenticationError) {
    console.log("Check your API key")
  } else if (err instanceof BlazeRateLimitError) {
    console.log("Slow down -- retry after a moment")
  } else {
    throw err
  }
}
```

**Example -- handling validation errors:**

```typescript
try {
  await client.createCustomer({ email: "" })
} catch (err) {
  if (err instanceof BlazeValidationError) {
    console.log("Validation failed:", err.message)
    if (err.errors) {
      for (const [field, messages] of Object.entries(err.errors)) {
        console.log(`  ${field}: ${messages.join(", ")}`)
      }
    }
  }
}
```

---

## API Keys

Manage API keys for programmatic access to your Blaze account. Keys are scoped to specific permissions and can be created for test or live environments.

### listApiKeys()

List all API keys for your account.

```typescript
listApiKeys(): Promise<{ object: "list"; data: ApiKey[] }>
```

This endpoint is not paginated -- it returns all keys at once.

**Example:**

```typescript
const keys = await client.listApiKeys()
for (const key of keys.data) {
  console.log(`${key.name} (${key.key_prefix}...) - ${key.scopes.join(", ")}`)
}
```

**Response shape:**

```typescript
interface ApiKey {
  id: string
  object: "api_key"
  name: string
  key_prefix: string
  scopes: ApiKeyScope[]
  is_test: boolean
  revoked_at: string | null
  revoked_reason: string | null
  expires_at: string | null
  last_used_at: string | null
  request_count: number
  created_at: string
}
```

### createApiKey()

Create a new API key. The full key value is returned only once in the response -- store it securely.

```typescript
createApiKey(data: CreateApiKeyInput): Promise<ApiKeyWithSecret>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | `string` | Yes | Friendly name for the key |
| `scopes` | `ApiKeyScope[]` | Yes | Permission scopes for the key |
| `is_test` | `boolean` | No | Whether this is a test key. Defaults to `false` |
| `expires_in_days` | `number` | No | Number of days until the key expires |

**Available scopes:** `PAYMENT_LINKS_READ`, `PAYMENT_LINKS_WRITE`, `TRANSACTIONS_READ`, `PAYOUTS_READ`, `PAYOUTS_WRITE`, `CUSTOMERS_READ`, `CUSTOMERS_WRITE`, `WEBHOOKS_READ`, `WEBHOOKS_WRITE`, `BALANCE_READ`, `CHECKOUT_SESSIONS_READ`, `CHECKOUT_SESSIONS_WRITE`, `REFUNDS_READ`, `REFUNDS_WRITE`

**Example:**

```typescript
const newKey = await client.createApiKey({
  name: "CI/CD Pipeline",
  scopes: ["TRANSACTIONS_READ", "BALANCE_READ"],
  is_test: true,
  expires_in_days: 90,
})
console.log(`Key created: ${newKey.key}`) // Only shown once!
```

### updateApiKeyScopes()

Update the permission scopes of an existing API key.

```typescript
updateApiKeyScopes(id: string, data: UpdateApiKeyScopesInput): Promise<ApiKey>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | API key ID |
| `scopes` | `ApiKeyScope[]` | Yes | New set of permission scopes |

**Example:**

```typescript
const updated = await client.updateApiKeyScopes("key_abc123", {
  scopes: ["TRANSACTIONS_READ", "BALANCE_READ", "CUSTOMERS_READ"],
})
```

### revokeApiKey()

Permanently revoke an API key. This action cannot be undone.

```typescript
revokeApiKey(id: string, reason?: string): Promise<void>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | API key ID |
| `reason` | `string` | No | Reason for revocation |

**Example:**

```typescript
await client.revokeApiKey("key_abc123", "Employee offboarded")
```

---

## Team Members

Manage team members and invitations for your Blaze business account.

### listTeamMembers()

List all team members in your organization.

```typescript
listTeamMembers(): Promise<{ object: "list"; data: TeamMember[] }>
```

This endpoint is not paginated -- it returns all members at once.

**Example:**

```typescript
const team = await client.listTeamMembers()
for (const member of team.data) {
  console.log(`${member.email} - ${member.role}`)
}
```

**Response shape:**

```typescript
interface TeamMember {
  id: string
  object: "team_member"
  role: TeamRole
  email: string | null
  first_name: string | null
  last_name: string | null
  user_id: string
  invited_at: string | null
  accepted_at: string | null
  created_at: string
}
```

**Available roles:** `"admin"`, `"finance"`, `"support"`, `"developer"`, `"view_only"`, `"member"`

### listPendingInvitations()

List pending team invitations that have not yet been accepted.

```typescript
listPendingInvitations(): Promise<{ object: "list"; data: TeamMember[] }>
```

**Example:**

```typescript
const pending = await client.listPendingInvitations()
console.log(`${pending.data.length} pending invitations`)
```

### inviteTeamMember()

Invite a new team member by email.

```typescript
inviteTeamMember(data: InviteTeamMemberInput): Promise<TeamMember>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `email` | `string` | Yes | Email address to invite |
| `role` | `TeamRole` | Yes | Role to assign |

**Example:**

```typescript
const member = await client.inviteTeamMember({
  email: "jane@company.com",
  role: "developer",
})
```

### updateMemberRole()

Change the role of an existing team member.

```typescript
updateMemberRole(id: string, data: UpdateMemberRoleInput): Promise<TeamMember>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Team member ID |
| `role` | `TeamRole` | Yes | New role to assign |

**Example:**

```typescript
const updated = await client.updateMemberRole("tm_abc123", {
  role: "admin",
})
```

### removeMember()

Remove a team member from your organization.

```typescript
removeMember(id: string): Promise<void>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Team member ID |

**Example:**

```typescript
await client.removeMember("tm_abc123")
```

### transferOwnership()

Transfer business ownership to another team member.

```typescript
transferOwnership(data: TransferOwnershipInput): Promise<TeamMember>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `new_owner_id` | `string` | Yes | ID of the team member to become the new owner |

**Example:**

```typescript
const newOwner = await client.transferOwnership({
  new_owner_id: "tm_xyz789",
})
```

---

## Webhooks

Manage webhook endpoints for receiving real-time event notifications.

### listWebhooks()

List webhook endpoints with optional pagination.

```typescript
listWebhooks(params?: ListWebhooksParams): Promise<PaginatedList<Webhook>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Max results per page (1-100) |
| `cursor` | `string` | No | Pagination cursor |

**Example:**

```typescript
const webhooks = await client.listWebhooks({ limit: 10 })
for (const wh of webhooks.data) {
  console.log(`${wh.url} - ${wh.enabled ? "active" : "disabled"}`)
}
```

**Response shape:**

```typescript
interface Webhook {
  id: string
  object: "webhook_endpoint"
  url: string
  events: WebhookEvent[]
  enabled: boolean
  description: string | null
  status: string
  created_at: string
  updated_at: string
}
```

**Available events:** `"payment.completed"`, `"payment.failed"`, `"payment.refunded"`, `"payout.completed"`, `"payout.failed"`, `"payment.link.created"`, `"payment.link.expired"`, `"checkout.session.completed"`, `"checkout.session.expired"`, `"refund.created"`, `"refund.updated"`

### getWebhook()

Retrieve a single webhook endpoint by ID.

```typescript
getWebhook(id: string): Promise<Webhook>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Webhook endpoint ID |

**Example:**

```typescript
const webhook = await client.getWebhook("wh_abc123")
console.log(`Listening for: ${webhook.events.join(", ")}`)
```

### createWebhook()

Create a new webhook endpoint. The signing secret is returned only once in the response -- store it securely.

```typescript
createWebhook(data: CreateWebhookInput): Promise<WebhookWithSecret>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `url` | `string` | Yes | HTTPS URL to receive webhook events |
| `events` | `WebhookEvent[]` | No | Events to subscribe to. Defaults to all events |
| `enabled` | `boolean` | No | Whether the endpoint is active. Defaults to `true` |
| `description` | `string` | No | Description of the endpoint |

**Example:**

```typescript
const webhook = await client.createWebhook({
  url: "https://example.com/webhooks/blaze",
  events: ["payment.completed", "payment.failed"],
  description: "Production payment notifications",
})
console.log(`Secret: ${webhook.secret}`) // Only shown once!
```

### updateWebhook()

Update a webhook endpoint's URL, events, or enabled status.

```typescript
updateWebhook(id: string, data: UpdateWebhookInput): Promise<Webhook>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Webhook endpoint ID |
| `url` | `string` | No | New URL |
| `events` | `WebhookEvent[]` | No | New event subscriptions |
| `enabled` | `boolean` | No | Enable or disable the endpoint |
| `description` | `string` | No | Updated description |

**Example:**

```typescript
const updated = await client.updateWebhook("wh_abc123", {
  events: ["payment.completed", "payment.failed", "payout.completed"],
  enabled: true,
})
```

### deleteWebhook()

Delete a webhook endpoint.

```typescript
deleteWebhook(id: string): Promise<void>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Webhook endpoint ID |

**Example:**

```typescript
await client.deleteWebhook("wh_abc123")
```

---

## Analytics

Retrieve aggregated transaction analytics for your account.

### getAnalyticsOverview()

Get transaction analytics for a specified time period.

```typescript
getAnalyticsOverview(period?: AnalyticsPeriod): Promise<AnalyticsOverview>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `period` | `AnalyticsPeriod` | No | Time period. Defaults to `LAST_30_DAYS` |

**Available periods:** `"LAST_7_DAYS"`, `"LAST_30_DAYS"`, `"LAST_90_DAYS"`, `"LAST_365_DAYS"`

**Response shape:**

```typescript
interface AnalyticsOverview {
  object: "analytics_overview"
  total_volume: number
  transaction_count: number
  successful_count: number
  failed_count: number
  pending_count: number
  average_transaction_size: number
  period_start: string
  period_end: string
}
```

**Example:**

```typescript
const analytics = await client.getAnalyticsOverview("LAST_7_DAYS")
console.log(`Volume: $${analytics.total_volume}`)
console.log(`Transactions: ${analytics.transaction_count}`)
console.log(`Success rate: ${((analytics.successful_count / analytics.transaction_count) * 100).toFixed(1)}%`)
```

---

## Disputes

Manage payment disputes and submit evidence.

### listDisputes()

List disputes with optional filtering and pagination.

```typescript
listDisputes(params?: ListDisputesParams): Promise<PaginatedList<Dispute>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Max results per page (1-100) |
| `cursor` | `string` | No | Pagination cursor |
| `status` | `string` | No | Filter by status (e.g. `open`, `under_review`, `won`, `lost`) |

**Example:**

```typescript
const disputes = await client.listDisputes({ status: "open", limit: 10 })
for (const dispute of disputes.data) {
  console.log(`${dispute.id}: $${dispute.amount} ${dispute.currency} - ${dispute.reason}`)
}
```

**Response shape:**

```typescript
interface Dispute {
  id: string
  object: "dispute"
  status: string
  reason: string
  amount: number
  currency: string
  transaction_id: string
  evidence: { description: string; document_urls: string[]; submitted_at: string } | null
  evidence_due_by: string | null
  resolved_at: string | null
  resolution: string | null
  metadata: Record<string, unknown>
  created_at: string
}
```

### getDispute()

Retrieve a single dispute by ID.

```typescript
getDispute(id: string): Promise<Dispute>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Dispute ID |

**Example:**

```typescript
const dispute = await client.getDispute("dsp_abc123")
console.log(`Due by: ${dispute.evidence_due_by}`)
```

### submitDisputeEvidence()

Submit evidence to contest a dispute.

```typescript
submitDisputeEvidence(id: string, data: SubmitDisputeEvidenceInput): Promise<Dispute>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Dispute ID |
| `description` | `string` | Yes | Description of the evidence |
| `document_urls` | `string[]` | No | URLs to supporting documents |
| `metadata` | `Record<string, unknown>` | No | Additional metadata |

**Example:**

```typescript
const dispute = await client.submitDisputeEvidence("dsp_abc123", {
  description: "Service was delivered as agreed. See attached receipt.",
  document_urls: ["https://storage.example.com/receipt-001.pdf"],
})
```

### closeDispute()

Close a dispute, accepting the outcome.

```typescript
closeDispute(id: string): Promise<Dispute>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Dispute ID |

**Example:**

```typescript
const closed = await client.closeDispute("dsp_abc123")
```

---

## Invoices

Create, send, and manage invoices for your customers.

### listInvoices()

List invoices with optional filtering and pagination.

```typescript
listInvoices(params?: ListInvoicesParams): Promise<PaginatedList<Invoice>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Max results per page (1-100) |
| `cursor` | `string` | No | Pagination cursor |
| `status` | `string` | No | Filter by status (e.g. `draft`, `sent`, `paid`, `void`) |
| `customer_id` | `string` | No | Filter by customer ID |

**Example:**

```typescript
const invoices = await client.listInvoices({ status: "sent", limit: 20 })
for (const inv of invoices.data) {
  console.log(`${inv.invoice_number}: $${inv.total} ${inv.currency} - ${inv.status}`)
}
```

**Response shape:**

```typescript
interface Invoice {
  id: string
  object: "invoice"
  invoice_number: string
  status: string
  subtotal: number
  tax: number
  total: number
  currency: string
  description: string | null
  customer_id: string
  line_items: InvoiceLineItem[]
  due_date: string | null
  paid_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}

interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}
```

### getInvoice()

Retrieve a single invoice by ID.

```typescript
getInvoice(id: string): Promise<Invoice>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Invoice ID |

**Example:**

```typescript
const invoice = await client.getInvoice("inv_abc123")
console.log(`Total: $${invoice.total} - Due: ${invoice.due_date}`)
```

### createInvoice()

Create a new invoice with line items.

```typescript
createInvoice(data: CreateInvoiceInput): Promise<Invoice>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer_id` | `string` | Yes | Customer to invoice |
| `line_items` | `CreateInvoiceLineItemInput[]` | Yes | Line items |
| `tax` | `number` | No | Tax amount |
| `description` | `string` | No | Invoice description |
| `due_date` | `string` | No | Due date (ISO 8601) |
| `currency_code` | `string` | No | Currency code. Defaults to `USD` |
| `metadata` | `Record<string, unknown>` | No | Arbitrary metadata |

**Line item fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `description` | `string` | Yes | Line item description |
| `quantity` | `number` | No | Quantity. Defaults to `1` |
| `unit_price` | `number` | Yes | Price per unit |

**Example:**

```typescript
const invoice = await client.createInvoice({
  customer_id: "cus_abc123",
  line_items: [
    { description: "Web Development - April", unit_price: 5000 },
    { description: "Hosting (monthly)", quantity: 1, unit_price: 99 },
  ],
  tax: 250,
  due_date: "2025-05-01",
  description: "April services",
})
console.log(`Invoice ${invoice.invoice_number} created: $${invoice.total}`)
```

### sendInvoice()

Send an invoice to the customer via email.

```typescript
sendInvoice(id: string): Promise<Invoice>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Invoice ID |

**Example:**

```typescript
const sent = await client.sendInvoice("inv_abc123")
console.log(`Invoice ${sent.invoice_number} sent`)
```

### markInvoicePaid()

Manually mark an invoice as paid.

```typescript
markInvoicePaid(id: string): Promise<Invoice>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Invoice ID |

**Example:**

```typescript
const paid = await client.markInvoicePaid("inv_abc123")
```

### voidInvoice()

Void an invoice. This action cannot be undone.

```typescript
voidInvoice(id: string): Promise<Invoice>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Invoice ID |

**Example:**

```typescript
const voided = await client.voidInvoice("inv_abc123")
```

---

## Subscriptions

Manage recurring billing subscriptions for your customers.

### listSubscriptions()

List subscriptions with optional filtering and pagination.

```typescript
listSubscriptions(params?: ListSubscriptionsParams): Promise<PaginatedList<Subscription>>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | `number` | No | Max results per page (1-100) |
| `cursor` | `string` | No | Pagination cursor |
| `status` | `string` | No | Filter by status (e.g. `active`, `paused`, `canceled`) |
| `customer_id` | `string` | No | Filter by customer ID |

**Example:**

```typescript
const subs = await client.listSubscriptions({ status: "active" })
for (const sub of subs.data) {
  console.log(`${sub.id}: $${sub.amount}/${sub.interval} - ${sub.status}`)
}
```

**Response shape:**

```typescript
interface Subscription {
  id: string
  object: "subscription"
  status: string
  interval: string
  amount: number
  currency: string
  customer_id: string
  product_id: string
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  canceled_at: string | null
  metadata: Record<string, unknown>
  created_at: string
}
```

### getSubscription()

Retrieve a single subscription by ID.

```typescript
getSubscription(id: string): Promise<Subscription>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Subscription ID |

**Example:**

```typescript
const sub = await client.getSubscription("sub_abc123")
console.log(`Next billing: ${sub.current_period_end}`)
```

### createSubscription()

Create a new subscription for a customer.

```typescript
createSubscription(data: CreateSubscriptionInput): Promise<Subscription>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customer_id` | `string` | Yes | Customer ID |
| `product_id` | `string` | Yes | Product ID to subscribe to |
| `interval` | `string` | No | Billing interval (e.g. `monthly`, `yearly`) |
| `metadata` | `Record<string, unknown>` | No | Arbitrary metadata |

**Example:**

```typescript
const sub = await client.createSubscription({
  customer_id: "cus_abc123",
  product_id: "prod_xyz789",
  interval: "monthly",
})
console.log(`Subscription ${sub.id} active until ${sub.current_period_end}`)
```

### cancelSubscription()

Cancel a subscription. By default, the subscription remains active until the end of the current billing period.

```typescript
cancelSubscription(id: string, cancelImmediately?: boolean): Promise<Subscription>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Subscription ID |
| `cancelImmediately` | `boolean` | No | If `true`, cancel immediately. Otherwise cancel at period end |

**Example:**

```typescript
// Cancel at end of period
const sub = await client.cancelSubscription("sub_abc123")

// Cancel immediately
const subNow = await client.cancelSubscription("sub_abc123", true)
```

### pauseSubscription()

Pause an active subscription. Billing stops until the subscription is resumed.

```typescript
pauseSubscription(id: string): Promise<Subscription>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Subscription ID |

**Example:**

```typescript
const paused = await client.pauseSubscription("sub_abc123")
```

### resumeSubscription()

Resume a paused subscription.

```typescript
resumeSubscription(id: string): Promise<Subscription>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | `string` | Yes | Subscription ID |

**Example:**

```typescript
const resumed = await client.resumeSubscription("sub_abc123")
```

---

## FX Rates & Quotes

Get exchange rates and create locked-in FX quotes for cross-currency transfers.

### getFxRates()

Get current exchange rates for supported currencies.

```typescript
getFxRates(base?: string): Promise<FxRates>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `base` | `string` | No | Base currency code. Defaults to `USD` |

**Response shape:**

```typescript
interface FxRates {
  object: "fx_rates"
  base: string
  rates: Record<string, number>
}
```

**Example:**

```typescript
const rates = await client.getFxRates("USD")
console.log(`USD -> MXN: ${rates.rates["MXN"]}`)
console.log(`USD -> EUR: ${rates.rates["EUR"]}`)
```

### createFxQuote()

Create a locked-in FX quote for a specific conversion. The quote is valid until `expires_at`.

```typescript
createFxQuote(data: { from_currency: string; to_currency: string; amount: number }): Promise<FxQuote>
```

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `from_currency` | `string` | Yes | Source currency code |
| `to_currency` | `string` | Yes | Target currency code |
| `amount` | `number` | Yes | Amount in source currency |

**Response shape:**

```typescript
interface FxQuote {
  object: "fx_quote"
  id: string
  from_currency: string
  to_currency: string
  amount: number
  converted_amount: number
  exchange_rate: number
  expires_at: string
}
```

**Example:**

```typescript
const quote = await client.createFxQuote({
  from_currency: "USD",
  to_currency: "MXN",
  amount: 1000,
})
console.log(`$1000 USD = $${quote.converted_amount} MXN (rate: ${quote.exchange_rate})`)
console.log(`Quote valid until: ${quote.expires_at}`)
```
