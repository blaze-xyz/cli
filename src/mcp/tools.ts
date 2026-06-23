import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { BlazeClient } from "../sdk/client"
import type { Currency, WebhookEvent } from "../sdk/types"
import {
  deriveWithdrawalAmounts,
  estimateWithdrawalArrival,
  formatConnectedPaymentMethodLabel,
  humanizeWithdrawIneligibilityReason,
  mapToPaymentMethodType,
  suggestedLocalMinimum,
  totalFeeCents,
} from "../constants/withdrawal-format"
import * as schemas from "./schemas"

function jsonResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  }
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err)
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  }
}

export function registerTools(server: McpServer, client: BlazeClient): void {
  // 1. Balance
  server.tool(
    "blaze_get_balance",
    "Get your Blaze account balance (available and pending funds)",
    {},
    async () => {
      try {
        return jsonResult(await client.getBalance())
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 2. List Customers
  server.tool(
    "blaze_list_customers",
    "List all customers with optional filters (email, archived status) and pagination",
    schemas.listCustomersSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listCustomers(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 3. Get Customer
  server.tool(
    "blaze_get_customer",
    "Get a single customer by ID",
    schemas.getCustomerSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getCustomer(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 4. Create Customer
  server.tool(
    "blaze_create_customer",
    "Create a new customer with email, name, phone, and address",
    schemas.createCustomerSchema.shape,
    async params => {
      try {
        return jsonResult(await client.createCustomer(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 5. Update Customer
  server.tool(
    "blaze_update_customer",
    "Update an existing customer's name, phone, address, or metadata",
    schemas.updateCustomerSchema.shape,
    async ({ id, ...data }) => {
      try {
        return jsonResult(await client.updateCustomer(id, data))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 6. Archive Customer
  server.tool(
    "blaze_archive_customer",
    "Archive (soft-delete) a customer by ID",
    schemas.archiveCustomerSchema.shape,
    async ({ id }) => {
      try {
        await client.archiveCustomer(id)
        return jsonResult({ success: true, message: `Customer ${id} archived` })
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 7. List External Accounts
  server.tool(
    "blaze_list_external_accounts",
    "List all external accounts (bank accounts, crypto wallets) for a customer",
    schemas.listExternalAccountsSchema.shape,
    async ({ customer_id }) => {
      try {
        return jsonResult(await client.listExternalAccounts(customer_id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 8. Create External Account
  server.tool(
    "blaze_create_external_account",
    "Add a bank account or crypto wallet to a customer",
    schemas.createExternalAccountSchema.shape,
    async ({ customer_id, ...data }) => {
      try {
        return jsonResult(await client.createExternalAccount(customer_id, data))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 9. Delete External Account
  server.tool(
    "blaze_delete_external_account",
    "Remove an external account from a customer",
    schemas.deleteExternalAccountSchema.shape,
    async ({ customer_id, account_id }) => {
      try {
        await client.deleteExternalAccount(customer_id, account_id)
        return jsonResult({
          success: true,
          message: `External account ${account_id} deleted`,
        })
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 10. List Transfers
  server.tool(
    "blaze_list_transfers",
    "List all transfers with optional status filter and pagination",
    schemas.listTransfersSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listTransfers(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 11. Get Transfer
  server.tool(
    "blaze_get_transfer",
    "Get a single transfer by ID",
    schemas.getTransferSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getTransfer(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 12. Create Transfer
  server.tool(
    "blaze_create_transfer",
    "Create a new transfer between accounts (wallet, external account, virtual account)",
    schemas.createTransferSchema.shape,
    async params => {
      try {
        return jsonResult(
          await client.createTransfer({
            ...params,
            currency: params.currency as Currency | undefined,
          })
        )
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 13. List Withdrawals
  server.tool(
    "blaze_list_withdrawals",
    "List all withdrawals with optional status filter and pagination",
    schemas.listWithdrawalsSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listWithdrawals(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 14. Get Withdrawal
  server.tool(
    "blaze_get_withdrawal",
    "Get a single withdrawal by ID",
    schemas.getWithdrawalSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getWithdrawal(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 15. Create Withdrawal
  server.tool(
    "blaze_create_withdrawal",
    "Create a new withdrawal to an external account",
    schemas.createWithdrawalSchema.shape,
    async params => {
      try {
        return jsonResult(
          await client.createWithdrawal({
            ...params,
            currency: params.currency as Currency | undefined,
          })
        )
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 16. List Payment Links
  server.tool(
    "blaze_list_payment_links",
    "List all payment links with optional status filter and pagination",
    schemas.listPaymentLinksSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listPaymentLinks(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 17. Get Payment Link
  server.tool(
    "blaze_get_payment_link",
    "Get a single payment link by ID",
    schemas.getPaymentLinkSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getPaymentLink(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 18. Create Payment Link
  server.tool(
    "blaze_create_payment_link",
    "Create a shareable payment link for collecting payments",
    schemas.createPaymentLinkSchema.shape,
    async params => {
      try {
        return jsonResult(
          await client.createPaymentLink({
            ...params,
            currency: params.currency as Currency | undefined,
          })
        )
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 19. Update Payment Link
  server.tool(
    "blaze_update_payment_link",
    "Update a payment link's name, note, or metadata",
    schemas.updatePaymentLinkSchema.shape,
    async ({ id, ...data }) => {
      try {
        return jsonResult(await client.updatePaymentLink(id, data))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 20. Cancel Payment Link
  server.tool(
    "blaze_cancel_payment_link",
    "Cancel an active payment link",
    schemas.cancelPaymentLinkSchema.shape,
    async ({ id }) => {
      try {
        await client.cancelPaymentLink(id)
        return jsonResult({
          success: true,
          message: `Payment link ${id} cancelled`,
        })
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 21. List Virtual Accounts
  server.tool(
    "blaze_list_virtual_accounts",
    "List all virtual bank accounts for a customer",
    schemas.listVirtualAccountsSchema.shape,
    async ({ customer_id, ...params }) => {
      try {
        return jsonResult(await client.listVirtualAccounts(customer_id, params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 22. Get Virtual Account
  server.tool(
    "blaze_get_virtual_account",
    "Get a single virtual account by customer and account ID",
    schemas.getVirtualAccountSchema.shape,
    async ({ customer_id, va_id }) => {
      try {
        return jsonResult(await client.getVirtualAccount(customer_id, va_id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 23. Create Virtual Account
  server.tool(
    "blaze_create_virtual_account",
    "Create a new virtual bank account for a customer to receive funds",
    schemas.createVirtualAccountSchema.shape,
    async ({ customer_id, ...data }) => {
      try {
        const input = Object.keys(data).length > 0 ? data : undefined
        return jsonResult(await client.createVirtualAccount(customer_id, input))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 24. List Transactions
  server.tool(
    "blaze_list_transactions",
    "List all transactions with optional type and status filters",
    schemas.listTransactionsSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listTransactions(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 25. Get Transaction
  server.tool(
    "blaze_get_transaction",
    "Get a single transaction by ID",
    schemas.getTransactionSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getTransaction(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 26. Send Money (convenience tool)
  server.tool(
    "blaze_send_money",
    "Send money to someone by email. Finds or creates a customer, then creates a transfer. This is a convenience wrapper.",
    schemas.sendMoneySchema.shape,
    async ({ email, amount, currency, note }) => {
      try {
        // Step 1: Find existing customer by email
        const existing = await client.listCustomers({ email })
        let customer = existing.data[0]

        // Step 2: Create customer if not found
        if (!customer) {
          customer = await client.createCustomer({ email })
        }

        // Step 3: Create transfer
        const transfer = await client.createTransfer({
          amount,
          currency: currency as Currency | undefined,
          customer_id: customer.id,
          note,
        })

        return jsonResult({
          customer,
          transfer,
          message: `Sent ${amount} ${currency ?? "USD"} to ${email}`,
        })
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 27. Get FX Rates
  server.tool(
    "blaze_get_fx_rates",
    "Get current FX exchange rates for a base currency",
    schemas.getFxRatesSchema.shape,
    async ({ base }) => {
      try {
        return jsonResult(await client.getFxRates(base))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 28. Create FX Quote
  server.tool(
    "blaze_create_fx_quote",
    "Create an FX quote to convert between currencies with a locked-in rate",
    schemas.createFxQuoteSchema.shape,
    async params => {
      try {
        return jsonResult(await client.createFxQuote(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 29. Who Am I
  server.tool(
    "blaze_whoami",
    "Check your API key status and account balance",
    {},
    async () => {
      try {
        const balance = await client.getBalance()
        return jsonResult({
          status: "authenticated",
          balance,
        })
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // --- Team Members (MCP-safe operations only) ---

  // 30. List Team Members
  server.tool(
    "blaze_list_team_members",
    "List all team members and their roles",
    schemas.listTeamMembersSchema.shape,
    async () => {
      try {
        return jsonResult(await client.listTeamMembers())
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 31. List Pending Invitations
  server.tool(
    "blaze_list_pending_invitations",
    "List pending team member invitations",
    schemas.listPendingInvitationsSchema.shape,
    async () => {
      try {
        return jsonResult(await client.listPendingInvitations())
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 32. Invite Team Member
  server.tool(
    "blaze_invite_team_member",
    "Invite a new team member by email with a specific role",
    schemas.inviteTeamMemberSchema.shape,
    async params => {
      try {
        return jsonResult(await client.inviteTeamMember(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 33. Update Member Role
  server.tool(
    "blaze_update_member_role",
    "Change a team member's role",
    schemas.updateMemberRoleSchema.shape,
    async ({ id, ...data }) => {
      try {
        return jsonResult(await client.updateMemberRole(id, data))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // --- Webhooks ---

  // 34. List Webhooks
  server.tool(
    "blaze_list_webhooks",
    "List all webhook endpoints",
    schemas.listWebhooksSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listWebhooks(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 35. Get Webhook
  server.tool(
    "blaze_get_webhook",
    "Get a webhook endpoint by ID",
    schemas.getWebhookSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getWebhook(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 36. Create Webhook
  server.tool(
    "blaze_create_webhook",
    "Create a new webhook endpoint to receive event notifications",
    schemas.createWebhookSchema.shape,
    async params => {
      try {
        return jsonResult(
          await client.createWebhook({
            ...params,
            events: params.events as WebhookEvent[] | undefined,
          })
        )
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 37. Update Webhook
  server.tool(
    "blaze_update_webhook",
    "Update a webhook endpoint's URL, events, or status",
    schemas.updateWebhookSchema.shape,
    async ({ id, ...data }) => {
      try {
        return jsonResult(
          await client.updateWebhook(id, {
            ...data,
            events: data.events as WebhookEvent[] | undefined,
          })
        )
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 38. Delete Webhook
  server.tool(
    "blaze_delete_webhook",
    "Delete a webhook endpoint",
    schemas.deleteWebhookSchema.shape,
    async ({ id }) => {
      try {
        await client.deleteWebhook(id)
        return jsonResult({ success: true, message: `Webhook ${id} deleted` })
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // --- Analytics ---

  // 39. Get Analytics Overview
  server.tool(
    "blaze_get_analytics_overview",
    "Get transaction analytics overview for a time period",
    schemas.getAnalyticsOverviewSchema.shape,
    async ({ period }) => {
      try {
        return jsonResult(await client.getAnalyticsOverview(period))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // --- Disputes ---

  // 40. List Disputes
  server.tool(
    "blaze_list_disputes",
    "List all disputes with optional status filter",
    schemas.listDisputesSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listDisputes(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 41. Get Dispute
  server.tool(
    "blaze_get_dispute",
    "Get a single dispute by ID",
    schemas.getDisputeSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getDispute(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 42. Submit Dispute Evidence
  server.tool(
    "blaze_submit_dispute_evidence",
    "Submit evidence for a dispute",
    schemas.submitDisputeEvidenceSchema.shape,
    async ({ id, ...data }) => {
      try {
        return jsonResult(await client.submitDisputeEvidence(id, data))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 43. Close Dispute
  server.tool(
    "blaze_close_dispute",
    "Close or accept a dispute",
    schemas.closeDisputeSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.closeDispute(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // --- Invoices ---

  // 44. List Invoices
  server.tool(
    "blaze_list_invoices",
    "List invoices with optional status and customer filters",
    schemas.listInvoicesSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listInvoices(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 45. Get Invoice
  server.tool(
    "blaze_get_invoice",
    "Get a single invoice by ID",
    schemas.getInvoiceSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getInvoice(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 46. Create Invoice
  server.tool(
    "blaze_create_invoice",
    "Create a new invoice for a customer",
    schemas.createInvoiceSchema.shape,
    async params => {
      try {
        return jsonResult(await client.createInvoice(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 47. Send Invoice
  server.tool(
    "blaze_send_invoice",
    "Send an invoice to the customer via email",
    schemas.sendInvoiceSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.sendInvoice(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 48. Mark Invoice Paid
  server.tool(
    "blaze_mark_invoice_paid",
    "Manually mark an invoice as paid",
    schemas.markInvoicePaidSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.markInvoicePaid(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 49. Void Invoice
  server.tool(
    "blaze_void_invoice",
    "Void an invoice so it can no longer be paid",
    schemas.voidInvoiceSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.voidInvoice(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // --- Subscriptions ---

  // 50. List Subscriptions
  server.tool(
    "blaze_list_subscriptions",
    "List subscriptions with optional status and customer filters",
    schemas.listSubscriptionsSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listSubscriptions(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 51. Get Subscription
  server.tool(
    "blaze_get_subscription",
    "Get a single subscription by ID",
    schemas.getSubscriptionSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getSubscription(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 52. Create Subscription
  server.tool(
    "blaze_create_subscription",
    "Create a new subscription for a customer",
    schemas.createSubscriptionSchema.shape,
    async params => {
      try {
        return jsonResult(await client.createSubscription(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 53. Cancel Subscription
  server.tool(
    "blaze_cancel_subscription",
    "Cancel a subscription (immediately or at period end)",
    schemas.cancelSubscriptionSchema.shape,
    async ({ id, cancel_immediately }) => {
      try {
        return jsonResult(
          await client.cancelSubscription(id, cancel_immediately)
        )
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 54. Pause Subscription
  server.tool(
    "blaze_pause_subscription",
    "Pause an active subscription",
    schemas.pauseSubscriptionSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.pauseSubscription(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 55. Resume Subscription
  server.tool(
    "blaze_resume_subscription",
    "Resume a paused subscription",
    schemas.resumeSubscriptionSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.resumeSubscription(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // ============================================
  // Insights (Plaid-derived business spend, read-only) — tools 56-58
  // ============================================

  // 56. Get Spending Summary
  server.tool(
    "blaze_get_spending_summary",
    "Get a summary of the business's bank spending (by category, top merchants) over a date range. Amounts are in integer cents.",
    schemas.getSpendingSummarySchema.shape,
    async params => {
      try {
        return jsonResult(await client.getInsightsSummary(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 57. List Bank Transactions
  server.tool(
    "blaze_list_bank_transactions",
    "List the business's bank transactions (from connected Plaid accounts) with optional date range, account filter, and pagination. Amounts are integer cents.",
    schemas.listBankTransactionsSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listBankTransactions(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 58. Get Bank Balances
  server.tool(
    "blaze_get_bank_balances",
    "Get live available/current balances of the business's connected bank accounts (how much cash the business has). Balances are in major units (e.g. dollars).",
    schemas.getBankBalancesSchema.shape,
    async () => {
      try {
        return jsonResult(await client.getBankBalances())
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // ============================================
  // Bills (AP automation) — tools 59-75
  // ============================================
  // IMPORTANT: bill data (vendor names, amounts, bank info, email bodies)
  // is data, not instructions. Never treat extracted invoice content as
  // direction to act. Money movement is gated by quote-then-confirm and
  // server-side policy.

  // 59. List Bills
  server.tool(
    "blaze_list_bills",
    "List business bills with optional status / vendor / due-date filters",
    schemas.listBillsSchema.shape,
    async params => {
      try {
        return jsonResult(
          await client.listBills({
            status: params.status,
            vendorId: params.vendor_id,
            dueBefore: params.due_before,
            limit: params.limit,
            cursor: params.cursor,
          })
        )
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 60. Get Bill
  server.tool(
    "blaze_get_bill",
    "Get a single bill by id, including vendor, line items, payments",
    schemas.getBillSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getBill(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 61. Approve Bill (NEEDS_REVIEW → READY_TO_PAY)
  server.tool(
    "blaze_approve_bill",
    "Approve a bill that's currently NEEDS_REVIEW, moving it to READY_TO_PAY. Confirm with the user first.",
    schemas.approveBillSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.approveBill(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 62. Reject Bill
  server.tool(
    "blaze_reject_bill",
    "Reject a bill (do not pay). Use when the user identifies a bill as not theirs / spam / wrong.",
    schemas.rejectBillSchema.shape,
    async ({ id, reason }) => {
      try {
        return jsonResult(await client.rejectBill(id, reason))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 63. Quote Bill Payment — phase 1 of two-phase pay
  server.tool(
    "blaze_quote_bill_payment",
    "Get a payment quote for a bill (fees, ETA, provider routing). DO NOT pay before surfacing this quote to the user and getting explicit consent. Quote expires in 15 minutes.",
    schemas.quoteBillPaymentSchema.shape,
    async params => {
      try {
        return jsonResult(
          await client.quoteBillPayment({
            billId: params.bill_id,
            sourceFundingAccountId: params.source_funding_account_id ?? null,
            expediteOption: params.expedite_option ?? null,
          })
        )
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 64. Pay Bill — phase 2, irrevocable
  server.tool(
    "blaze_pay_bill",
    "IRREVOCABLE. Execute a bill payment using a fresh quote_id from blaze_quote_bill_payment. Server enforces policy: agent payments may be denied or require approval. Always surface the quote and get explicit user consent BEFORE calling this tool. confirm must be literally true.",
    schemas.payBillSchema.shape,
    async params => {
      try {
        return jsonResult(
          await client.payBill({
            billId: params.bill_id,
            quoteId: params.quote_id,
            confirm: params.confirm,
          })
        )
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 65. List Vendors
  server.tool(
    "blaze_list_bill_vendors",
    "List bill vendors for the active business",
    schemas.listVendorsSchema.shape,
    async params => {
      try {
        return jsonResult(await client.listVendors(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 66. Get Vendor
  server.tool(
    "blaze_get_bill_vendor",
    "Get a single bill vendor",
    schemas.getVendorSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.getVendor(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 67. Connect Gmail (start) — two-tool dance for agents
  server.tool(
    "blaze_connect_gmail_start",
    "Start the Gmail OAuth flow. Returns an auth URL the user must open in their browser. After they grant consent, call blaze_connect_gmail_finalize with the session id to check completion.",
    schemas.generateGmailAuthUrlSchema.shape,
    async () => {
      try {
        return jsonResult(await client.generateGmailAuthUrl())
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 68. Connect Gmail (finalize)
  server.tool(
    "blaze_connect_gmail_finalize",
    "Check the status of an in-flight Gmail OAuth session. Call repeatedly after the user opens the auth URL until status is COMPLETE.",
    schemas.getGmailSessionSchema.shape,
    async ({ session_id }) => {
      try {
        return jsonResult(await client.getGmailConnectSession(session_id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 69. List Gmail Integrations
  server.tool(
    "blaze_list_gmail_integrations",
    "List connected Gmail accounts for the active business",
    schemas.listGmailIntegrationsSchema.shape,
    async () => {
      try {
        return jsonResult(await client.listGmailIntegrations())
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 70. Trigger Gmail Sync
  server.tool(
    "blaze_sync_bills",
    "Manually trigger a Gmail sync run. Use sparingly — sync is already scheduled every 5 minutes per integration.",
    schemas.triggerGmailSyncSchema.shape,
    async ({ integration_id }) => {
      try {
        return jsonResult(await client.triggerGmailSync(integration_id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 71. List Pending Approvals
  server.tool(
    "blaze_list_pending_bill_approvals",
    "List bills currently awaiting human approval before they can be paid",
    schemas.listPendingApprovalsSchema.shape,
    async () => {
      try {
        return jsonResult(await client.listPendingBillApprovals())
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 72. Approve Approval Request
  server.tool(
    "blaze_approve_bill_approval_request",
    "Approve a pending approval request, unlocking the bill so it can be paid",
    schemas.approveBillApprovalRequestSchema.shape,
    async ({ id }) => {
      try {
        return jsonResult(await client.approveBillApprovalRequest(id))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 73. Reject Approval Request
  server.tool(
    "blaze_reject_bill_approval_request",
    "Reject a pending approval request",
    schemas.rejectBillApprovalRequestSchema.shape,
    async ({ id, reason }) => {
      try {
        return jsonResult(await client.rejectBillApprovalRequest(id, reason))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 74. Bills Activity Log
  server.tool(
    "blaze_list_bills_activity_log",
    "List the activity log filtered to bill-related events. Useful for forensic investigation of agent vs human pays and policy decisions.",
    schemas.listBillsActivityLogSchema.shape,
    async ({ category, bill_id, limit }) => {
      try {
        return jsonResult(
          await client.listBillsActivityLog({
            category,
            resourceId: bill_id,
            limit,
          })
        )
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // ============================================
  // Duplicate Payment Detection (AI CFO Tool 6) — tools 75-76
  // ============================================

  // 75. Scan for Duplicate Payments
  server.tool(
    "blaze_cfo_duplicates",
    "Scan recent payments for potential duplicates — same vendor, similar amount, close timing. Returns grouped matches with confidence scores. Use for periodic audits or when the user asks about duplicate/double payments.",
    schemas.scanDuplicatesSchema.shape,
    async params => {
      try {
        return jsonResult(await client.scanDuplicates(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 76. Pre-execution Duplicate Check
  server.tool(
    "blaze_cfo_check_duplicate",
    "Check if a payment about to be made looks like a duplicate of a recent payment to the same vendor. Call BEFORE executing a transfer or bill payment to warn the user.",
    schemas.checkDuplicateSchema.shape,
    async params => {
      try {
        return jsonResult(await client.checkDuplicate(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // ============================================
  // Cash Flow Forecast (AI CFO Tool 1) — tool 77
  // ============================================

  // 77. Cash Flow Forecast
  server.tool(
    "blaze_cfo_forecast",
    "Project the business's cash flow forward day-by-day from current bank balance, detected recurring inflows/outflows, and upcoming invoices/bills. Returns daily projected balances, a cash-crunch date (if any), net monthly burn rate, and runway in months. Amounts are in integer minor units (cents). Use when the user asks about runway, burn rate, when they'll run out of cash, or a cash flow forecast.",
    schemas.cashFlowForecastSchema.shape,
    async params => {
      try {
        return jsonResult(await client.getCashFlowForecast(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 78. Payroll Intelligence
  server.tool(
    "blaze_cfo_payroll",
    "Analyze payroll patterns from linked bank accounts. Detects payroll providers (Gusto, ADP, Rippling, etc.), infers pay frequency, estimates monthly cost and headcount, detects contractor payments that may need 1099 reporting, and predicts next pay date. Use when the user asks about payroll, employees, headcount, contractors, or 1099s.",
    schemas.payrollAnalysisSchema.shape,
    async params => {
      try {
        return jsonResult(await client.getPayrollAnalysis(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // ============================================
  // Scenario Modeling (AI CFO Tool 4) — tool 79
  // ============================================

  // 79. Scenario Modeling
  server.tool(
    "blaze_cfo_scenario",
    "Model a 'what if' financial scenario by applying adjustments to the cash flow forecast baseline. Supports hiring (new recurring expense), losing a client (revenue decrease), large purchases (one-time cost), new revenue streams (one-time or recurring income), and delayed receivables. Returns monthly projections with runway, break-even date, and a comparison to the unadjusted baseline (runway delta, burn delta, ending-balance delta). READ-ONLY. Amounts are in integer minor units (cents). Use when the user asks 'what if' questions about hiring, revenue changes, big purchases, or runway impact.",
    schemas.scenarioModelingSchema.shape,
    async params => {
      try {
        return jsonResult(await client.modelScenario(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // ============================================
  // Bank Reconciliation (AI CFO Tool 3) — tool 80
  // ============================================

  // 80. Bank Reconciliation
  server.tool(
    "blaze_cfo_reconcile",
    "Reconcile Plaid bank transactions against internal payment records for a given period. Returns matched pairs, unmatched bank transactions, unmatched internal records, low-confidence matches, amount discrepancies, and the overall reconciliation rate. Amounts are in integer minor units (cents). Use when the user asks to reconcile their bank account, match bank transactions to records, or find missing/unrecorded transactions.",
    schemas.bankReconciliationSchema.shape,
    async params => {
      try {
        return jsonResult(await client.reconcileBankAccounts(params))
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // ============================================
  // Consumer withdrawals — withdraw own balance to own connected method
  // (bank/card). Personal/bearer session only. Tools 81-83.
  // ============================================

  // 81. List Connected Payment Methods (read-only)
  server.tool(
    "blaze_list_connected_payment_methods",
    "List YOUR OWN connected payment methods (banks/debit cards) that you can withdraw your balance to. Requires a personal/bearer session. By default returns only withdrawal-eligible methods; pass all:true to include ones you can't withdraw to (with the ineligibility reason).",
    schemas.listConnectedPaymentMethodsSchema.shape,
    async ({ all }) => {
      try {
        const result = await client.listConnectedPaymentMethods()
        const methods = all
          ? result.methods
          : result.methods.filter(m => m.canWithdraw)
        return jsonResult({
          methods,
          defaultWithdrawalMethodId: result.defaultWithdrawalMethodId,
        })
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 82. Withdraw to Connected Payment Method — irreversible
  server.tool(
    "blaze_withdraw_to_payment_method",
    "IRREVERSIBLE. Withdraw YOUR OWN balance to YOUR OWN connected payment method (bank/debit card). Requires a personal/bearer session. Always surface the amount AND destination to the user and get explicit consent BEFORE calling — confirm must be literally true. For USD the USDC amount equals the fiat amount; for other currencies the USDC amount is an FX estimate from the same client-side rate table the app uses.",
    schemas.withdrawToPaymentMethodSchema.shape,
    async params => {
      try {
        // Context guard: the consumer mutation reads userId from a personal
        // (bearer) JWT — an API-key/business context is rejected server-side.
        if (client.authContext === "business") {
          return errorResult(
            new Error(
              "Withdrawing to your own connected method requires a personal session (bearer token), not an API key."
            )
          )
        }

        const currency = (params.currency ?? "USD").toUpperCase()

        // Amount + currency math via the single source of truth.
        const derived = deriveWithdrawalAmounts({
          amount: params.amount,
          currency,
        })
        if (!derived.ok) {
          return errorResult(new Error(derived.error))
        }
        const { fiatAmountInCents, usdcAmountInCents } = derived.amounts

        // Resolve the destination from the user's withdrawal-eligible methods.
        const { methods } = await client.listConnectedPaymentMethods()
        const eligible = methods.filter(m => m.canWithdraw)
        const method = methods.find(m => m.id === params.payment_method_id)
        if (!method) {
          return errorResult(
            new Error(
              `Payment method "${params.payment_method_id}" is not one of your connected methods. Eligible: ${
                eligible
                  .map(m => `${m.id} (${formatConnectedPaymentMethodLabel(m)})`)
                  .join(", ") || "none"
              }.`
            )
          )
        }
        if (!method.canWithdraw) {
          return errorResult(
            new Error(
              `That method (${formatConnectedPaymentMethodLabel(method)}) can't be withdrawn to: ${humanizeWithdrawIneligibilityReason(method.withdrawIneligibilityReason)}.`
            )
          )
        }

        // Instant default: cards push-to-card (instant), banks standard. The
        // SAME value is used for the mutation and the arrival estimate.
        const instantTransfer =
          params.instant_transfer !== undefined
            ? params.instant_transfer
            : method.type === "Card"

        // Balance pre-check (against the USDC amount drawn from balance).
        const balance = await client.getBalance()
        const availableCents =
          typeof balance.available === "object"
            ? (balance.available as { amount: number }).amount
            : (balance.available as number)
        if (availableCents < usdcAmountInCents) {
          return errorResult(
            new Error(
              `You don't have enough balance for this withdrawal — it needs about $${(usdcAmountInCents / 100).toFixed(2)} but you have $${(availableCents / 100).toFixed(2)} available. Try a smaller amount or add funds first.`
            )
          )
        }

        // Minimum / limit pre-check via the live `checkLimits` query — the
        // minimum is server-sourced (never hardcoded). Best-effort: if the
        // check itself throws, continue (the server enforces on submit).
        try {
          const limits = await client.checkWithdrawalLimits({
            paymentMethodId: method.id,
            fiatAmountInCents,
            currencyCode: currency,
          })
          if (!limits.meetsMinimum) {
            const minUsd = limits.minimumAmountCents / 100
            let localNote = ""
            if (currency !== "USD") {
              // Best-effort live rate so the suggested local minimum actually
              // clears the USD minimum (the static USD_RATES table lags).
              let rate: number | null = null
              try {
                rate = await client.getExchangeRate(currency, "USD")
              } catch {
                // best-effort; fall back to the static estimate inside the helper
              }
              localNote = ` (about ${suggestedLocalMinimum(minUsd, currency, rate)} ${currency})`
            }
            return errorResult(
              new Error(
                `Withdrawals must be at least $${minUsd.toFixed(2)} USD${localNote}. You entered ${params.amount} ${currency}.`
              )
            )
          }
          if (!limits.isUnderLimit) {
            const rem =
              limits.remainingUsdCents != null
                ? `$${(limits.remainingUsdCents / 100).toFixed(2)} USD`
                : "none"
            return errorResult(
              new Error(
                `This is over your current withdrawal limit — you have about ${rem} of your limit left right now.`
              )
            )
          }
        } catch {
          // Limit check is best-effort; the server enforces minimums/limits on submit.
        }

        const result = await client.withdrawToPaymentMethod({
          paymentMethodId: method.id,
          usdcAmountInCents,
          fiatAmountInCents,
          currencyCode: currency,
          instantTransfer,
        })
        // The SDK throws on a null result, but stay null-safe here.
        if (!result) {
          return errorResult(
            new Error(
              "Your withdrawal didn't return a result. Check your recent activity before retrying — it may already be processing."
            )
          )
        }
        // Best-effort: fetch the real fee from the submitted transfer. The
        // withdrawal already succeeded, so a failed fetch must NOT error out.
        let fee: string | undefined
        try {
          if (result.rampTransferId) {
            const t = await client.getRampTransfer(result.rampTransferId)
            const fc = totalFeeCents(t.feeCollections)
            if (fc > 0) fee = `$${(fc / 100).toFixed(2)}`
          }
        } catch {
          /* best-effort */
        }
        return jsonResult({
          ...result,
          fee, // e.g. "$2.00" (undefined if unknown)
          estimatedArrival: estimateWithdrawalArrival({
            instantTransfer,
            currency,
          }),
        })
      } catch (err) {
        return errorResult(err)
      }
    }
  )

  // 83. Estimate Withdrawal Fee — read-only fee preview (no money moves)
  server.tool(
    "blaze_estimate_withdrawal_fee",
    "Preview the EXACT withdrawal fee for a connected payment method BEFORE withdrawing (read-only; no money moves). Use this to tell the user the fee and total debited before they confirm an irreversible withdrawal. Resolves the destination from the user's withdrawal-eligible methods and uses the same `applicableFee` calculation the app shows.",
    schemas.estimateWithdrawalFeeSchema.shape,
    async params => {
      try {
        const { methods, countryCode } =
          await client.listConnectedPaymentMethods()
        const method = methods.find(m => m.id === params.payment_method_id)
        if (!method || !method.canWithdraw) {
          return errorResult(
            new Error(
              `Payment method "${params.payment_method_id}" is not one of your withdrawal-eligible methods.`
            )
          )
        }

        const currency = (params.currency ?? "USD").toUpperCase()
        const derived = deriveWithdrawalAmounts({
          amount: params.amount,
          currency,
        })
        if (!derived.ok) {
          return errorResult(new Error(derived.error))
        }
        const { usdcAmountInCents } = derived.amounts

        const pmType = mapToPaymentMethodType(method.type)
        const feeEst = pmType
          ? await client.getApplicableWithdrawalFee({
              paymentMethodType: pmType,
              providerId: method.provider?.id,
              countryCode,
              amountCents: usdcAmountInCents,
            })
          : null
        const feeCents = feeEst?.totalFeeCents ?? null

        return jsonResult({
          feeCents,
          feeUsd: feeCents != null ? `$${(feeCents / 100).toFixed(2)}` : null,
          displayName: feeEst?.displayName ?? null,
          totalDebitedUsdc: `$${((usdcAmountInCents + (feeCents ?? 0)) / 100).toFixed(2)}`,
          note: "Estimate; the exact fee is confirmed at withdrawal.",
        })
      } catch (err) {
        return errorResult(err)
      }
    }
  )
}
