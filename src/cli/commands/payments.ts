import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"

export function registerPaymentsCommands(program: Command): void {
  const payments = program.command("payments").description("View P2P payments")

  payments
    .command("list")
    .description("List payments")
    .option("--limit <n>", "Number of results", parseInt)
    .action(async (opts: { limit?: number }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const result = await client.listPayments({ limit: opts.limit })
        const data =
          result &&
          typeof result === "object" &&
          "data" in (result as Record<string, unknown>)
            ? (result as Record<string, unknown>).data
            : result
        formatOutput(data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  payments
    .command("get <id>")
    .description("Get a payment by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = await getClient(globals)
        const payment = await client.getPayment(id)
        formatOutput(payment, globals.format)
      } catch (err) {
        handleError(err)
      }
    })
}
