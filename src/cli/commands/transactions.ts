import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerTransactionsCommands(program: Command): void {
  const transactions = program
    .command("transactions")
    .description("View transactions")

  transactions
    .command("list")
    .description("List transactions")
    .option("--limit <n>", "Number of results", parseInt)
    .option("--type <type>", "Filter by type")
    .option("--status <status>", "Filter by status")
    .action(
      async (opts: { limit?: number; type?: string; status?: string }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const result = await client.listTransactions({
            limit: opts.limit,
            type: opts.type,
            status: opts.status,
          })
          formatOutput(result.data, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )

  transactions
    .command("get <id>")
    .description("Get a transaction by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const transaction = await client.getTransaction(id)
        formatOutput(transaction, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
