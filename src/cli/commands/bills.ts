import { confirm } from "@inquirer/prompts"
import { Command } from "commander"

import { formatOutput } from "../output"
import { getClient, getGlobalOpts, handleError } from "../utils"

// ============================================
// GraphQL operations (inline — bills surface is GraphQL-only).
// ============================================

const LIST_BILLS_QUERY = `
  query BlazeBillsList(
    $status: BusinessBillStatus
    $vendorId: ID
    $dueBefore: DateTime
    $limit: Int
    $cursor: String
  ) {
    businessBills(
      status: $status
      vendorId: $vendorId
      dueBefore: $dueBefore
      limit: $limit
      cursor: $cursor
    ) {
      nodes {
        id
        invoiceNumber
        amountInMinorUnits
        currencyCode
        dueDate
        status
        source
        extractionConfidence
        vendor { id name }
      }
      pageInfo { hasNextPage endCursor totalCount }
    }
  }
`

const GET_BILL_QUERY = `
  query BlazeBillGet($id: ID!) {
    businessBill(id: $id) {
      id
      invoiceNumber
      vendorInvoiceUrl
      amountInMinorUnits
      currencyCode
      issueDate
      dueDate
      source
      status
      version
      requiresApproval
      bankFieldsChanged
      extractionConfidence
      extractionModelUsed
      vendor {
        id
        name
        primaryEmailDomain
        defaultRoutingNumber
        defaultAccountLast4
        defaultBankName
        verifiedAt
      }
      lineItems { description quantity amountInMinorUnits ordinal }
      payments { id status leg2Provider createdAt }
      createdAt
      updatedAt
    }
  }
`

const QUOTE_BILL_MUTATION = `
  mutation BlazeBillQuote($input: QuoteBusinessBillPaymentInput!) {
    quoteBusinessBillPayment(input: $input) {
      id
      leg1Provider
      leg1FeeInMinorUnits
      leg2Provider
      leg2FeeInMinorUnits
      totalFeeInMinorUnits
      etaBusinessDays
      expiresAt
    }
  }
`

const PAY_BILL_MUTATION = `
  mutation BlazeBillPay($input: PayBusinessBillInput!) {
    payBusinessBill(input: $input) {
      id
      billId
      status
      leg1Provider
      leg2Provider
      createdAt
    }
  }
`

const PENDING_APPROVALS_QUERY = `
  query BlazeBillsPendingApprovals {
    businessBillPendingApprovals {
      id
      resourceType
      resourceId
      reason
      policyRuleFired
      paymentIntent
      status
      expiresAt
      createdAt
    }
  }
`

const APPROVE_APPROVAL_MUTATION = `
  mutation BlazeBillsApprovalApprove($id: ID!) {
    approveBusinessBillApprovalRequest(id: $id) { id status }
  }
`

const REJECT_APPROVAL_MUTATION = `
  mutation BlazeBillsApprovalReject($id: ID!, $reason: String) {
    rejectBusinessBillApprovalRequest(id: $id, reason: $reason) { id status }
  }
`

const ACTIVITY_LOG_QUERY = `
  query BlazeBillsActivity($category: String, $resourceId: ID, $limit: Int) {
    businessActivityLog(
      category: $category
      resourceId: $resourceId
      limit: $limit
    ) {
      id
      category
      actorType
      outcome
      message
      resourceType
      resourceId
      policyRule
      createdAt
    }
  }
`

const APPROVE_BILL_MUTATION = `
  mutation BlazeBillApprove($id: ID!) {
    approveBusinessBill(id: $id) { id status approvedAt }
  }
`

const REJECT_BILL_MUTATION = `
  mutation BlazeBillReject($id: ID!, $reason: String) {
    rejectBusinessBill(id: $id, reason: $reason) { id status rejectionReason }
  }
`

const LIST_VENDORS_QUERY = `
  query BlazeBillsVendors($limit: Int) {
    businessVendors(limit: $limit) {
      id
      name
      primaryEmailDomain
      defaultAccountLast4
      verifiedAt
    }
  }
`

const GENERATE_GMAIL_AUTH_URL_MUTATION = `
  mutation BlazeBillsGmailAuth { generateGmailAuthUrl { id status authUrl expiresAt } }
`

