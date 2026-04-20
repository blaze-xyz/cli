import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { BlazeClient } from "../sdk/client"
import type { Currency, WebhookEvent } from "../sdk/types"
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
}
