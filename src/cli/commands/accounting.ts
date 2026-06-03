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
    .description("Connect QuickBooks or Xero")
    .requiredOption("--provider <provider>", "Provider: quickbooks or xero")
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
    .option(
      "--provider <provider>",
      "Specific provider (if multiple connected)"
    )
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
          const result = await client.getProfitAndLoss({
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
    .command("balance-sheet")
    .description("Get Balance Sheet report")
    .option("--as-of <date>", "Report date (default: today)")
    .option("--provider <provider>", "Specific provider")
    .action(async (opts: { asOf?: string; provider?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.getBalanceSheet({
          as_of: opts.asOf,
          provider: opts.provider,
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

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
}
