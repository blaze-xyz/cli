import { z } from "zod/v3"

// Balance
// No input schema needed (no parameters)

// Customers
export const listCustomersSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  email: z.string().optional().describe("Filter by email address"),
  include_archived: z
    .boolean()
    .optional()
    .describe("Include archived customers"),
})

export const getCustomerSchema = z.object({
  id: z.string().describe("Customer ID"),
})

export const createCustomerSchema = z.object({
  email: z.string().describe("Customer email address"),
  first_name: z.string().optional().describe("First name"),
  last_name: z.string().optional().describe("Last name"),
  phone: z.string().optional().describe("Phone number"),
  address: z
    .object({
      line1: z.string().optional().describe("Street address"),
      city: z.string().optional().describe("City"),
      state: z.string().optional().describe("State or province"),
      postal_code: z.string().optional().describe("Postal / ZIP code"),
      country: z.string().optional().describe("Country code (e.g. US, MX)"),
    })
    .optional()
    .describe("Customer address"),
  metadata: z
    .record(z.string())
    .optional()
    .describe("Arbitrary key-value metadata"),
})

export const updateCustomerSchema = z.object({
  id: z.string().describe("Customer ID"),
  first_name: z.string().optional().describe("First name"),
  last_name: z.string().optional().describe("Last name"),
  phone: z.string().optional().describe("Phone number"),
  address: z
    .object({
      line1: z.string().optional().describe("Street address"),
      city: z.string().optional().describe("City"),
      state: z.string().optional().describe("State or province"),
      postal_code: z.string().optional().describe("Postal / ZIP code"),
      country: z.string().optional().describe("Country code (e.g. US, MX)"),
    })
    .optional()
    .describe("Customer address"),
  metadata: z
    .record(z.string())
    .optional()
    .describe("Arbitrary key-value metadata"),
})

export const archiveCustomerSchema = z.object({
  id: z.string().describe("Customer ID"),
})

// External Accounts
export const listExternalAccountsSchema = z.object({
  customer_id: z.string().describe("Customer ID"),
})

export const createExternalAccountSchema = z.object({
  customer_id: z.string().describe("Customer ID"),
  type: z.enum(["us_bank", "iban", "crypto_wallet"]).describe("Account type"),
  account_holder_name: z.string().optional().describe("Name on the account"),
  bank_name: z.string().optional().describe("Bank name"),
  routing_number: z.string().optional().describe("Routing number (US bank)"),
  account_number: z.string().optional().describe("Account number (US bank)"),
  iban: z.string().optional().describe("IBAN (international bank)"),
  country_code: z.string().optional().describe("Country code (e.g. US, MX)"),
  wallet_address: z.string().optional().describe("Crypto wallet address"),
  network: z
    .enum(["stellar", "ethereum", "polygon", "solana", "base"])
    .optional()
    .describe("Crypto network"),
})

export const deleteExternalAccountSchema = z.object({
  customer_id: z.string().describe("Customer ID"),
  account_id: z.string().describe("External account ID"),
})

// Transfers
export const listTransfersSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  status: z
    .string()
    .optional()
    .describe("Filter by status (e.g. pending, completed, failed)"),
})

export const getTransferSchema = z.object({
  id: z.string().describe("Transfer ID"),
})

export const createTransferSchema = z.object({
  amount: z.number().positive().describe("Transfer amount"),
  currency: z
    .string()
    .optional()
    .describe("Currency code (e.g. USD, MXN). Defaults to USD"),
  customer_id: z.string().optional().describe("Customer ID"),
  source_type: z
    .enum(["wallet", "external_account", "virtual_account", "payment_link"])
    .optional()
    .describe("Source type"),
  source_id: z.string().optional().describe("Source resource ID"),
  destination_type: z
    .enum(["wallet", "external_account", "virtual_account", "payment_link"])
    .optional()
    .describe("Destination type"),
  destination_id: z.string().optional().describe("Destination resource ID"),
  note: z.string().optional().describe("Transfer note or memo"),
  metadata: z
    .record(z.string())
    .optional()
    .describe("Arbitrary key-value metadata"),
})

// Withdrawals
export const listWithdrawalsSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  status: z
    .string()
    .optional()
    .describe("Filter by status (e.g. pending, completed, failed)"),
})

