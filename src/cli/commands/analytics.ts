import { Command } from "commander"
import { getClient, getGlobalOpts, handleError, withSpinner } from "../utils"
import { formatOutput } from "../output"
import type { AnalyticsPeriod } from "../../sdk/types"

export function registerAnalyticsCommands(program: Command): void {
  const analytics = program
    .command("analytics")
    .description("View analytics and reporting")

  analytics
    .command("overview")
    .description("Get analytics overview")
    .option(
      "--period <period>",
      "Time period (LAST_7_DAYS, LAST_30_DAYS, LAST_90_DAYS, LAST_365_DAYS)"
    )
    .action(async (opts: { period?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await withSpinner(
          "Loading analytics overview…",
          () =>
            client.getAnalyticsOverview(
              opts.period as AnalyticsPeriod | undefined
            ),
          { format: globals.format }
        )
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
