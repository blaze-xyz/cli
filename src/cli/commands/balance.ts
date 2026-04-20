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
        const client = getClient(globals)
        const balance = await client.getBalance()
        formatOutput(balance, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
