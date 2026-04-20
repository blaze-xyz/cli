import { Command } from "commander"
import { getClient, getGlobalOpts, handleError } from "../utils"
import { formatOutput } from "../output"
import type { Currency, TransferSourceType } from "../../sdk/types"

export function registerTransfersCommands(program: Command): void {
  const transfers = program.command("transfers").description("Manage transfers")

  transfers
    .command("list")
    .description("List transfers")
    .option("--limit <n>", "Number of results", parseInt)
    .option("--status <status>", "Filter by status")
    .action(async (opts: { limit?: number; status?: string }) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const result = await client.listTransfers({
          limit: opts.limit,
          status: opts.status,
        })
        formatOutput(result.data, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  transfers
    .command("get <id>")
    .description("Get a transfer by ID")
    .action(async (id: string) => {
      try {
        const globals = getGlobalOpts(program)
        const client = getClient(globals)
        const transfer = await client.getTransfer(id)
        formatOutput(transfer, globals.format)
      } catch (err) {
        handleError(err)
      }
    })

  transfers
    .command("create")
    .description("Create a new transfer")
    .requiredOption("--amount <n>", "Transfer amount", parseFloat)
    .option("--currency <code>", "Currency code (default: USD)")
    .option("--customer-id <id>", "Customer ID")
    .option("--destination-type <type>", "Destination type")
    .option("--destination-id <id>", "Destination ID")
    .option("--note <note>", "Transfer note")
    .action(
      async (opts: {
        amount: number
        currency?: string
        customerId?: string
        destinationType?: string
        destinationId?: string
        note?: string
      }) => {
        try {
          const globals = getGlobalOpts(program)
          const client = getClient(globals)
          const transfer = await client.createTransfer({
            amount: opts.amount,
            currency: opts.currency as Currency | undefined,
            customer_id: opts.customerId,
            destination_type: opts.destinationType as
              | TransferSourceType
              | undefined,
            destination_id: opts.destinationId,
            note: opts.note,
          })
          formatOutput(transfer, globals.format)
        } catch (err) {
          handleError(err)
        }
      }
    )
}
