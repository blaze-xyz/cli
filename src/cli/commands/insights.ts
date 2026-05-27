import { Command } from "commander"
import {
  getClient,
  getGlobalOpts,
  handleError,
  requireBusinessContext,
} from "../utils"
import { formatOutput } from "../output"

export function registerInsightsCommands(program: Command): void {
  const insights = program
    .command("insights")
    .description("View bank spend insights from connected Plaid accounts")

  insights
    .command("summary")
    .description("Get a spending summary over a date range")
    .option("--start-date <date>", "Start date (ISO 8601)")
    .option("--end-date <date>", "End date (ISO 8601)")
    .action(async (opts: { startDate?: string; endDate?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.getInsightsSummary({
          start_date: opts.startDate,
          end_date: opts.endDate,
        })
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  insights
    .command("transactions")
    .description("List bank transactions from connected accounts")
    .option("--start-date <date>", "Start date (ISO 8601)")
    .option("--end-date <date>", "End date (ISO 8601)")
    .option("--account-id <id>", "Filter by Plaid account data ID")
    .option("--limit <n>", "Number of results", parseInt)
    .option("--cursor <cursor>", "Pagination cursor")
    .action(
      async (opts: {
        startDate?: string
        endDate?: string
        accountId?: string
        limit?: number
        cursor?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          await requireBusinessContext(globals)
          const client = await getClient(globals)
          const result = await client.listBankTransactions({
            start_date: opts.startDate,
            end_date: opts.endDate,
            plaid_account_data_id: opts.accountId,
            limit: opts.limit,
            cursor: opts.cursor,
          })
          formatOutput(result.data, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  insights
    .command("balances")
    .description("Get live balances of connected bank accounts")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        await requireBusinessContext(globals)
        const client = await getClient(globals)
        const result = await client.getBankBalances()
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
