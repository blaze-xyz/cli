import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
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
        const client = getClient(globals)
        const result = await client.getAnalyticsOverview(
          opts.period as AnalyticsPeriod | undefined
        )
        formatOutput(result, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