const GMAIL_SESSION_QUERY = `
  query BlazeBillsGmailSession($sessionId: ID!) {
    gmailConnectSession(sessionId: $sessionId) {
      id
      status
      errorMessage
      integration { id gmailAddress status lastSyncedAt }
    }
  }
`

const LIST_GMAIL_INTEGRATIONS_QUERY = `
  query BlazeBillsGmailList {
    businessGmailIntegrations {
      id
      gmailAddress
      status
      lastSyncedAt
      lastSyncError
      createdAt
    }
  }
`

const DISCONNECT_GMAIL_MUTATION = `
  mutation BlazeBillsGmailDisconnect($id: ID!) {
    disconnectBusinessGmailIntegration(id: $id)
  }
`

const TRIGGER_SYNC_MUTATION = `
  mutation BlazeBillsGmailSync($integrationId: ID) {
    triggerBusinessGmailSync(integrationId: $integrationId)
  }
`

// ============================================
// Command registration
// ============================================

export function registerBillsCommands(program: Command): void {
  const bills = program
    .command("bills")
    .description("Manage bills (accounts-payable)")

  // ----------------------------------------
  // bills list
  // ----------------------------------------
  bills
    .command("list")
    .description("List bills for the active business")
    .option("--status <status>", "Filter by status (e.g. READY_TO_PAY, PAID)")
    .option("--vendor-id <id>", "Filter by vendor id")
    .option("--due-before <iso>", "Only bills due before this date (ISO 8601)")
    .option("--limit <n>", "Page size", v => parseInt(v, 10))
    .option("--cursor <cursor>", "Cursor for pagination")
    .action(
      async (opts: {
        status?: string
        vendorId?: string
        dueBefore?: string
        limit?: number
        cursor?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)
          const result = await client.graphqlRequest<{
            businessBills: { nodes: unknown[]; pageInfo: unknown }
          }>(LIST_BILLS_QUERY, {
            status: opts.status,
            vendorId: opts.vendorId,
            dueBefore: opts.dueBefore,
            limit: opts.limit,
            cursor: opts.cursor,
          })
          formatOutput(result.businessBills.nodes, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  // ----------------------------------------
  // bills show <id>
  // ----------------------------------------
  bills
    .command("show <id>")
    .description("Show a bill")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.graphqlRequest<{ businessBill: unknown }>(
          GET_BILL_QUERY,
          { id }
        )
        formatOutput(result.businessBill, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  // ----------------------------------------
  // bills approve <id> / reject <id>
  // ----------------------------------------
  bills
    .command("approve <id>")
    .description("Approve a bill (NEEDS_REVIEW → READY_TO_PAY)")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.graphqlRequest<{
          approveBusinessBill: unknown
        }>(APPROVE_BILL_MUTATION, { id })
        formatOutput(result.approveBusinessBill, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  bills
    .command("reject <id>")
    .description("Reject a bill")
    .option("--reason <text>", "Rejection reason")
    .action(async (id: string, opts: { reason?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.graphqlRequest<{
          rejectBusinessBill: unknown
        }>(REJECT_BILL_MUTATION, { id, reason: opts.reason })
        formatOutput(result.rejectBusinessBill, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  // ----------------------------------------
  // bills pay <id>
  // ----------------------------------------
  bills
    .command("pay <id>")
    .description(
      "Pay a bill (two-phase: quote → confirm). Server enforces policy."
    )
    .option(
      "--from <source-id>",
      "Funding source (BusinessExternalAccount id; null = Blaze balance)"
    )
    .option(
      "--expedite <mode>",
      "ACH Pull expedite option (fast | cheap | auto)"
    )
    .option("-y, --yes", "Skip confirmation")
    .action(
      async (
        id: string,
        opts: { from?: string; expedite?: string; yes?: boolean }
      ) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)

          // 1. Get quote
          const quoteRes = await client.graphqlRequest<{
            quoteBusinessBillPayment: {
              id: string
              leg1Provider: string | null
              leg1FeeInMinorUnits: number
              leg2Provider: string
              leg2FeeInMinorUnits: number
              totalFeeInMinorUnits: number
              etaBusinessDays: number
            }
          }>(QUOTE_BILL_MUTATION, {
            input: {
              billId: id,
              sourceFundingAccountId: opts.from,
              expediteOption: opts.expedite,
            },
          })
          const quote = quoteRes.quoteBusinessBillPayment

          const bill = await client.graphqlRequest<{
            businessBill: {
              amountInMinorUnits: number
              currencyCode: string
              vendor: { name: string }
            } | null
          }>(GET_BILL_QUERY, { id })
          if (!bill.businessBill) {
            console.error("Bill not found")
            process.exit(1)
          }
          const amountFmt = (
            bill.businessBill.amountInMinorUnits / 100
          ).toFixed(2)
          const feeFmt = (quote.totalFeeInMinorUnits / 100).toFixed(2)

          console.log(
            `\n${amountFmt} ${bill.businessBill.currencyCode} to "${bill.businessBill.vendor.name}"`
          )
          console.log(
            `  Leg 1: ${quote.leg1Provider ?? "skip"} (fee ${(quote.leg1FeeInMinorUnits / 100).toFixed(2)})`
          )
          console.log(
            `  Leg 2: ${quote.leg2Provider} (fee ${(quote.leg2FeeInMinorUnits / 100).toFixed(2)})`
          )
          console.log(
            `  Total fees: ${feeFmt} · ETA: ${quote.etaBusinessDays} business day(s)\n`
          )

          if (!opts.yes) {
            const ok = await confirm({
              message: `Confirm payment?`,
              default: false,
            })
            if (!ok) {
              console.log("Cancelled.")
              return
            }
          }

          const result = await client.graphqlRequest<{
            payBusinessBill: unknown
          }>(PAY_BILL_MUTATION, {
            input: { billId: id, quoteId: quote.id, confirm: true },
          })
          formatOutput(result.payBusinessBill, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  // ----------------------------------------
  // bills pending-approvals *
  // ----------------------------------------
  const pa = bills
    .command("pending-approvals")
    .description("Manage approval requests waiting for human review")

  pa.command("list")
    .description("List pending approval requests")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.graphqlRequest<{
          businessBillPendingApprovals: unknown[]
        }>(PENDING_APPROVALS_QUERY)
        formatOutput(result.businessBillPendingApprovals, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  pa.command("approve <approvalId>")
    .description("Approve a pending approval request")
    .action(async (approvalId: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.graphqlRequest<{
          approveBusinessBillApprovalRequest: unknown
        }>(APPROVE_APPROVAL_MUTATION, { id: approvalId })
        formatOutput(result.approveBusinessBillApprovalRequest, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  pa.command("reject <approvalId>")
    .description("Reject a pending approval request")
    .option("--reason <text>", "Rejection reason")
    .action(async (approvalId: string, opts: { reason?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.graphqlRequest<{
          rejectBusinessBillApprovalRequest: unknown
        }>(REJECT_APPROVAL_MUTATION, { id: approvalId, reason: opts.reason })
        formatOutput(result.rejectBusinessBillApprovalRequest, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  // ----------------------------------------
  // bills logs — activity log
  // ----------------------------------------
  bills
    .command("logs")
    .description("Show recent activity log entries")
    .option("--bill <id>", "Filter to a single bill")
    .option("--category <cat>", "Filter by category (e.g. bill.pay.initiated)")
    .option("--limit <n>", "Page size", v => parseInt(v, 10))
    .action(
      async (opts: { bill?: string; category?: string; limit?: number }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = await getClient(globals)
          const result = await client.graphqlRequest<{
            businessActivityLog: unknown[]
          }>(ACTIVITY_LOG_QUERY, {
            category: opts.category,
            resourceId: opts.bill,
            limit: opts.limit,
          })
          formatOutput(result.businessActivityLog, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  // ----------------------------------------
  // bills vendors *
  // ----------------------------------------
  const vendors = bills.command("vendors").description("Manage vendors")
  vendors
    .command("list")
    .description("List vendors")
    .option("--limit <n>", "Page size", v => parseInt(v, 10))
    .action(async (opts: { limit?: number }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.graphqlRequest<{
          businessVendors: unknown[]
        }>(LIST_VENDORS_QUERY, { limit: opts.limit })
        formatOutput(result.businessVendors, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  // ----------------------------------------
  // bills connect-gmail
  // ----------------------------------------
  bills
    .command("connect-gmail")
    .description("Connect a Gmail account to the active business")
    .option("--no-browser", "Don't try to open a browser (just print URL)")
    .action(async (opts: { browser: boolean }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)

        // 1. Generate auth session
        const session = await client.graphqlRequest<{
          generateGmailAuthUrl: {
            id: string
            authUrl: string
            expiresAt: string
          }
        }>(GENERATE_GMAIL_AUTH_URL_MUTATION)

        const { id: sessionId, authUrl } = session.generateGmailAuthUrl
        console.log(`\nOpening browser to connect Gmail.`)
        console.log(`If it didn't open, visit:\n  ${authUrl}\n`)

        // 2. Open browser (lazy import — `open` is already a dependency)
        if (opts.browser !== false) {
          try {
            const open = (await import("open")).default
            await open(authUrl)
          } catch {
            // Silent — URL was already printed
          }
        }

        // 3. Poll for completion (5-min timeout, 2s interval)
        console.log("Waiting for authorization (5 min timeout)…")
        const deadline = Date.now() + 5 * 60 * 1000
        while (Date.now() < deadline) {
          await new Promise(r => setTimeout(r, 2000))
          const status = await client.graphqlRequest<{
            gmailConnectSession: {
              status: string
              errorMessage?: string
              integration?: { gmailAddress: string } | null
            } | null
          }>(GMAIL_SESSION_QUERY, { sessionId })
          const s = status.gmailConnectSession
          if (!s) {
            console.error("Session lost.")
            process.exit(1)
          }
          if (s.status === "COMPLETE") {
            console.log(`\n✓ Connected as ${s.integration?.gmailAddress}`)
            console.log(
              "First sync will run automatically — or run `blaze bills sync` to pull now."
            )
            return
          }
          if (s.status === "FAILED") {
            console.error(`\n✗ Failed: ${s.errorMessage ?? "unknown error"}`)
            process.exit(1)
          }
          if (s.status === "EXPIRED") {
            console.error("\n✗ Session expired. Run the command again.")
            process.exit(1)
          }
        }
        console.error("\n✗ Timed out waiting for authorization.")
        process.exit(1)
      } catch (err) {
        handleError(err)
      }
    })

  // ----------------------------------------
  // bills gmail-integrations *
  // ----------------------------------------
  const gmail = bills
    .command("gmail-integrations")
    .description("Manage connected Gmail accounts")
  gmail
    .command("list")
    .description("List Gmail integrations")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.graphqlRequest<{
          businessGmailIntegrations: unknown[]
        }>(LIST_GMAIL_INTEGRATIONS_QUERY)
        formatOutput(result.businessGmailIntegrations, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  gmail
    .command("disconnect <id>")
    .description("Disconnect a Gmail integration")
    .option("-y, --yes", "Skip confirmation")
    .action(async (id: string, opts: { yes?: boolean }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)

        if (!opts.yes) {
          const ok = await confirm({
            message: `Disconnect Gmail integration ${id}?`,
            default: false,
          })
          if (!ok) {
            console.log("Cancelled.")
            return
          }
        }

        await client.graphqlRequest<{
          disconnectBusinessGmailIntegration: boolean
        }>(DISCONNECT_GMAIL_MUTATION, { id })
        console.log("✓ Disconnected.")
      } catch (err) {
        handleError(err)
      }
    })

  // ----------------------------------------
  // bills sync — manual trigger
  // ----------------------------------------
  bills
    .command("sync")
    .description("Trigger a Gmail sync run (otherwise scheduled every 5 min)")
    .option("--integration <id>", "Only sync a specific integration")
    .action(async (opts: { integration?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        await client.graphqlRequest<{ triggerBusinessGmailSync: boolean }>(
          TRIGGER_SYNC_MUTATION,
          { integrationId: opts.integration }
        )
        console.log("✓ Sync queued.")
      } catch (err) {
        handleError(err)
      }
    })

  // ----------------------------------------
  // bills setup — convenience alias
  // ----------------------------------------
  bills
    .command("setup")
    .description("Interactive bills setup (Gmail connect)")
    .action(async () => {
      console.log("\nBills setup")
      console.log("============")
      console.log("Run `blaze bills connect-gmail` to authorize Gmail.")
      console.log("Forwarding-address inbound is not yet available.\n")
    })
}
