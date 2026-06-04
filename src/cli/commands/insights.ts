import { Command } from "commander"
import {
  getClient,
  getGlobalOpts,
  handleError,
  requireBusinessContext,
  withSpinner,
} from "../utils"
import { formatOutput } from "../output"

/**
 * Resolves a `--period 7d|30d|90d|1m|3m|6m|1y` shorthand into start_date / end_date.
 * If --period is omitted, falls back to the explicit --start-date / --end-date flags.
 * Throws on invalid period syntax so the caller's `handleError` surfaces it.
 *
 * Precedence: --period beats --start-date / --end-date when both are passed.
 */
function resolvePeriod(
  period: string | undefined,
  startDate: string | undefined,
  endDate: string | undefined
): { start_date?: string; end_date?: string } {
  if (!period) {
    return { start_date: startDate, end_date: endDate }
  }

  const match = period.match(/^(\d+)([dwmy])$/i)
  if (!match) {
    throw new Error(
      `Invalid --period "${period}". Use formats like 7d, 30d, 90d, 1m, 3m, 6m, 1y.`
    )
  }

  const n = parseInt(match[1], 10)
  const unit = match[2].toLowerCase()
  const end = new Date()
  const start = new Date(end)
  switch (unit) {
    case "d":
      start.setDate(end.getDate() - n)
      break
    case "w":
      start.setDate(end.getDate() - n * 7)
      break
    case "m":
      start.setMonth(end.getMonth() - n)
      break
    case "y":
      start.setFullYear(end.getFullYear() - n)
      break
  }
  return {
    start_date: start.toISOString().split("T")[0],
    end_date: end.toISOString().split("T")[0],
  }
}

export function registerInsightsCommands(program: Command): void {
  const insights = program
    .command("insights")
    .description("View bank spend insights from connected Plaid accounts")

  insights
    .command("summary")
    .description("Get a spending summary over a date range")
    .option(
      "--period <duration>",
      "Quick period: 7d, 30d, 90d, 1m, 3m, 6m, 1y (overrides --start-date/--end-date)"
    )
    .option("--start-date <date>", "Start date (ISO 8601)")
    .option("--end-date <date>", "End date (ISO 8601)")
    .action(
      async (opts: {
        period?: string
        startDate?: string
        endDate?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          await requireBusinessContext(globals)
          const client = await getClient(globals)
          const range = resolvePeriod(opts.period, opts.startDate, opts.endDate)
          const result = await withSpinner(
            "Loading spending summary…",
            () => client.getInsightsSummary(range),
            { format: globals.format }
          )
          formatOutput(result, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  insights
    .command("transactions")
    .description("List bank transactions from connected accounts")
    .option(
      "--period <duration>",
      "Quick period: 7d, 30d, 90d, 1m, 3m, 6m, 1y (overrides --start-date/--end-date)"
    )
    .option("--start-date <date>", "Start date (ISO 8601)")
    .option("--end-date <date>", "End date (ISO 8601)")
    .option("--account-id <id>", "Filter by Plaid account data ID")
    .option("--limit <n>", "Number of results", parseInt)
    .option("--cursor <cursor>", "Pagination cursor")
    .action(
      async (opts: {
        period?: string
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
          const range = resolvePeriod(opts.period, opts.startDate, opts.endDate)
          const result = await withSpinner(
            "Loading bank transactions…",
            () =>
              client.listBankTransactions({
                ...range,
                plaid_account_data_id: opts.accountId,
                limit: opts.limit,
                cursor: opts.cursor,
              }),
            { format: globals.format }
          )
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
        const result = await withSpinner(
          "Loading bank balances…",
          () => client.getBankBalances(),
          { format: globals.format }
        )
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
