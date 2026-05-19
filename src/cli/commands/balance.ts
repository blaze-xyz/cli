import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerBalanceCommand(program: Command): void {
  program
    .command("balance")
    .description("Get account balance")
    .action(async () => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const balance = await client.getBalance()

        if (globals.format === "json") {
          formatOutput(balance, "json")
          return
        }

        const available = (balance.available / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        const pending = (balance.pending / 100).toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
        const currency = balance.currency || "USD"

        console.log("")
        console.log(`  Available:  $${available} ${currency}`)
        if (balance.pending > 0) {
          console.log(`  Pending:    $${pending} ${currency}`)
        }
        console.log("")
      } catch (err) {
        handleError(err)
      }
    })
}