export const getWithdrawalSchema = z.object({
  id: z.string().describe("Withdrawal ID"),
})

export const createWithdrawalSchema = z.object({
  external_account_id: z
    .string()
    .describe("External account ID to withdraw to"),
  amount: z.number().positive().describe("Withdrawal amount"),
  currency: z
    .string()
    .optional()
    .describe("Currency code (e.g. USD, MXN). Defaults to USD"),
  note: z.string().optional().describe("Withdrawal note or memo"),
  metadata: z
    .record(z.string())
    .optional()
    .describe("Arbitrary key-value metadata"),
})

// Payment Links
export const listPaymentLinksSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  status: z
    .string()
    .optional()
    .describe("Filter by status (e.g. active, completed, cancelled)"),
})

export const getPaymentLinkSchema = z.object({
  id: z.string().describe("Payment link ID"),
})

export const createPaymentLinkSchema = z.object({
  amount: z.number().positive().describe("Payment amount"),
  currency: z
    .string()
    .optional()
    .describe("Currency code (e.g. USD, MXN). Defaults to USD"),
  name: z.string().optional().describe("Display name for the payment link"),
  note: z.string().optional().describe("Note or description"),
  success_url: z
    .string()
    .optional()
    .describe("URL to redirect to after successful payment"),
  metadata: z
    .record(z.string())
    .optional()
    .describe("Arbitrary key-value metadata"),
})

export const updatePaymentLinkSchema = z.object({
  id: z.string().describe("Payment link ID"),
  name: z.string().optional().describe("Display name for the payment link"),
  note: z.string().optional().describe("Note or description"),
  metadata: z
    .record(z.string())
    .optional()
    .describe("Arbitrary key-value metadata"),
})

export const cancelPaymentLinkSchema = z.object({
  id: z.string().describe("Payment link ID"),
})

// Virtual Accounts
export const listVirtualAccountsSchema = z.object({
  customer_id: z.string().describe("Customer ID"),
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100)"),
  cursor: z.string().optional().describe("Pagination cursor"),
})

export const getVirtualAccountSchema = z.object({
  customer_id: z.string().describe("Customer ID"),
  va_id: z.string().describe("Virtual account ID"),
})

export const createVirtualAccountSchema = z.object({
  customer_id: z.string().describe("Customer ID"),
  nickname: z
    .string()
    .optional()
    .describe("Friendly name for the virtual account"),
})

// Transactions
export const listTransactionsSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  type: z.string().optional().describe("Filter by transaction type"),
  status: z.string().optional().describe("Filter by status"),
})

export const getTransactionSchema = z.object({
  id: z.string().describe("Transaction ID"),
})

// Convenience / Utility tools
export const sendMoneySchema = z.object({
  email: z
    .string()
    .describe("Recipient email address. Will find or create a customer."),
  amount: z.number().positive().describe("Amount to send"),
  currency: z
    .string()
    .optional()
    .describe("Currency code (e.g. USD, MXN). Defaults to USD"),
  note: z.string().optional().describe("Transfer note or memo"),
})

// FX Rates & Quotes
export const getFxRatesSchema = z.object({
  base: z.string().optional().describe("Base currency code (default: USD)"),
})

export const createFxQuoteSchema = z.object({
  from_currency: z.string().describe("Source currency code (e.g. USD)"),
  to_currency: z.string().describe("Target currency code (e.g. MXN)"),
  amount: z.number().positive().describe("Amount in source currency"),
})

// Team Members (MCP-safe operations only — no remove, no transfer-ownership)
export const listTeamMembersSchema = z.object({})

export const listPendingInvitationsSchema = z.object({})

export const inviteTeamMemberSchema = z.object({
  email: z.string().describe("Email address to invite"),
  role: z
    .enum(["admin", "finance", "support", "developer", "view_only", "member"])
    .describe("Team role to assign"),
})

export const updateMemberRoleSchema = z.object({
  id: z.string().describe("Team member ID"),
  role: z
    .enum(["admin", "finance", "support", "developer", "view_only", "member"])
    .describe("New role to assign"),
})

// Webhooks
export const listWebhooksSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100)"),
  cursor: z.string().optional().describe("Pagination cursor"),
})

export const getWebhookSchema = z.object({
  id: z.string().describe("Webhook endpoint ID"),
})

