import { Command } from "commander"
import {
  getClient,
  getGlobalOpts,
  handleError,
  requireBusinessContext,
} from "../utils"
import { formatOutput } from "../output"

export function registerAccountingCommands(program: Command): void {
  const accounting = program
    .command("accounting")
    .description("Manage accounting integrations and pull financial reports")

  accounting
    .command("connect")
    .description("Connect QuickBooks, Xero, or Puzzle")
    .requiredOption(
      "--provider <provider>",
      "Provider: quickbooks, xero, or puzzle"
    )
    .action(async (opts: { provider: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.connectAccounting(opts.provider)
        console.log(`\n  Opening authorization page...\n`)
        console.log(`  If browser doesn't open, visit:`)
        console.log(`  ${result.auth_url}\n`)
        console.log(`  Session ID: ${result.session_id}`)
        console.log(`  Waiting for authorization...\n`)
        try {
          const open = (await import("open")).default
          await open(result.auth_url)
        } catch {
          // Browser open failed silently
        }
        let attempts = 0
        while (attempts < 60) {
          await new Promise(r => setTimeout(r, 2000))
          const session = await client.getAccountingSession(result.session_id)
          if (session.status === "COMPLETE") {
            console.log(`  Connected successfully!\n`)
            return
          }
          if (session.status === "FAILED" || session.status === "EXPIRED") {
            console.error(
              `  Connection failed: ${session.error ?? session.status}\n`
            )
            process.exit(1)
          }
          attempts++
        }
        console.error(`  Timed out waiting for authorization.\n`)
        process.exit(1)
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("status")
    .description("Show connected accounting integrations")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.getAccountingIntegrations()
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("disconnect")
    .description("Disconnect an accounting integration")
    .requiredOption("--provider <provider>", "Provider to disconnect")
    .option("--yes", "Skip confirmation")
    .action(async (opts: { provider: string; yes?: boolean }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const integrations = await client.getAccountingIntegrations()
        const match = integrations.find((i: any) =>
          i.provider.toLowerCase().includes(opts.provider.toLowerCase())
        )
        if (!match) {
          console.error(`No ${opts.provider} integration found.`)
          process.exit(1)
        }
        await client.disconnectAccounting(match.id)
        console.log(
          `\n  Disconnected ${match.provider} (${match.company_name ?? match.id}).\n`
        )
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("pnl")
    .alias("profit-and-loss")
    .description("Get Profit & Loss report")
    .requiredOption("--start-date <date>", "Start date (ISO 8601)")
    .requiredOption("--end-date <date>", "End date (ISO 8601)")
    .option("--basis <basis>", "Accounting basis: cash or accrual")
    .option(
      "--provider <provider>",
      "Specific provider (if multiple connected)"
    )
    .action(
      async (opts: {
        startDate: string
        endDate: string
        basis?: "cash" | "accrual"
        provider?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          await requireBusinessContext(globals)
          const client = await getClient(globals)
          const result = await client.getProfitAndLoss({
            start_date: opts.startDate,
            end_date: opts.endDate,
            basis: opts.basis,
            provider: opts.provider,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  accounting
    .command("balance-sheet")
    .description("Get Balance Sheet report")
    .option("--as-of <date>", "Report date (default: today)")
    .option("--basis <basis>", "Accounting basis: cash or accrual")
    .option("--provider <provider>", "Specific provider")
    .action(
      async (opts: {
        asOf?: string
        basis?: "cash" | "accrual"
        provider?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          await requireBusinessContext(globals)
          const client = await getClient(globals)
          const result = await client.getBalanceSheet({
            as_of: opts.asOf,
            basis: opts.basis,
            provider: opts.provider,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  accounting
    .command("chart-of-accounts")
    .alias("coa")
    .description("List chart of accounts")
    .option("--provider <provider>", "Specific provider")
    .action(async (opts: { provider?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.getChartOfAccounts({
          provider: opts.provider,
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("trial-balance")
    .description("Get Trial Balance report")
    .requiredOption("--start-date <date>", "Start date (ISO 8601)")
    .requiredOption("--end-date <date>", "End date (ISO 8601)")
    .option("--basis <basis>", "Accounting basis: cash or accrual")
    .option("--provider <provider>", "Specific provider")
    .action(
      async (opts: {
        startDate: string
        endDate: string
        basis?: "cash" | "accrual"
        provider?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          await requireBusinessContext(globals)
          const client = await getClient(globals)
          const result = await client.getTrialBalance({
            start_date: opts.startDate,
            end_date: opts.endDate,
            basis: opts.basis,
            provider: opts.provider,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  accounting
    .command("cash-activity")
    .description("Get Cash Activity Statement")
    .requiredOption("--start-date <date>", "Start date (ISO 8601)")
    .requiredOption("--end-date <date>", "End date (ISO 8601)")
    .option("--provider <provider>", "Specific provider")
    .action(
      async (opts: {
        startDate: string
        endDate: string
        provider?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          await requireBusinessContext(globals)
          const client = await getClient(globals)
          const result = await client.getCashActivity({
            start_date: opts.startDate,
            end_date: opts.endDate,
            provider: opts.provider,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  accounting
    .command("vendor-spending")
    .description("Get Vendor Spending report")
    .requiredOption("--start-date <date>", "Start date (ISO 8601)")
    .requiredOption("--end-date <date>", "End date (ISO 8601)")
    .option("--provider <provider>", "Specific provider")
    .action(
      async (opts: {
        startDate: string
        endDate: string
        provider?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          await requireBusinessContext(globals)
          const client = await getClient(globals)
          const result = await client.getVendorSpending({
            start_date: opts.startDate,
            end_date: opts.endDate,
            provider: opts.provider,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  accounting
    .command("transactions")
    .description("List accounting transactions history")
    .option("--start-date <date>", "Start date (ISO 8601)")
    .option("--end-date <date>", "End date (ISO 8601)")
    .option("--limit <number>", "Maximum number of results")
    .option("--offset <number>", "Pagination offset")
    .option("--provider <provider>", "Specific provider")
    .action(
      async (opts: {
        startDate?: string
        endDate?: string
        limit?: string
        offset?: string
        provider?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          await requireBusinessContext(globals)
          const client = await getClient(globals)
          const result = await client.getAccountingTransactions({
            start_date: opts.startDate,
            end_date: opts.endDate,
            limit: opts.limit ? Number(opts.limit) : undefined,
            offset: opts.offset ? Number(opts.offset) : undefined,
            provider: opts.provider,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  accounting
    .command("bills")
    .description("List accounting bills history")
    .option("--status <status>", "Filter by status")
    .option("--start-date <date>", "Start date (ISO 8601)")
    .option("--end-date <date>", "End date (ISO 8601)")
    .option("--limit <number>", "Maximum number of results")
    .option("--offset <number>", "Pagination offset")
    .option("--provider <provider>", "Specific provider")
    .action(
      async (opts: {
        status?: string
        startDate?: string
        endDate?: string
        limit?: string
        offset?: string
        provider?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          await requireBusinessContext(globals)
          const client = await getClient(globals)
          const result = await client.getAccountingBills({
            status: opts.status,
            start_date: opts.startDate,
            end_date: opts.endDate,
            limit: opts.limit ? Number(opts.limit) : undefined,
            offset: opts.offset ? Number(opts.offset) : undefined,
            provider: opts.provider,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  accounting
    .command("invoices")
    .description("List accounting invoices history")
    .option("--status <status>", "Filter by status")
    .option("--start-date <date>", "Start date (ISO 8601)")
    .option("--end-date <date>", "End date (ISO 8601)")
    .option("--limit <number>", "Maximum number of results")
    .option("--offset <number>", "Pagination offset")
    .option("--provider <provider>", "Specific provider")
    .action(
      async (opts: {
        status?: string
        startDate?: string
        endDate?: string
        limit?: string
        offset?: string
        provider?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          await requireBusinessContext(globals)
          const client = await getClient(globals)
          const result = await client.getAccountingInvoices({
            status: opts.status,
            start_date: opts.startDate,
            end_date: opts.endDate,
            limit: opts.limit ? Number(opts.limit) : undefined,
            offset: opts.offset ? Number(opts.offset) : undefined,
            provider: opts.provider,
          })
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  accounting
    .command("sync-bills")
    .description("Pull bills from the connected accounting provider into Blaze")
    .option("--provider <provider>", "Specific provider")
    .action(async (opts: { provider?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.syncBillsFromAccounting({
          provider: opts.provider,
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("sync-invoices")
    .description(
      "Pull invoices from the connected accounting provider into Blaze"
    )
    .option("--provider <provider>", "Specific provider")
    .action(async (opts: { provider?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.syncInvoicesFromAccounting({
          provider: opts.provider,
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("sync-vendors")
    .description("Reconcile vendors with the connected accounting provider")
    .option("--provider <provider>", "Specific provider")
    .action(async (opts: { provider?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.syncVendors({ provider: opts.provider })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("sync-customers")
    .description("Reconcile customers with the connected accounting provider")
    .option("--provider <provider>", "Specific provider")
    .action(async (opts: { provider?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.syncCustomers({ provider: opts.provider })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("reconcile")
    .description(
      "Reconcile the connected provider's books against Blaze's internal ledger for a period (Puzzle only)"
    )
    .requiredOption(
      "--start <date>",
      "Period start (ISO 8601, e.g. 2026-01-01)"
    )
    .requiredOption("--end <date>", "Period end (ISO 8601, e.g. 2026-01-31)")
    .option("--provider <provider>", "Specific provider")
    .action(async (opts: { start: string; end: string; provider?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.reconcileAccounts({
          period_start: opts.start,
          period_end: opts.end,
          provider: opts.provider,
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("close-status")
    .description(
      "Show the month-end close status for a period (reconciliation rate + trial-balance-balances; Puzzle only)"
    )
    .requiredOption(
      "--start <date>",
      "Period start (ISO 8601, e.g. 2026-01-01)"
    )
    .requiredOption("--end <date>", "Period end (ISO 8601, e.g. 2026-01-31)")
    .option("--provider <provider>", "Specific provider")
    .action(async (opts: { start: string; end: string; provider?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.getCloseStatus({
          start: opts.start,
          end: opts.end,
          provider: opts.provider,
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("push-bill")
    .description(
      "Push a Blaze bill to the connected provider's books (Blaze → Puzzle)"
    )
    .requiredOption("--bill-id <id>", "Blaze bill id to push")
    .option("--provider <provider>", "Specific provider")
    .action(async (opts: { billId: string; provider?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.pushBillToAccounting(
          opts.billId,
          opts.provider
        )
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  accounting
    .command("push-invoice")
    .description(
      "Push a Blaze invoice to the connected provider's books (Blaze → Puzzle)"
    )
    .requiredOption("--invoice-id <id>", "Blaze invoice id to push")
    .option("--provider <provider>", "Specific provider")
    .action(async (opts: { invoiceId: string; provider?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.pushInvoiceToAccounting(
          opts.invoiceId,
          opts.provider
        )
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
