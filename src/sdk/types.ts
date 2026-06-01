// Currency type matching Spark DTOs
export type Currency =
  | "USD"
  | "MXN"
  | "EUR"
  | "GBP"
  | "BRL"
  | "COP"
  | "PEN"
  | "ARS"

// Pagination
export interface PaginatedList<T> {
  object: "list"
  data: T[]
  has_more: boolean
  next_cursor: string | null
}

// Pagination list that also reports a total count (e.g. insights transactions)
export interface PaginatedListWithCount<T> extends PaginatedList<T> {
  total_count: number
}

export interface PaginationParams {
  limit?: number
  cursor?: string
}

// Balance
export interface CurrencyAmount {
  amount: number
  currency: string
}

export interface Balance {
  object?: "balance"
  available: CurrencyAmount | number
  pending: CurrencyAmount | number
  reserved?: CurrencyAmount | number
  currency?: string
}

// Customer
export interface Address {
  line1?: string
  city?: string
  state?: string
  postal_code?: string
  country?: string
}

export interface Customer {
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

export interface ExternalAccountSummary {
  id: string
  type: string
  account_last4: string
  bank_name: string
}

export interface CreateCustomerInput {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
  address?: Address
  metadata?: Record<string, string>
}

export interface UpdateCustomerInput {
  first_name?: string
  last_name?: string
  phone?: string
  address?: Address
  metadata?: Record<string, string>
}

export interface ListCustomersParams extends PaginationParams {
  email?: string
  include_archived?: boolean
}

// External Account
export type ExternalAccountType = "us_bank" | "iban" | "crypto_wallet"
export type CryptoNetwork =
  | "stellar"
  | "ethereum"
  | "polygon"
  | "solana"
  | "base"

export interface ExternalAccount {
  id: string
  object: "external_account"
  type: ExternalAccountType
  account_holder_name: string
  bank_name: string
  account_last4: string
  country_code: string
  wallet_address: string
  network: string
  is_validated: boolean
  created_at: string
}

export interface CreateExternalAccountInput {
  type: ExternalAccountType
  account_holder_name?: string
  bank_name?: string
  routing_number?: string
  account_number?: string
  iban?: string
  country_code?: string
  wallet_address?: string
  network?: CryptoNetwork
}

// Transfer
export type TransferSourceType =
  | "wallet"
  | "external_account"
  | "virtual_account"
  | "payment_link"

export interface TransferEndpoint {
  type: string
  id: string
}

export interface Transfer {
  id: string
  object: "transfer"
  status: string
  amount: number
  currency: string
  fee: number | null
  customer_id: string
  source: TransferEndpoint | null
  destination: TransferEndpoint | null
  note: string
  metadata: Record<string, string>
  created_at: string
  completed_at: string | null
}

export interface CreateTransferInput {
  amount: number
  currency?: Currency
  customer_id?: string
  source_type?: TransferSourceType
  source_id?: string
  destination_type?: TransferSourceType
  destination_id?: string
  note?: string
  metadata?: Record<string, string>
}

export interface ListTransfersParams extends PaginationParams {
  status?: string
}

// Withdrawal
export interface Withdrawal {
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

export interface CreateWithdrawalInput {
  external_account_id: string
  amount: number
  currency?: Currency
  note?: string
  metadata?: Record<string, string>
}

export interface ListWithdrawalsParams extends PaginationParams {
  status?: string
}

// Payment Link
export interface PaymentLink {
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

export interface CreatePaymentLinkInput {
  amount: number
  currency?: Currency
  name?: string
  note?: string
  success_url?: string
  metadata?: Record<string, string>
}

export interface UpdatePaymentLinkInput {
  name?: string
  note?: string
  metadata?: Record<string, string>
}

export interface ListPaymentLinksParams extends PaginationParams {
  status?: string
}

// Virtual Account
export interface VirtualAccount {
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

export interface CreateVirtualAccountInput {
  nickname?: string
}

export interface ListVirtualAccountsParams extends PaginationParams {}

// Transaction
export interface Transaction {
  id: string
  object: "transaction"
  type: string
  status: string
  amount: number
  currency: string
  description: string
  created_at: string
}

export interface ListTransactionsParams extends PaginationParams {
  type?: string
  status?: string
}

// FX Rates & Quotes
export interface FxRates {
  object: "fx_rates"
  base: string
  rates: Record<string, number>
}

export interface FxQuote {
  object: "fx_quote"
  id: string
  from_currency: string
  to_currency: string
  amount: number
  converted_amount: number
  exchange_rate: number
  expires_at: string
}

// API Keys
export type ApiKeyScope =
  | "PAYMENT_LINKS_READ"
  | "PAYMENT_LINKS_WRITE"
  | "TRANSACTIONS_READ"
  | "PAYOUTS_READ"
  | "PAYOUTS_WRITE"
  | "CUSTOMERS_READ"
  | "CUSTOMERS_WRITE"
  | "WEBHOOKS_READ"
  | "WEBHOOKS_WRITE"
  | "BALANCE_READ"
  | "CHECKOUT_SESSIONS_READ"
  | "CHECKOUT_SESSIONS_WRITE"
  | "REFUNDS_READ"
  | "REFUNDS_WRITE"

export interface ApiKey {
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

export interface ApiKeyWithSecret extends ApiKey {
  key: string
}

export interface CreateApiKeyInput {
  name: string
  scopes: ApiKeyScope[]
  is_test?: boolean
  expires_in_days?: number
}

export interface UpdateApiKeyScopesInput {
  scopes: ApiKeyScope[]
}

// Team Members
export type TeamRole =
  | "admin"
  | "finance"
  | "support"
  | "developer"
  | "view_only"
  | "member"

export interface TeamMember {
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

export interface InviteTeamMemberInput {
  email: string
  role: TeamRole
}

export interface UpdateMemberRoleInput {
  role: TeamRole
}

export interface TransferOwnershipInput {
  new_owner_id: string
}

// Webhooks
export type WebhookEvent =
  | "payment.completed"
  | "payment.failed"
  | "payment.refunded"
  | "payout.completed"
  | "payout.failed"
  | "payment.link.created"
  | "payment.link.expired"
  | "checkout.session.completed"
  | "checkout.session.expired"
  | "refund.created"
  | "refund.updated"
  | "charge.succeeded"
  | "charge.failed"
  | "charge.requires_action"
  | "bill.created"
  | "bill.extracted"
  | "bill.needs.review"
  | "bill.approved"
  | "bill.approval.required"
  | "bill.payment.pending.funding"
  | "bill.payment.pending.payout"
  | "bill.paid"
  | "bill.payment.failed"
  | "bill.payment.returned"

export interface Webhook {
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

export interface WebhookWithSecret extends Webhook {
  secret: string
}

export interface CreateWebhookInput {
  url: string
  events?: WebhookEvent[]
  enabled?: boolean
  description?: string
}

export interface UpdateWebhookInput {
  url?: string
  events?: WebhookEvent[]
  enabled?: boolean
  description?: string
}

export interface ListWebhooksParams extends PaginationParams {}

// Analytics
export type AnalyticsPeriod =
  | "LAST_7_DAYS"
  | "LAST_30_DAYS"
  | "LAST_90_DAYS"
  | "LAST_365_DAYS"

export interface AnalyticsOverview {
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

// Disputes
export interface Dispute {
  id: string
  object: "dispute"
  status: string
  reason: string
  amount: number
  currency: string
  transaction_id: string
  evidence: {
    description: string
    document_urls: string[]
    submitted_at: string
  } | null
  evidence_due_by: string | null
  resolved_at: string | null
  resolution: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface ListDisputesParams extends PaginationParams {
  status?: string
}

export interface SubmitDisputeEvidenceInput {
  description: string
  document_urls?: string[]
  metadata?: Record<string, unknown>
}

// Invoices
export interface InvoiceLineItem {
  id: string
  description: string
  quantity: number
  unit_price: number
  total: number
}

export interface Invoice {
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

export interface CreateInvoiceLineItemInput {
  description: string
  quantity?: number
  unit_price: number
}

export interface CreateInvoiceInput {
  customer_id: string
  line_items: CreateInvoiceLineItemInput[]
  tax?: number
  description?: string
  due_date?: string
  currency_code?: string
  metadata?: Record<string, unknown>
}

export interface ListInvoicesParams extends PaginationParams {
  status?: string
  customer_id?: string
}

// Subscriptions
export interface Subscription {
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

export interface CreateSubscriptionInput {
  customer_id: string
  product_id: string
  interval?: string
  metadata?: Record<string, unknown>
}

export interface ListSubscriptionsParams extends PaginationParams {
  status?: string
  customer_id?: string
}

// Contacts (consumer recipients)
export interface ContactBankAccount {
  id: string
  account_number: string
  routing_number?: string
  bank_name?: string
  country?: string
  currency_id?: string
}

export interface ContactCryptoAddress {
  id: string
  network: string
  address: string
}

export interface Contact {
  id: string
  object: "recipient"
  type: string
  category: string
  first_name: string | null
  last_name: string | null
  business_name: string | null
  email: string | null
  phone_number: string | null
  is_favorite: boolean
  bank_accounts: ContactBankAccount[]
  crypto_addresses: ContactCryptoAddress[]
  created_at: string
}

export interface ListContactsParams {
  search?: string
  limit?: number
  type?: string
  category?: string
}

export interface TransferResponse {
  id: string
  status: string
  type: string
  amount?: { value: number; currency_id: string }
  created_at: string
}

// User Search (P2P network)
export interface UserSearchResult {
  id: string
  blazetag: string | null
  first_name: string | null
  last_name: string | null
  display_name: string | null
  profile_picture: string | null
  public_key: string | null
}

// P2P Payments
export interface SendPaymentInput {
  blazetag?: string
  recipientPublicKey?: string
  usdcAmountInCents: number
  fiatAmountInCents?: number
  currencyCode?: string
  exchangeRate?: number
  note?: string
}

export interface PaymentResult {
  id: string
  status: string
  [key: string]: unknown
}

// Insights (Plaid-derived business spend, read-only)
export interface InsightsDateRangeParams {
  start_date?: string
  end_date?: string
}

export interface SpendingSummary {
  object: "spending_summary"
  total_spending_cents: number
  currency: string
  by_category: unknown[]
  top_merchants: unknown[]
  weekend_pattern: unknown
  period_start: string
  period_end: string
}

export interface BankTransaction {
  id: string
  object: "bank_transaction"
  amount: number
  is_outflow: boolean
  currency: string
  merchant_name: string | null
  merchant_logo_url: string | null
  category: string | null
  category_detailed: string | null
  city: string | null
  region: string | null
  date: string
  is_pending: boolean
  institution_name: string | null
  account_mask: string | null
}

export interface ListBankTransactionsParams extends InsightsDateRangeParams {
  plaid_account_data_id?: string
  limit?: number
  cursor?: string
}

export interface BankBalanceAccount {
  plaid_account_data_id: string
  institution_name: string | null
  account_name: string | null
  mask: string | null
  available: number | null
  current: number | null
  currency: string | null
}

export interface BankBalances {
  object: "bank_balances"
  accounts: BankBalanceAccount[]
  total_available: number | null
  currency: string | null
  accounts_unavailable: number
}