export const createWebhookSchema = z.object({
  url: z.string().describe("HTTPS URL to receive webhook events"),
  events: z
    .array(z.string())
    .optional()
    .describe(
      "Event types to subscribe to (e.g. payment.completed, payout.failed)"
    ),
  enabled: z
    .boolean()
    .optional()
    .describe("Whether the webhook is active (default: true)"),
  description: z.string().optional().describe("Description of this endpoint"),
})

export const updateWebhookSchema = z.object({
  id: z.string().describe("Webhook endpoint ID"),
  url: z.string().optional().describe("New HTTPS URL"),
  events: z.array(z.string()).optional().describe("New event types"),
  enabled: z.boolean().optional().describe("Enable or disable"),
  description: z.string().optional().describe("New description"),
})

export const deleteWebhookSchema = z.object({
  id: z.string().describe("Webhook endpoint ID"),
})

// Analytics
export const getAnalyticsOverviewSchema = z.object({
  period: z
    .enum(["LAST_7_DAYS", "LAST_30_DAYS", "LAST_90_DAYS", "LAST_365_DAYS"])
    .optional()
    .describe("Time period for analytics (default: LAST_30_DAYS)"),
})

// Disputes
export const listDisputesSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  status: z.string().optional().describe("Filter by dispute status"),
})

export const getDisputeSchema = z.object({
  id: z.string().describe("Dispute ID"),
})

export const submitDisputeEvidenceSchema = z.object({
  id: z.string().describe("Dispute ID"),
  description: z.string().describe("Evidence description"),
  document_urls: z
    .array(z.string())
    .optional()
    .describe("URLs to supporting documents"),
  metadata: z.record(z.unknown()).optional().describe("Additional metadata"),
})

export const closeDisputeSchema = z.object({
  id: z.string().describe("Dispute ID"),
})

// Invoices
export const listInvoicesSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  status: z.string().optional().describe("Filter by invoice status"),
  customer_id: z.string().optional().describe("Filter by customer ID"),
})

export const getInvoiceSchema = z.object({
  id: z.string().describe("Invoice ID"),
})

export const createInvoiceSchema = z.object({
  customer_id: z.string().describe("Customer ID"),
  line_items: z
    .array(
      z.object({
        description: z.string().describe("Line item description"),
        quantity: z.number().optional().describe("Quantity (default: 1)"),
        unit_price: z.number().describe("Unit price"),
      })
    )
    .describe("Invoice line items"),
  tax: z.number().optional().describe("Tax amount"),
  description: z.string().optional().describe("Invoice description"),
  due_date: z.string().optional().describe("Due date (ISO 8601)"),
  currency_code: z.string().optional().describe("Currency code (default: USD)"),
  metadata: z.record(z.unknown()).optional().describe("Arbitrary metadata"),
})

export const sendInvoiceSchema = z.object({
  id: z.string().describe("Invoice ID"),
})

export const markInvoicePaidSchema = z.object({
  id: z.string().describe("Invoice ID"),
})

export const voidInvoiceSchema = z.object({
  id: z.string().describe("Invoice ID"),
})

// Subscriptions
export const listSubscriptionsSchema = z.object({
  limit: z
    .number()
    .min(1)
    .max(100)
    .optional()
    .describe("Max results to return (1-100)"),
  cursor: z.string().optional().describe("Pagination cursor"),
  status: z.string().optional().describe("Filter by subscription status"),
  customer_id: z.string().optional().describe("Filter by customer ID"),
})

export const getSubscriptionSchema = z.object({
  id: z.string().describe("Subscription ID"),
})

export const createSubscriptionSchema = z.object({
  customer_id: z.string().describe("Customer ID"),
  product_id: z.string().describe("Product ID"),
  interval: z
    .string()
    .optional()
    .describe("Billing interval (e.g. monthly, yearly)"),
  metadata: z.record(z.unknown()).optional().describe("Arbitrary metadata"),
})

export const cancelSubscriptionSchema = z.object({
  id: z.string().describe("Subscription ID"),
  cancel_immediately: z
    .boolean()
    .optional()
    .describe("Cancel now vs at period end (default: false)"),
})

export const pauseSubscriptionSchema = z.object({
  id: z.string().describe("Subscription ID"),
})

export const resumeSubscriptionSchema = z.object({
  id: z.string().describe("Subscription ID"),
})
